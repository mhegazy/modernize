import ts from "typescript";

export const compilerHost = ts.createCompilerHost({});

export const parseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory: ts.sys.readDirectory,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile
};

export const typingResolutionHost = {
    directoryExists: ts.sys.directoryExists,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
};

    // createLanguageServiceHost(options: { compilerOptions: ts.CompilerOptions, projectDir: string, filesNames: string[] }) {
    //     const files: Record<string, { name: string, version: number, dirty: boolean, contents:string }> = {};
    //     options.filesNames.forEach(getOrAdd);
    //     let renames: { fileName: string, newFileName: string }[] = [];

    //     function getOrAdd(name: string) {
    //         if (!files[name]) {
    //             files[name] = {
    //                 name: name,
    //                 version: 1,
    //                 dirty: false,
    //                 contents: fs.readFileSync(name).toString()
    //             };
    //         }
    //         return files[name];
    //     }

    //     function getFileNames() {
    //         return Object.getOwnPropertyNames(files);
    //     }

    //     let ls: ts.LanguageService;
    //     let progjectVersion = 1;
    //     return {
    //         getLanguageService(this: any): ts.LanguageService {
    //             return ls || (ls = ts.createLanguageService(this));
    //         },
    //         getFileText: (fileName: string) => getOrAdd(fileName).contents,
    //         setFileText: (fileName: string, contents: string) => {
    //             const entry = getOrAdd(fileName);
    //             entry.contents = contents;
    //             entry.version++;
    //             entry.dirty = true;
    //             progjectVersion++;
    //         },
    //         addFile: (fileName: string, contents: string) => {
    //             if (files[fileName]) throw new Error(`FileName '${fileName}' already exists in list of known files.`);
    //             files[fileName] = {
    //                 name: fileName,
    //                 version: 1,
    //                 dirty: true,
    //                 contents: contents
    //             };
    //             progjectVersion++;
    //         },
    //         renameFile: (fileName: string, newFileName: string) => {
    //             if (fileName === newFileName) return;
    //             if (files[newFileName]) throw new Error(`FileName '${newFileName}' already exists in list of known files.`);
    //             if (fs.existsSync(newFileName)) throw new Error(`New fileName '${newFileName}' already exists on disk.`);

    //             // remember the rename
    //             renames.push({ fileName, newFileName });

    //             // Add new entry
    //             const entry = getOrAdd(fileName);
    //             files[newFileName] = {
    //                 name: newFileName,
    //                 version: 1,
    //                 dirty:  true,
    //                 contents: entry.contents
    //             };

    //             // delete old entry
    //             delete files[fileName];
    //             progjectVersion++;
    //         },
    //         writeEdits: () => {
    //             for (const { fileName, newFileName} of renames) {
    //                 fs.renameSync(fileName, newFileName);
    //             }
    //             renames = [];

    //             for (const file of getFileNames()) {
    //                 if (files[file].dirty) {
    //                     fs.writeFileSync(files[file].name, files[file].contents);
    //                     files[file].dirty = false;
    //                 }
    //             }
    //         },
    //         getCompilationSettings: () => options.compilerOptions,
    //         getNewLine: () => ts.sys.newLine,
    //         getProjectVersion: () => progjectVersion.toString(),
    //         getScriptFileNames: getFileNames,
    //         getScriptVersion: (fileName: string) => {
    //             return getOrAdd(fileName).version.toString();
    //         },
    //         getScriptSnapshot: (fileName: string) => {
    //             return ts.ScriptSnapshot.fromString(getOrAdd(fileName).contents);
    //         },
    //         getCurrentDirectory: () => options.projectDir,
    //         getDefaultLibFileName: () => resolve(__dirname, "../node_modules/typescript/lib", ts.getDefaultLibFileName(options.compilerOptions)),
    //         log: console.log,
    //         trace: console.trace,
    //         error: console.error,
    //         useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    //         readDirectory: ts.sys.readDirectory,
    //         readFile: ts.sys.readFile,
    //         realpath: ts.sys.realpath!,
    //         fileExists: ts.sys.fileExists,
    //         //getDirectories: ts.sys.getDirectories,
    //         isKnownTypesPackageName: () => false
    //     };
    // }