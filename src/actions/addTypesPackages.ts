import Project from "../project";
import { Options } from "../types";
import { execSync } from "child_process";
import ts from "typescript";
import tsinternal from "../internal";
import { typingResolutionHost } from "../host";
import { forEachSourceFile, question, noop } from "../helpers";

const typesMapLocation = "C:/ls/typesMap.json";

export function addTypesPackages(project: Project, options: Options) {
    const languageService = project.getLanguageService();
    const program = languageService.getProgram();
    const ambientModules = program.getTypeChecker().getAmbientModules().map(mod => tsinternal.stripQuotes(mod.getName()));
    let unresolvedImports: string[] | undefined;

    forEachSourceFile(`Looking for needed @types pacakages`, languageService, sourceFile => {
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
        typingResolutionHost,
        (_message) => { /* console.log(_message); */ },
        program.getSourceFiles().map(f => f.fileName),
        options.projectDir as ts.Path,
        tsinternal.createMapFromTemplate(ts.readConfigFile(typesMapLocation, typingResolutionHost.readFile).config!),
        tsinternal.createMap(),
        { enable: true },
        unresolvedImports || [],
        typesRegistry);

    const typesToInstall = types.newTypingNames
        .filter(t => tsinternal.JsTyping.validatePackageName(t) === 0 && typesRegistry.has(t))
        .map(t => `@types/${t}`);

    const missingTypes = unresolvedImports ? types.newTypingNames
        .filter(t => tsinternal.JsTyping.validatePackageName(t) === 0 &&
            !typesRegistry.has(t) &&
            unresolvedImports!.includes(t) &&
            !tsinternal.JsTyping.nodeCoreModuleList.includes(t)) : undefined;

    console.log(`# Found ${typesToInstall.length} packages`);
    if (options.interactive) {
        question("   Press (L) to list the packages, (C) to continue..", {
            "L": () => typesToInstall.forEach(p => console.log(`   - ${p}`)),
            "C": noop
        });
    }

    console.log("# Running 'npm install'...")
    runCommandSync("npm install --save-dev " + typesToInstall.join(" "), options.projectDir);

    if (missingTypes) {
        console.log(`# Found ${missingTypes.length} packages missing from @types`);
        if (options.interactive) {
            question("   Press (L) to list the packages, (C) to continue..", {
                "L": () => missingTypes.forEach(p => console.log(`   - ${p}`)),
                "C": noop
            });
        }
        // TODO: call dts-gen for each one of the missing packages, and add a typesRoot
    }
}

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