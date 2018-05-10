import path from "path";
import ts, { LanguageService } from "typescript";
import hosts from "./host";
import tsinternal, { ChangeTracker, PackageNameValidationResult } from "./internal";
import Progress from "cli-progress";
import { execSync } from "child_process";
import readlineSync from "readline-sync";


type Options = {
    projectDir: string;
    include?: string[];
    exclude?: string[];
    interactive?: boolean;
};

type LSHost = ReturnType<typeof hosts.createLanguageServiceHost>;

const typesMapLocation = "C:/ls/typesMap.json";
const formatCodeSettings = getDefaultFormatCodeSettings();
const userPrefrences: ts.UserPreferences = { quotePreference: "double" };
const errors: string[] = [];

function addTypesPackages(languageService: ts.LanguageService, _host: LSHost, options: Options) {
    const program = languageService.getProgram();
    const ambientModules = program.getTypeChecker().getAmbientModules().map(mod => tsinternal.stripQuotes(mod.getName()));
    let unresolvedImports: string[] | undefined;

    forEachSourceFile(`Find applicable @types pacakages`, languageService, sourceFile => {
        const resolvedModules = getResolvedModues(sourceFile);
        if (resolvedModules) {
            resolvedModules.forEach((resolvedModule, name) => {
                // pick unresolved non-relative names
                if (!resolvedModule && !tsinternal.isExternalModuleNameRelative(name) && ambientModules.some(m => m === name)) {
                    // for non-scoped names extract part up-to the first slash
                    // for scoped names - extract up to the second slash
                    let trimmed = name.trim();
                    let i = trimmed.indexOf("/");
                    if (i !== -1 && trimmed.charCodeAt(0) === "@".charCodeAt(0)) {
                        i = trimmed.indexOf("/", i + 1);
                    }
                    if (i !== -1) {
                        trimmed = trimmed.substr(0, i);
                    }
                    (unresolvedImports || (unresolvedImports = [])).push(trimmed);
                }
            });
        }
    });

    const typesRegistry = tsinternal.createMapFromTemplate<ts.MapLike<string>>(require("types-registry").entries);

    const types = tsinternal.JsTyping.discoverTypings(
        hosts.typingResolutionHost,
        (_message) => { /* console.log(_message); */ },
        program.getSourceFiles().map(f => f.fileName),
        options.projectDir as ts.Path,
        tsinternal.createMapFromTemplate(ts.readConfigFile(typesMapLocation, hosts.typingResolutionHost.readFile).config!),
        tsinternal.createMap(),
        { enable: true },
        unresolvedImports || [],
        typesRegistry);

    const typesToInstall = types.newTypingNames
        .filter(t => tsinternal.JsTyping.validatePackageName(t) === 0 && typesRegistry.has(t))
        .map(t => `@types/${t}`)
        .join(" ");
    // console.log("Found types ===> ");
    // console.log(JSON.stringify(typesToInstall, undefined, 2));

    console.log("# Running 'npm install'...")
    runCommandSync("npm install --save-dev " + typesToInstall, options.projectDir);

    function getResolvedModues(file: ts.SourceFile): ts.Map<ts.ResolvedModuleFull | undefined> {
        return (file as any).resolvedModules
    }

    function runCommandSync(command: string, projectDir: string) {
        try {
            execSync(command, { cwd: projectDir, encoding: "utf-8" });
        }
        catch (error) {
            const { stdout, stderr } = error;
            console.log(`[Error] Failed. stdout:${stdout}\n    stderr:${stderr}`);
            return false;
        }
        return true;
    }
}

function getSourceFiles(languageService: ts.LanguageService) {
    const program = languageService.getProgram();
    return program.getSourceFiles()
        .filter(f => !program.isSourceFileFromExternalLibrary(f) && !f.fileName.includes("node_modules") && !f.fileName.endsWith(".d.ts"));
}

function padRight(s: string, length: number) {
    while (s.length < length) s = s + " ";
    return s.slice(0, length);
}

