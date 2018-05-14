import Project from "../project";
import { forEachSourceFile, applyFileTextChanges } from "../helpers";
import tsinternal, { ChangeTracker } from "../internal";
import { formatCodeSettings } from "../settings";
import ts from "typescript";

export function generatePropertyDeclarationsForESClasses(project: Project) {
    const languageService = project.getLanguageService();
    const program = languageService.getProgram();
    const checker = program.getTypeChecker();

    forEachSourceFile(`Generating property declarations`, languageService, sourceFile => {
        const changeTracker = tsinternal.textChanges.ChangeTracker.fromContext({ formatContext: tsinternal.formatting.getFormatContext(formatCodeSettings), host: project });
        ts.forEachChild(sourceFile, function visit(node: ts.Node) {
            if (ts.isClassLike(node)) {
                addPropertyDeclarations(sourceFile, node, changeTracker);
            }
            ts.forEachChild(node, visit);
        });

        applyFileTextChanges(project, changeTracker.getChanges());
    });

    function addPropertyDeclarations(sourceFile: ts.SourceFile, node: ts.ClassLikeDeclaration, changeTracker: ChangeTracker) {
        //  console.log(`--------------------> Processing class ${ts.getNameOfDeclaration(node)!.getText()}`);
        const symbol: ts.Symbol = ts.isClassDeclaration(node) ? checker.getSymbolAtLocation(node.name!) : (node as any).symbol;
        if (!symbol) {
            throw new Error("addPropertyDeclarations: No Symbol!!!");
        }

        // all instance members are stored in the "member" array of symbol
        if (symbol.members) {
            symbol.members.forEach(member => {
                if (member.valueDeclaration && !ts.isClassElement(member.valueDeclaration)) {
                    const type = checker.getTypeOfSymbolAtLocation(member, node);
                    const typeNode = type.flags & ts.TypeFlags.Any ? undefined : checker.typeToTypeNode(type, node);
                    // console.log(`------------------------> Property ${member.name} : ${checker.typeToString(type)}`);
                    changeTracker.insertNodeAtClassStart(sourceFile, node, ts.createProperty(undefined,
                        undefined,
                        member.name,
                        !!(member.flags & ts.SymbolFlags.Optional) ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                        /*type*/typeNode,
                        /*initializer*/ undefined));
                }
            });
        }

        // all static members are stored in the "exports" array of symbol
        if (symbol.exports) {
            symbol.exports.forEach(member => {
                if (member.valueDeclaration && !ts.isClassElement(member.valueDeclaration)) {
                    const type = checker.getTypeOfSymbolAtLocation(member, node);
                    const typeNode = type.flags & ts.TypeFlags.Any ? undefined : checker.typeToTypeNode(type, node);
                    // console.log(`------------------------> Static Property ${member.name} : ${checker.typeToString(type)}`);
                    changeTracker.insertNodeAtClassStart(sourceFile, node, ts.createProperty(undefined,
                        [ts.createToken(ts.SyntaxKind.StaticKeyword)],
                        member.name,
                        !!(member.flags & ts.SymbolFlags.Optional) ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                        /*type*/typeNode,
                        /*initializer*/ undefined));
                }
            });
        }
    }
}
