import Progress from "cli-progress";
import readlineSync from "readline-sync";
import ts, { SourceFile } from "typescript";
import Project from "./project";
import { TransformFlags } from "./internal";

export function getSourceFiles(languageService: ts.LanguageService) {
    const program = languageService.getProgram();
    return program.getSourceFiles()
        .filter(f => !program.isSourceFileFromExternalLibrary(f) && !f.fileName.includes("node_modules") && !f.fileName.endsWith(".d.ts"));
}

export function padRight(s: string, length: number) {
    while (s.length < length) s = s + " ";
    return s.slice(0, length);
}

export function forEachSourceFile(message: string, languageService: ts.LanguageService, action: (s: ts.SourceFile) => void) {
    const sourceFiles = getSourceFiles(languageService);
    const tag = padRight(message, 50);
    const errors = [];
    const bar = new Progress.Bar({
        format: `# ${tag} [{bar}] {percentage}% | {value}/{total}`,
        barCompleteChar: '#',
    }, Progress.Presets.shades_classic);
    bar.start(sourceFiles.length, 0);
    for (let i = 0; i < sourceFiles.length; i++) {
        bar.update(i + 1);
        try {
            action(sourceFiles[i]);
        }
        catch (e) {
            errors.push(`[Error in '${message}'] File ${sourceFiles[i].fileName}:\n ${e.message} \n ${e.stack}\n`);
        }
    }
    bar.stop();
    errors.forEach(e => console.error(e));
}

export function question(message: string, actions: Record<string, () => void>): void {
    const answer: string = readlineSync.question(message);
    const normalized = answer.toLocaleLowerCase();
    const actionName = Object.getOwnPropertyNames(actions).find(a => normalized.startsWith(a.toLocaleLowerCase()));
    if (actionName) {
        actions[actionName]();
    }
    else {
        console.log(`  Sorry.. could not understand '${answer}'.`);
        question(message, actions);
    }
}

export function exit() {
    process.exit(1);
}
export function noop() {
}

export function applyTextChanges(text: string, textChanges: ReadonlyArray<ts.TextChange>): string {
    // for (let i = textChanges.length - 1; i >= 0; i--) {
    //     const { newText, span: { start, length } } = textChanges[i];
    //     text = text.slice(0, start) + newText + text.slice(start + length);
    // }
    // return text;

    const parts: string[] = [];
    let end = text.length;
    textChanges.slice().sort((a, b) => a.span.start > b.span.start ? 1 : -1);

    for (let i = 0; i < textChanges.length; i++) {
        for (let j = i + 1; j < textChanges.length; j++) {
            if (ts.textSpanOverlap(textChanges[i].span, textChanges[j].span)) {
                console.log("spans overlap");
                debugger;
            }
        }
    }

    for (let i = textChanges.length - 1; i >= 0; i--) {
        const { newText, span: { start, length } } = textChanges[i];
        if (start + length !== end)
            parts.push(text.substring(start + length, end));
        if (newText)
            parts.push(newText);
        end = start;
    }
    parts.push(text.substring(0, end));
    return parts.reverse().join("");
}

export function applyFileTextChanges(project: Project, edits: ReadonlyArray<ts.FileTextChanges>): void {
    const fileTextChanges: Record<string, ts.TextChange[]> = {};
    for (const { fileName, textChanges } of edits) {
        (fileTextChanges[fileName] || (fileTextChanges[fileName] = [])).push(...textChanges);
    }
    Object.getOwnPropertyNames(fileTextChanges).forEach(f =>
        project.setFileText(f, applyTextChanges(project.getFileText(f), fileTextChanges[f])));
}

export function containsJsxSyntax(sourceFile: SourceFile) {
    return ((sourceFile as any).transformFlags & TransformFlags.ContainsJsx) !== 0;
}

export function containsDecorators(sourceFile: SourceFile) {
    return ((sourceFile as any).transformFlags & TransformFlags.ContainsDecorators) !== 0;
}