function forEachSourceFile(message: string, languageService: ts.LanguageService, action: (s: ts.SourceFile) => void) {
    const sourceFiles = getSourceFiles(languageService);
    const tag = padRight(message, 50);
    const bar = new Progress.Bar({
        format: `# ${tag} [{bar}] {percentage}% | {value}/{total}`,
        barCompleteChar: '#',
    }, Progress.Presets.shades_classic);
    bar.start(sourceFiles.length, 0);
    for (let i = 0; i < sourceFiles.length; i++) {
        bar.update(i);
        try {
            action(sourceFiles[i]);
        }
        catch (e) {
           errors.push(`[Error in '${message}'] File ${sourceFiles[i].fileName}:\n ${e.message} \n ${e.stack}\n`);
        }
    }
    bar.stop();
}

function convertToESModules(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes("Convert CJS modules to ES modules", [tsinternal.Diagnostics.File_is_a_CommonJS_module_it_may_be_converted_to_an_ES6_module.code], languageService, host);
}

function convertConstructorFunctionsToESClasses(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes("Convert constructor functions to ES classes", [tsinternal.Diagnostics.This_constructor_function_may_be_converted_to_a_class_declaration.code], languageService, host);
}

function convertJSDocToTypeAnnoatations(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes("Convert JSDoc types to TS types", [tsinternal.Diagnostics.JSDoc_types_may_be_moved_to_TypeScript_types.code], languageService, host);
}

function inferTypeAnnoatations(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes("Infer types from usage", [
        tsinternal.Diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined.code,
        tsinternal.Diagnostics.Variable_0_implicitly_has_an_1_type.code,
        tsinternal.Diagnostics.Parameter_0_implicitly_has_an_1_type.code,
        tsinternal.Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code,
        tsinternal.Diagnostics.Property_0_implicitly_has_type_any_because_its_get_accessor_lacks_a_return_type_annotation.code,
        tsinternal.Diagnostics._0_which_lacks_return_type_annotation_implicitly_has_an_1_return_type.code,
        tsinternal.Diagnostics.Property_0_implicitly_has_type_any_because_its_set_accessor_lacks_a_parameter_type_annotation.code,
        tsinternal.Diagnostics.Member_0_implicitly_has_an_1_type.code
    ], languageService, host);
}

function applyQuickFixes(message: string, diagnosticMessageCodes: number[], languageService: ts.LanguageService, host: LSHost) {
    forEachSourceFile(`${message}`, languageService, sourceFile => {
        const diagnostics = [
            ...languageService.getSyntacticDiagnostics(sourceFile.fileName),
            ...languageService.getSemanticDiagnostics(sourceFile.fileName),
            ...languageService.getSuggestionDiagnostics(sourceFile.fileName)
        ].filter(d => diagnosticMessageCodes.includes(d.code));

        for (const diagnostic of diagnostics) {
            const fileName = diagnostic.file!.fileName;
            // console.log(`-------------------> Found diagnostic ${ts.DiagnosticCategory[diagnostic.category]} ${diagnostic.code} ${diagnostic.messageText}`);
            const actions = languageService.getCodeFixesAtPosition(fileName, diagnostic.start!, diagnostic.start! + diagnostic.length!, [diagnostic.code], formatCodeSettings, userPrefrences);
            for (const action of actions) {
                applyFileTextChanges(host, action.changes);
            }
        }
    });
}

function applyFileTextChanges(host: LSHost, edits: ReadonlyArray<ts.FileTextChanges>): void {
    for (const { fileName, textChanges } of edits) {
        host.setFileText(fileName, applyTextChanges(host.getFileText(fileName), textChanges));
    }
}

function applyTextChanges(text: string, textChanges: ReadonlyArray<ts.TextChange>): string {
    for (let i = textChanges.length - 1; i >= 0; i--) {
        const { newText, span: { start, length } } = textChanges[i];
        text = text.slice(0, start) + newText + text.slice(start + length);
    }
    return text;
}

