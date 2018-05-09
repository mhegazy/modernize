import path from "path";
import ts from "typescript";
import hosts from "./host";
import tsinternal, { ChangeTracker } from "./internal";
import Progress from "cli-progress";

type Options = {
    projectDir: string;
    include?: string[];
    exclude?: string[];
};

type LSHost = ReturnType<typeof hosts.createLanguageServiceHost>;

const typesMapLocation = "C:/ls/typesMap.json";
const formatCodeSettings = getDefaultFormatCodeSettings();
const userPrefrences: ts.UserPreferences = { quotePreference: "double" };

function addTypesPackages(options: Options, program: ts.Program) {

    const ambientModules = program.getTypeChecker().getAmbientModules().map(mod => tsinternal.stripQuotes(mod.getName()));
    let unresolvedImports: string[] | undefined;

    for (const sourceFile of program.getSourceFiles()) {
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
    }

    const types = tsinternal.JsTyping.discoverTypings(
        hosts.typingResolutionHost,
        console.log,
        program.getSourceFiles().map(f => f.fileName),
        options.projectDir as ts.Path,
        tsinternal.createMapFromTemplate(ts.readConfigFile(typesMapLocation, hosts.typingResolutionHost.readFile).config!),
        tsinternal.createMap(),
        { enable: true },
        unresolvedImports || [],
        tsinternal.createMap());
    console.log("Found types ===> ");
    console.log(JSON.stringify(types.newTypingNames, undefined, 2));

    function getResolvedModues(file: ts.SourceFile): ts.Map<ts.ResolvedModuleFull | undefined> {
        return (file as any).resolvedModules
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
    const tag = padRight(message, 30);
    const bar = new Progress.Bar({
        format: `# ${tag} [{bar}] {percentage}% | {value}/{total}`,
        barCompleteChar: '#',
    }, Progress.Presets.shades_classic);
    const errors: string[] = [];
    bar.start(sourceFiles.length, 0);
    for (let i = 0; i < sourceFiles.length; i++) {
        bar.update(i);
        try {
            action(sourceFiles[i]);
        }
        catch (e) {
           errors.push(`-------------------> [Error] File ${sourceFiles[i].fileName}: Failed to get code actions:\n ${e}`);
        }
    }
    bar.stop();
    // errors.forEach(console.log);
}

function convertToESModules(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes(tsinternal.Diagnostics.File_is_a_CommonJS_module_it_may_be_converted_to_an_ES6_module.code, languageService, host);
}

function convertConstructorFunctionsToESClasses(languageService: ts.LanguageService, host: LSHost) {
    applyQuickFixes(tsinternal.Diagnostics.This_constructor_function_may_be_converted_to_a_class_declaration.code, languageService, host);
}

function applyQuickFixes(diagnosticMessageCode: number, languageService: ts.LanguageService, host: LSHost) {
    forEachSourceFile(`Applying quickfix for ${diagnosticMessageCode}`, languageService, sourceFile => {
        const diagnostics = [
            ...languageService.getSyntacticDiagnostics(sourceFile.fileName),
            ...languageService.getSemanticDiagnostics(sourceFile.fileName),
            ...languageService.getSuggestionDiagnostics(sourceFile.fileName)
        ].filter(d => d.code === diagnosticMessageCode);

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
    applyQuickFixes(tsinternal.Diagnostics.Property_0_does_not_exist_on_type_1.code, languageService, host);
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
        if (ts.isClassExpression(node)) {
            throw new Error ("Found class expression, skipping");
        }
        //  console.log(`--------------------> Processing class ${ts.getNameOfDeclaration(node)!.getText()}`);
        const symbol = checker.getSymbolAtLocation(node.name!);
        if (!symbol) {
            throw new Error("No Symbol!!!");
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

function generateConfigFile(options: Options, host: LSHost) {
    const contents = tsinternal.generateTSConfig({}, [], ts.sys.newLine);
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

    // addTypesPackages(options, program);

    convertToESModules(languageService, lshost);

    convertConstructorFunctionsToESClasses(languageService, lshost);

    generatePropertyDeclarationsForESClasses(languageService, lshost);

    fixMissingPropertyDeclarations(languageService, lshost);

    // convertJSDocToTypeAnnoatations(languageService, lshost);
    // inferTypeAnnoatations(languageService, lshost)

    // Style
    format(languageService, lshost);
    organizeImports(languageService, lshost);

    // Others
    // convert var to let/cosnt
    // conver function expressions to lambdas
    // convert string concat to string templates
    // convert string/array `.indexof(...) > 0` to `includes(...)`
    // convert for to for..of when applicable
    // convert callback to promses or async/await

    // Rename files to .ts
    renameFiles(languageService, lshost);

    // Generate tsconfig.json file
    generateConfigFile(options, lshost);

    // Write all edits
    console.log("# Writing changes");
    lshost.writeEdits();
}


modernize({
    projectDir: "c:\\clones\\webpack",
    include: [
        "declarations.d.ts",
        "bin/*.js",
        "lib/**/*.js"
    ]
});