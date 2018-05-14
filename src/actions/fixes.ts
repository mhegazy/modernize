import ts from "typescript";
import { applyTextChanges, forEachSourceFile, applyFileTextChanges } from "../helpers";
import tsinternal from "../internal";
import Project from "../project";
import { formatCodeSettings, userPrefrences } from "../settings";

export function convertToESModules(project: Project) {
    applyQuickFixes("Convert CJS modules to ES modules", [tsinternal.Diagnostics.File_is_a_CommonJS_module_it_may_be_converted_to_an_ES6_module.code], project);
}

export function convertConstructorFunctionsToESClasses(project: Project) {
    applyQuickFixes("Convert constructor functions to ES classes", [tsinternal.Diagnostics.This_constructor_function_may_be_converted_to_a_class_declaration.code], project);
}

export function convertJSDocToTypeAnnoatations(project: Project) {
    applyQuickFixes("Convert JSDoc types to TS types", [tsinternal.Diagnostics.JSDoc_types_may_be_moved_to_TypeScript_types.code], project);
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
    ], project);
}

function applyQuickFixes(message: string, diagnosticMessageCodes: number[], project: Project) {
    const languageService = project.getLanguageService();
    forEachSourceFile(`${message}`, languageService, sourceFile => {
        const diagnostics = [
            ...languageService.getSyntacticDiagnostics(sourceFile.fileName),
            ...languageService.getSemanticDiagnostics(sourceFile.fileName),
            ...languageService.getSuggestionDiagnostics(sourceFile.fileName)
        ].filter(d => diagnosticMessageCodes.includes(d.code));

        for (const diagnostic of diagnostics) {
            const fileName = diagnostic.file!.fileName;
            // console.log(`-------------------> Found diagnostic ${ts.DiagnosticCategory[diagnostic.category]} ${diagnostic.code} ${diagnostic.messageText}`);
            const actions = languageService.getCodeFixesAtPosition(fileName, diagnostic.start!, diagnostic.start! + diagnostic.length!, [diagnostic.code], formatCodeSettings, userPrefrences);
            for (const action of actions) {
                applyFileTextChanges(project, action.changes);
            }
        }
    });
}

export function fixMissingPropertyDeclarations(project: Project) {
    applyQuickFixes("Add missing property declarations", [tsinternal.Diagnostics.Property_0_does_not_exist_on_type_1.code], project);
}
