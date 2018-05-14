import fs from "fs";
import path from "path";
import ts from "typescript";

export default class Project implements ts.LanguageServiceHost {
    private readonly files: Record<string, { name: string, version: number, dirty: boolean, contents: string }> = {};
    private renames: { fileName: string, newFileName: string }[] = [];
    private ls?: ts.LanguageService;
    private progjectVersion = 1;

    constructor(private options: { compilerOptions: ts.CompilerOptions, projectDir: string, filesNames: string[] }) {
        options.filesNames.forEach(f => this.getOrAdd(f));
    }
    private getOrAdd(name: string) {
        if (!this.files[name]) {
            this.files[name] = {
                name: name,
                version: 1,
                dirty: false,
                contents: fs.readFileSync(name).toString()
            };
        }
        return this.files[name];
    }
    private getFileNames() {
        return Object.getOwnPropertyNames(this.files);
    }
    getLanguageService() {
        return this.ls || (this.ls = ts.createLanguageService(this));
    }
    getFileText(fileName: string) {
        return this.getOrAdd(fileName).contents
    }
    setFileText(fileName: string, contents: string) {
        const entry = this.getOrAdd(fileName);
        entry.contents = contents;
        entry.version++;
        entry.dirty = true;
        this.progjectVersion++;
    }
    addFile(fileName: string, contents: string) {
        if (this.files[fileName]) throw new Error(`FileName '${fileName}' already exists in list of known files.`);
        this.files[fileName] = {
            name: fileName,
            version: 1,
            dirty: true,
            contents: contents
        };
        this.progjectVersion++;
    }
    renameFile(fileName: string, newFileName: string) {
        if (fileName === newFileName) return;
        if (this.files[newFileName]) throw new Error(`FileName '${newFileName}' already exists in list of known files.`);
        if (fs.existsSync(newFileName)) throw new Error(`New fileName '${newFileName}' already exists on disk.`);

        // remember the rename
        this.renames.push({ fileName, newFileName });

        // Add new entry
        const entry = this.getOrAdd(fileName);
        this.files[newFileName] = {
            name: newFileName,
            version: 1,
            dirty: true,
            contents: entry.contents
        };

        // delete old entry
        delete this.files[fileName];
        this.progjectVersion++;
    }
    writeEdits() {
        for (const { fileName, newFileName } of this.renames) {
            fs.renameSync(fileName, newFileName);
        }
        this.renames = [];

        for (const file of this.getFileNames()) {
            if (this.files[file].dirty) {
                fs.writeFileSync(this.files[file].name, this.files[file].contents);
                this.files[file].dirty = false;
            }
        }
    }
    getCompilationSettings() {
        return this.options.compilerOptions
    }
    getNewLine() {
        return ts.sys.newLine
    }
    getProjectVersion() {
        return this.progjectVersion.toString()
    }
    getScriptFileNames() {
        return this.getFileNames();
    }
    getScriptVersion(fileName: string) {
        return this.getOrAdd(fileName).version.toString();
    }
    getScriptSnapshot(fileName: string) {
        return ts.ScriptSnapshot.fromString(this.getOrAdd(fileName).contents);
    }
    getCurrentDirectory() {
        return this.options.projectDir
    }
    getDefaultLibFileName() {
        return path.resolve(__dirname, "../node_modules/typescript/lib", ts.getDefaultLibFileName(this.options.compilerOptions))
    }
    log(m: string) {
        return console.log(m)
    }
    trace(m: string) {
        return console.trace;
    }
    error(m: string) {
        return console.error(m);
    }
    useCaseSensitiveFileNames() {
        return ts.sys.useCaseSensitiveFileNames;
    }
    readDirectory(path: string, extensions?: ReadonlyArray<string>, exclude?: ReadonlyArray<string>, include?: ReadonlyArray<string>, depth?: number) {
        return ts.sys.readDirectory(path, extensions, exclude, include, depth);
    }
    readFile(path: string, encoding?: string) {
        return ts.sys.readFile(path, encoding);
    }
    realpath(path: string) {
        return ts.sys.realpath!(path);
    }
    fileExists(path: string) {
        return ts.sys.fileExists(path);
    }
    //getDirectories: ts.sys.getDirectories,
    isKnownTypesPackageName() {
        return false;
    }
}