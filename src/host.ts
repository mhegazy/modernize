import ts from "typescript";
import fs from "fs";
import { resolve } from "path";

export default {
    compilerHost: ts.createCompilerHost({}),
    parseConfigHost: {
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory: ts.sys.readDirectory,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile
    },
    typingResolutionHost: {
        directoryExists: ts.sys.directoryExists,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory,
    },
    createLanguageServiceHost(options: { compilerOptions: ts.CompilerOptions, projectDir: string, filesNames: string[] }) {
        const files: Record<string, { name: string, version: number, contents:string }> = {};
        options.filesNames.forEach(getOrAdd);
        const renames: { fileName: string, newFileName: string }[] = [];

        function getOrAdd(name: string) {
            if (!files[name]) {
                files[name] = {
                    name: name, version: 1, contents: fs.readFileSync(name).toString()
                };
            }
            return files[name];
        }

        function getFileNames() {
            return Object.getOwnPropertyNames(files);
        }

        let progjectVersion = 1;
        return {
            getFileText: (fileName: string) => getOrAdd(fileName).contents,
            setFileText: (fileName: string, contents: string) => {
                const entry = getOrAdd(fileName);
                entry.contents = contents;
                entry.version++;
                progjectVersion++;
            },
            renameFile: (fileName: string, newFileName: string) => {
                if (fileName === newFileName) return;
                if (files[newFileName]) throw new Error(`FileName '${newFileName}' already exists in list of known files.`);
                if (fs.existsSync(newFileName)) throw new Error(`New fileName '${newFileName}' already exists on disk.`);

                // remember the rename
                renames.push({ fileName, newFileName });

                // Add new entry
                const entry = getOrAdd(fileName);
                files[newFileName] = {
                    name: newFileName,
                    version: 1,
                    contents: entry.contents
                };

                // delete old entry
                delete files[fileName];
                progjectVersion++;
            },
            writeEdits: () => {
                // for (const { fileName, newFileName} of renames) {
                //     fs.renameSync(fileName, newFileName);
                // }

                for (const file of getFileNames()) {
                    fs.writeFileSync(files[file].name, files[file].contents);
                }
            },
            getCompilationSettings: () => options.compilerOptions,
            getNewLine: () => ts.sys.newLine,
            getProjectVersion: () => progjectVersion.toString(),
            getScriptFileNames: getFileNames,
            getScriptVersion: (fileName: string) => {
                return getOrAdd(fileName).version.toString();
            },
            getScriptSnapshot: (fileName: string) => {
                return ts.ScriptSnapshot.fromString(getOrAdd(fileName).contents);
            },
            getCurrentDirectory: () => options.projectDir,
            getDefaultLibFileName: () => resolve(__dirname, "../node_modules/typescript/lib", ts.getDefaultLibFileName(options.compilerOptions)),
            log: console.log,
            trace: console.trace,
            error: console.error,
            useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
            readDirectory: ts.sys.readDirectory,
            readFile: ts.sys.readFile,
            realpath: ts.sys.realpath!,
            fileExists: ts.sys.fileExists,
            //getDirectories: ts.sys.getDirectories,
            isKnownTypesPackageName: () => false
        };
    }
};