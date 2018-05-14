import path from "path";
import ts from "typescript";
import tsinternal from "../internal";
import Project from "../project";
import { Options } from "../types";
import { getSourceFiles, containsJsxSyntax } from "../helpers";

export function generateConfigFile(project: Project, options: Options) {
    const config: ts.CompilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS
    };

    if (getSourceFiles(project.getLanguageService()).find(containsJsxSyntax)) {
        config.jsx = ts.JsxEmit.React;
    }

    const contents = tsinternal.generateTSConfig(config, [], ts.sys.newLine);
    const fileName = path.resolve(options.projectDir, "tsconfig.json");
    project.addFile(fileName, contents);
    console.log("# Generating tsconfig.json file");
    //console.log(contents);
}