function fixMissingPropertyDeclarations(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes("Add missing property declarations", [tsinternal.Diagnostics.Property_0_does_not_exist_on_type_1.code], languageService, host);
}

function generatePropertyDeclarationsForESClasses(languageService: ts.LanguageService, host: LSHost) {
    const program = languageService.getProgram();
    const checker = program.getTypeChecker();

    forEachSourceFile(`Generating property declarations`, languageService, sourceFile => {
        const changeTracker = tsinternal.textChanges.ChangeTracker.fromContext({ formatContext: tsinternal.formatting.getFormatContext(formatCodeSettings), host: host });
        ts.forEachChild(sourceFile, function visit(node: ts.Node) {
            if (ts.isClassLike(node)) {
                addPropertyDeclarations(sourceFile, node, changeTracker);
            }
            ts.forEachChild(node, visit);
        });

        applyFileTextChanges(host, changeTracker.getChanges());
    });

    function addPropertyDeclarations(sourceFile: ts.SourceFile, node: ts.ClassLikeDeclaration, changeTracker: ChangeTracker) {
        //  console.log(`--------------------> Processing class ${ts.getNameOfDeclaration(node)!.getText()}`);
        const symbol: ts.Symbol = ts.isClassDeclaration(node) ? checker.getSymbolAtLocation(node.name!) : (node as any).symbol;
        if (!symbol) {
            throw new Error("addPropertyDeclarations: No Symbol!!!");
        }

        // all instance members are stored in the "member" array of symbol
        if (symbol.members) {
            symbol.members.forEach(member => {
                if (member.valueDeclaration && !ts.isClassElement(member.valueDeclaration)) {
                    const type = checker.getTypeOfSymbolAtLocation(member, node);
                    const typeNode = type.flags & ts.TypeFlags.Any ? undefined : checker.typeToTypeNode(type, node);
                    // console.log(`------------------------> Property ${member.name} : ${checker.typeToString(type)}`);
                    changeTracker.insertNodeAtClassStart(sourceFile, node, ts.createProperty(undefined,
                        undefined,
                        member.name,
                        !!(member.flags & ts.SymbolFlags.Optional) ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                        /*type*/typeNode,
                        /*initializer*/ undefined));
                }
            });
        }

        // all static members are stored in the "exports" array of symbol
        if (symbol.exports) {
            symbol.exports.forEach(member => {
                if (member.valueDeclaration && !ts.isClassElement(member.valueDeclaration)) {
                    const type = checker.getTypeOfSymbolAtLocation(member, node);
                    const typeNode = type.flags & ts.TypeFlags.Any ? undefined : checker.typeToTypeNode(type, node);
                    // console.log(`------------------------> Static Property ${member.name} : ${checker.typeToString(type)}`);
                    changeTracker.insertNodeAtClassStart(sourceFile, node, ts.createProperty(undefined,
                        [ts.createToken(ts.SyntaxKind.StaticKeyword)],
                        member.name,
                        !!(member.flags & ts.SymbolFlags.Optional) ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                        /*type*/typeNode,
                        /*initializer*/ undefined));
                }
            });
        }
    }
}

function format(languageService: ts.LanguageService, host: LSHost) {
    forEachSourceFile("Formatting files", languageService, ({ fileName }) => {
        const edits = languageService.getFormattingEditsForDocument(fileName, formatCodeSettings);
        host.setFileText(fileName, applyTextChanges(host.getFileText(fileName), edits));
    });
}

function organizeImports(languageService: ts.LanguageService, host: LSHost) {
    forEachSourceFile("Organize imports", languageService, ({ fileName }) => {
        applyFileTextChanges(host, languageService.organizeImports({ fileName, type: "file" }, formatCodeSettings, userPrefrences));
    });
}

function renameFiles(languageService: ts.LanguageService, host: LSHost) {
    forEachSourceFile("Renaming files", languageService, ({fileName})=>{
        const extension = tsinternal.extensionFromPath(fileName);
        const newExtension = extension === ts.Extension.Jsx ? ts.Extension.Tsx : extension === ts.Extension.Js ? ts.Extension.Ts : extension;
        const newFileName = tsinternal.removeExtension(fileName, extension) + newExtension;
        host.renameFile(fileName, newFileName);
    });
}

