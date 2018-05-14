import ts from "typescript";
import { containsJsxSyntax, forEachSourceFile } from "../helpers";
import tsinternal from "../internal";
import Project from "../project";

export function renameFiles(project: Project) {
    const languageService = project.getLanguageService();
    forEachSourceFile("Renaming files", languageService, (sourceFile) => {
        const fileName = sourceFile.fileName;
        const extension = tsinternal.extensionFromPath(fileName);
        const newExtension = extension === ts.Extension.Jsx
            ? ts.Extension.Tsx
            : extension === ts.Extension.Js
                ? containsJsxSyntax(sourceFile)
                    ? ts.Extension.Tsx
                    : ts.Extension.Ts
                : extension;
        const newFileName = tsinternal.removeExtension(fileName, extension) + newExtension;
        project.renameFile(fileName, newFileName);
    });
}