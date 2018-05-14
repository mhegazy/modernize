import { applyFileTextChanges, forEachSourceFile } from "../helpers";
import Project from "../project";
import { formatCodeSettings, userPrefrences } from "../settings";

export function organizeImports(project: Project) {
    const languageService = project.getLanguageService();
    forEachSourceFile("Organize imports", languageService, ({ fileName }) => {
        applyFileTextChanges(project, languageService.organizeImports({ fileName, type: "file" }, formatCodeSettings, userPrefrences));
    });
}