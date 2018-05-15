import path from "path";
import ts from "typescript";
import tsinternal from "../internal";
import Project from "../project";
import { Options } from "../types";
import { getSourceFiles, containsJsxSyntax, containsDecorators } from "../helpers";

export function generateConfigFile(project: Project, options: Options) {
    const config: ts.CompilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS
    };

    const sourceFiles = getSourceFiles(project.getLanguageService());

    if (sourceFiles.find(containsJsxSyntax)) {
        config.jsx = ts.JsxEmit.React;
    }

    if (sourceFiles.find(containsDecorators)) {
        config.experimentalDecorators = true;
    }

    const contents = tsinternal.generateTSConfig(config, [], ts.sys.newLine);
    const fileName = path.resolve(options.projectDir, "tsconfig.json");
    project.addFile(fileName, contents);
    console.log("# Generating tsconfig.json file");
    //console.log(contents);
}