import { FileTextChanges } from "typescript";
import { applyFileTextChanges, forEachSourceFile } from "../helpers";
import tsinternal from "../internal";
import Project from "../project";
import { formatCodeSettings, userPrefrences } from "../settings";

export function convertToESModules(project: Project) {
    applyQuickFixes("Convert CJS modules to ES modules", [tsinternal.Diagnostics.File_is_a_CommonJS_module_it_may_be_converted_to_an_ES6_module.code], /*fixid*/ undefined, project);
}

export function convertConstructorFunctionsToESClasses(project: Project) {
    applyQuickFixes("Convert constructor functions to ES classes", [tsinternal.Diagnostics.This_constructor_function_may_be_converted_to_a_class_declaration.code], "convertFunctionToEs6Class", project);
}

export function convertJSDocToTypeAnnoatations(project: Project) {
    applyQuickFixes("Convert JSDoc types to TS types", [tsinternal.Diagnostics.JSDoc_types_may_be_moved_to_TypeScript_types.code], "annotateWithTypeFromJSDoc", project);
}

export function inferTypeAnnoatations(project: Project) {
    applyQuickFixes("Infer types from usage", [
        tsinternal.Diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined.code,
        tsinternal.Diagnostics.Variable_0_implicitly_has_an_1_type.code,
        tsinternal.Diagnostics.Parameter_0_implicitly_has_an_1_type.code,
        tsinternal.Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code,
        tsinternal.Diagnostics.Property_0_implicitly_has_type_any_because_its_get_accessor_lacks_a_return_type_annotation.code,
        tsinternal.Diagnostics._0_which_lacks_return_type_annotation_implicitly_has_an_1_return_type.code,
        tsinternal.Diagnostics.Property_0_implicitly_has_type_any_because_its_set_accessor_lacks_a_parameter_type_annotation.code,
        tsinternal.Diagnostics.Member_0_implicitly_has_an_1_type.code
    ], "inferFromUsage", project);
}

export function fixMissingPropertyDeclarations(project: Project) {
    applyQuickFixes("Add missing property declarations", [tsinternal.Diagnostics.Property_0_does_not_exist_on_type_1.code], "addMissingMember", project);
}

function applyQuickFixes(message: string, diagnosticMessageCodes: number[], fixId: string | undefined, project: Project) {
    const languageService = project.getLanguageService();

    forEachSourceFile(`${message}`, languageService, sourceFile => {
        const diagnostics = [
            ...languageService.getSyntacticDiagnostics(sourceFile.fileName),
            ...languageService.getSemanticDiagnostics(sourceFile.fileName),
            ...languageService.getSuggestionDiagnostics(sourceFile.fileName)
        ].filter(d => diagnosticMessageCodes.includes(d.code));

        const changes: FileTextChanges[] = [];

        if (diagnostics.length) {
            if (fixId) {
                const actions = languageService.getCombinedCodeFix({ fileName: sourceFile.fileName, type: "file" }, fixId, formatCodeSettings, userPrefrences);
                changes.push(...actions.changes);
            }
            else {
                for (const diagnostic of diagnostics) {
                    const actions = languageService.getCodeFixesAtPosition(sourceFile.fileName, diagnostic.start!, diagnostic.start! + diagnostic.length!, [diagnostic.code], formatCodeSettings, userPrefrences);
                    actions.forEach(a => changes.push(...a.changes));
                }
            }
        }
        applyFileTextChanges(project, changes);
    });
}