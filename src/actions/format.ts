import { applyTextChanges, forEachSourceFile } from "../helpers";
import Project from "../project";
import { formatCodeSettings } from "../settings";

export function format(project: Project) {
    const languageService = project.getLanguageService();
    forEachSourceFile("Formatting files", languageService, ({ fileName }) => {
        const edits = languageService.getFormattingEditsForDocument(fileName, formatCodeSettings);
        project.setFileText(fileName, applyTextChanges(project.getFileText(fileName), edits));
    });
}