function getDefaultFormatCodeSettings(): ts.FormatCodeSettings {
    return {
        indentSize: 4,
        tabSize: 4,
        newLineCharacter: ts.sys.newLine,
        convertTabsToSpaces: true,
        indentStyle: ts.IndentStyle.Smart,
        insertSpaceAfterConstructor: false,
        insertSpaceAfterCommaDelimiter: true,
        insertSpaceAfterSemicolonInForStatements: true,
        insertSpaceBeforeAndAfterBinaryOperators: true,
        insertSpaceAfterKeywordsInControlFlowStatements: true,
        insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
        insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
        insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
        insertSpaceBeforeFunctionParenthesis: false,
        placeOpenBraceOnNewLineForFunctions: false,
        placeOpenBraceOnNewLineForControlBlocks: false,
    };
}

function getInitialConfiguration(options: Options) {
    const config: { compilerOptions: {}, include?: string[], exclude?: string[] } = {
        compilerOptions: {
            strict: true,
            rootDir: options.projectDir,
            allowJs: true,
            checkJs: true,
            target: "ESNext",
            module: "node"
        }
    };
    if (options.include) config.include = options.include;
    if (options.exclude) config.exclude = options.exclude;

    return config;
}

function generateConfigFile(_languageService: ts.LanguageService, host: LSHost, options: Options) {
    const contents = tsinternal.generateTSConfig({
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS
    }, [], ts.sys.newLine);
    const fileName = path.resolve(options.projectDir, "tsconfig.json");
    host.setFileText(fileName, contents);
    console.log("# Generating tsconfig.json file");
    //console.log(contents);
}

function modernize(options: Options) {
    const intialConfig = getInitialConfiguration(options);
    const parsedConfigFile = ts.parseJsonConfigFileContent(intialConfig, hosts.parseConfigHost, options.projectDir, {}, "tsconfig.json");
    const lshost = hosts.createLanguageServiceHost({
        compilerOptions: parsedConfigFile.options,
        projectDir: options.projectDir,
        filesNames: parsedConfigFile.fileNames
    });

    const languageService = ts.createLanguageService(lshost);

    console.log(`# Found ${getSourceFiles(languageService).length} files`);
    // console.log(JSON.stringify(program.getSourceFiles().map(f => f.fileName), undefined, 2));

    const actions = [
        addTypesPackages,
        convertToESModules,
        convertConstructorFunctionsToESClasses,
        generatePropertyDeclarationsForESClasses,

        // Style
        format,
        organizeImports,

        // Rename files to .ts
        renameFiles,

        fixMissingPropertyDeclarations,

        convertJSDocToTypeAnnoatations,

        inferTypeAnnoatations,

        // lint
        // convert var to let/cosnt
        // conver function expressions to lambdas
        // convert string concat to string templates

        // others
        // convert string/array `.indexof(...) > 0` to `includes(...)`
        // convert for to for..of when applicable
        // convert callback to promses or async/await

        // Generate tsconfig.json file
        generateConfigFile,
    ];

    actions.forEach(doAction);


    function doAction(action: (languageService: LanguageService, host: LSHost, options: Options) => void) {
        action(languageService, lshost, options);

        // Write all edits
        console.log("  Writing changes");
        lshost.writeEdits();
        if (options.interactive) {
            const answer: string = readlineSync.question("  Do you wish to continue (Y|N)?");
            if (answer.startsWith("n") || answer.startsWith("N")) {
                process.exit(1);
            }
        }
        console.log();
    }
}


modernize({
    projectDir: "c:\\clones\\webpack",
    include: [
        "declarations.d.ts",
        "bin/*.js",
        "lib/**/*.js",
        //"test/**/*.js"
    ],
    interactive: true
});
errors.forEach(e => console.error(e));