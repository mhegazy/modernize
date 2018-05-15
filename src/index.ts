import ts from "typescript";
import { addTypesPackages } from "./actions/addTypesPackages";
import { convertConstructorFunctionsToESClasses, convertJSDocToTypeAnnoatations, convertToESModules, fixMissingPropertyDeclarations, inferTypeAnnoatations } from "./actions/fixes";
import { format } from "./actions/format";
import { generatePropertyDeclarationsForESClasses } from "./actions/generateMissingDeclarations";
import { generateConfigFile } from "./actions/generateTsconfig";
import { organizeImports } from "./actions/origanizeImports";
import { renameFiles } from "./actions/rename";
import { exit, getSourceFiles, noop, question, forEachSourceFile } from "./helpers";
import { parseConfigHost } from "./host";
import Project from "./project";
import { Options } from "./types";

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

function createProject(options: Options) {
    const intialConfig: { compilerOptions: {}, include?: string[], exclude?: string[] } = {
        compilerOptions: {
            strict: true,
            rootDir: options.projectDir,
            allowJs: true,
            checkJs: true,
            target: "ESNext",
            module: "node",
            jsx: "react",
            experimentalDecorators: true,
        }
    };
    if (options.include) intialConfig.include = options.include;
    if (options.exclude) intialConfig.exclude = options.exclude;

    const parsedConfigFile = ts.parseJsonConfigFileContent(intialConfig, parseConfigHost, options.projectDir, {}, "tsconfig.json");
    const project = new Project({
        compilerOptions: parsedConfigFile.options,
        projectDir: options.projectDir,
        filesNames: parsedConfigFile.fileNames
    });

    const files = getSourceFiles(project.getLanguageService());

    console.log(`# Found ${files.length} files`);
    if (options.interactive) {
        question("   Press (L) to list the files, (C) to continue..", {
            "L": () => {
                files.map(f => f.fileName).forEach(f => console.log(`   - ${f}`));
                question("   Do these all look right to you? (Y)es, keep going, or (N)o, cancel, and you can update your excludes..", {
                    "Y": noop,
                    "N": exit
                });
            },
            "C": noop
        });
    }

    return project;
}

function modernize(options: Options) {
    const project = createProject(options);

    actions.forEach(action => {
        action(project, options);

        // Write all edits
        console.log("  Writing changes");
        project.writeEdits();

        if (options.verify)
            verifyAction(project);

        if (options.interactive) {
            question("  Do you wish to continue (Y|N)?", { "N": exit, "Y": noop });
        }

        console.log();
    });
}

function verifyAction(project: Project) {
    const languageService = project.getLanguageService();
    forEachSourceFile("Verifing ...", languageService, (sourceFile) => {
        let diag = languageService.getSyntacticDiagnostics(sourceFile.fileName);
        diag = diag.filter(d => !ts.flattenDiagnosticMessageText(d.messageText, ts.sys.newLine).endsWith("in a .ts file."));
        if (diag.length) {
            console.log("> Syntactic errors");
            diag.slice(0, 10).forEach(d => {
                const { line, character } = ts.getLineAndCharacterOfPosition(d.file!, d.start!);
                console.log(`  => ${d.code} - ${d.file!.fileName} (${line}, ${character}): ${d.messageText}`);
            });
            debugger;
        }
    });
}


// modernize({
//     projectDir: "c:\\clones\\webpack",
//     include: [
//         "declarations.d.ts",
//         "bin/*.js",
//         "lib/**/*.js",
//         //"test/**/*.js"
//     ],
//     interactive: true
// });

// modernize({
//     projectDir: "c:\\clones\\adonis-framework",
//     include: [
//         // "declarations.d.ts",
//         // "bin/*.js",
//         "src/**/*.js",
//         //"test/**/*.js"
//     ],
//     interactive: true
// });

modernize({
    projectDir: "C:\\clones\\modernize\\tests\\pluralsight-course-react-aspnet-core\\m6-add-rest-data-to-server-side-rendering\\reactapp",
    //interactive: true,
    verify: true,
    "exclude": [
        "build",
        "public\\clientbundle.js"
    ]
});

