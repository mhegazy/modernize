import ts, { SourceFile, Node, PropertyAssignment, SignatureDeclaration, ConstructorDeclaration, FunctionExpression, ClassExpression, ArrowFunction, ClassLikeDeclaration, TypeParameterDeclaration, Statement, SyntaxKind, TypeNode, TextRange, ClassElement, FileTextChanges, TextChange, LanguageServiceHost, FormatCodeSettings } from "typescript";

/** TODO: export publically from TS */

const tsinternal: TSInternal = ts as any;
export default tsinternal;

interface ConfigurableStart {
    /** True to use getStart() (NB, not getFullStart()) without adjustment. */
    useNonAdjustedStartPosition?: boolean;
}
interface ConfigurableEnd {
    /** True to use getEnd() without adjustment. */
    useNonAdjustedEndPosition?: boolean;
}
declare enum Position {
    FullStart = 0,
    Start = 1
}
/**
 * Usually node.pos points to a position immediately after the previous token.
 * If this position is used as a beginning of the span to remove - it might lead to removing the trailing trivia of the previous node, i.e:
 * const x; // this is x
 *        ^ - pos for the next variable declaration will point here
 * const y; // this is y
 *        ^ - end for previous variable declaration
 * Usually leading trivia of the variable declaration 'y' should not include trailing trivia (whitespace, comment 'this is x' and newline) from the preceding
 * variable declaration and trailing trivia for 'y' should include (whitespace, comment 'this is y', newline).
 * By default when removing nodes we adjust start and end positions to respect specification of the trivia above.
 * If pos\end should be interpreted literally 'useNonAdjustedStartPosition' or 'useNonAdjustedEndPosition' should be set to true
 */
interface ConfigurableStartEnd extends ConfigurableStart, ConfigurableEnd {
}

interface InsertNodeOptions {
    /**
     * Text to be inserted before the new node
     */
    prefix?: string;
    /**
     * Text to be inserted after the new node
     */
    suffix?: string;
    /**
     * Text of inserted node will be formatted with this indentation, otherwise indentation will be inferred from the old node
     */
    indentation?: number;
    /**
     * Text of inserted node will be formatted with this delta, otherwise delta will be inferred from the new node kind
     */
    delta?: number;
    /**
     * Do not trim leading white spaces in the edit range
     */
    preserveLeadingWhitespace?: boolean;
}
interface ReplaceWithMultipleNodesOptions extends InsertNodeOptions {
    readonly joiner?: string;
}
interface ChangeNodeOptions extends ConfigurableStartEnd, InsertNodeOptions {
}
interface TextChangesContext {
    host: LanguageServiceHost;
    formatContext: FormatContext;
}
export interface FormatContext {
    readonly options: FormatCodeSettings;
    readonly getRule: object;
}

type TypeAnnotatable = ts.SignatureDeclaration | ts.VariableDeclaration | ts.ParameterDeclaration | ts.PropertyDeclaration | ts.PropertySignature;
export declare class ChangeTracker {
    private readonly newLineCharacter;
    private readonly formatContext;
    private readonly changes;
    private readonly deletedNodesInLists;
    private readonly classesWithNodesInsertedAtStart;
    static fromContext(context: TextChangesContext): ChangeTracker;
    static with(context: TextChangesContext, cb: (tracker: ChangeTracker) => void): ts.FileTextChanges[];
    /** Public for tests only. Other callers should use `ChangeTracker.with`. */
    constructor(newLineCharacter: string, formatContext: FormatContext);
    deleteRange(sourceFile: ts.SourceFile, range: ts.TextRange): this;
    /** Warning: This deletes comments too. See `copyComments` in `convertFunctionToEs6Class`. */
    deleteNode(sourceFile: ts.SourceFile, node: ts.Node, options?: ConfigurableStartEnd): this;
    deleteNodeRange(sourceFile: ts.SourceFile, startNode: ts.Node, endNode: ts.Node, options?: ConfigurableStartEnd): this;
    deleteNodeInList(sourceFile: ts.SourceFile, node: ts.Node): this;
    replaceRange(sourceFile: ts.SourceFile, range: ts.TextRange, newNode: ts.Node, options?: InsertNodeOptions): this;
    replaceNode(sourceFile: ts.SourceFile, oldNode: ts.Node, newNode: ts.Node, options?: ChangeNodeOptions): this;
    replaceNodeRange(sourceFile: ts.SourceFile, startNode: ts.Node, endNode: ts.Node, newNode: ts.Node, options?: ChangeNodeOptions): void;
    private replaceRangeWithNodes;
    replaceNodeWithNodes(sourceFile: SourceFile, oldNode: Node, newNodes: ReadonlyArray<Node>, options?: ChangeNodeOptions): this;
    replaceNodeRangeWithNodes(sourceFile: SourceFile, startNode: Node, endNode: Node, newNodes: ReadonlyArray<Node>, options?: ReplaceWithMultipleNodesOptions & ConfigurableStartEnd): this;
    replacePropertyAssignment(sourceFile: SourceFile, oldNode: PropertyAssignment, newNode: PropertyAssignment): this;
    private insertNodeAt;
    private insertNodesAt;
    insertNodeAtTopOfFile(sourceFile: ts.SourceFile, newNode: Statement, blankLineBetween: boolean): void;
    insertNodeBefore(sourceFile: SourceFile, before: Node, newNode: Node, blankLineBetween?: boolean): void;
    insertModifierBefore(sourceFile: SourceFile, modifier: SyntaxKind, before: Node): void;
    insertCommentBeforeLine(sourceFile: SourceFile, lineNumber: number, position: number, commentText: string): void;
    replaceRangeWithText(sourceFile: SourceFile, range: TextRange, text: string): void;
    private insertText;
    /** Prefer this over replacing a node with another that has a type annotation, as it avoids reformatting the other parts of the node. */
    tryInsertTypeAnnotation(sourceFile: SourceFile, node: TypeAnnotatable, type: TypeNode): void;
    insertTypeParameters(sourceFile: SourceFile, node: SignatureDeclaration, typeParameters: ReadonlyArray<TypeParameterDeclaration>): void;
    private getOptionsForInsertNodeBefore;
    insertNodeAtConstructorStart(sourceFile: SourceFile, ctr: ConstructorDeclaration, newStatement: Statement): void;
    insertNodeAtConstructorEnd(sourceFile: SourceFile, ctr: ConstructorDeclaration, newStatement: Statement): void;
    private replaceConstructorBody;
    insertNodeAtEndOfScope(sourceFile: SourceFile, scope: Node, newNode: Node): void;
    insertNodeAtClassStart(sourceFile: SourceFile, cls: ClassLikeDeclaration, newElement: ClassElement): void;
    insertNodeAfter(sourceFile: SourceFile, after: Node, newNode: Node): this;
    private getInsertNodeAfterOptions;
    insertName(sourceFile: SourceFile, node: FunctionExpression | ClassExpression | ArrowFunction, name: string): void;
    /**
     * This function should be used to insert nodes in lists when nodes don't carry separators as the part of the node range,
     * i.e. arguments in arguments lists, parameters in parameter lists etc.
     * Note that separators are part of the node in statements and class elements.
     */
    insertNodeInListAfter(sourceFile: SourceFile, after: Node, newNode: Node): this;
    private finishClassesWithNodesInsertedAtStart;
    /**
     * Note: after calling this, the TextChanges object must be discarded!
     * @param validate only for tests
     *    The reason we must validate as part of this method is that `getNonFormattedText` changes the node's positions,
     *    so we can only call this once and can't get the non-formatted text separately.
     */
    getChanges(validate?: ValidateNonFormattedText): FileTextChanges[];
}
type ValidateNonFormattedText = (node: Node, text: string) => void;


export declare enum PackageNameValidationResult {
    Ok,
    ScopedPackagesNotSupported,
    EmptyName,
    NameTooLong,
    NameStartsWithDot,
    NameStartsWithUnderscore,
    NameContainsNonURISafeCharacters
};

/* @internal */
export const enum TransformFlags {
    None = 0,

    // Facts
    // - Flags used to indicate that a node or subtree contains syntax that requires transformation.
    TypeScript = 1 << 0,
    ContainsTypeScript = 1 << 1,
    ContainsJsx = 1 << 2,
    ContainsESNext = 1 << 3,
    ContainsES2017 = 1 << 4,
    ContainsES2016 = 1 << 5,
    ES2015 = 1 << 6,
    ContainsES2015 = 1 << 7,
    Generator = 1 << 8,
    ContainsGenerator = 1 << 9,
    DestructuringAssignment = 1 << 10,
    ContainsDestructuringAssignment = 1 << 11,

    // Markers
    // - Flags used to indicate that a subtree contains a specific transformation.
    ContainsDecorators = 1 << 12,
    ContainsPropertyInitializer = 1 << 13,
    ContainsLexicalThis = 1 << 14,
    ContainsCapturedLexicalThis = 1 << 15,
    ContainsLexicalThisInComputedPropertyName = 1 << 16,
    ContainsDefaultValueAssignments = 1 << 17,
    ContainsParameterPropertyAssignments = 1 << 18,
    ContainsSpread = 1 << 19,
    ContainsObjectSpread = 1 << 20,
    ContainsRest = ContainsSpread,
    ContainsObjectRest = ContainsObjectSpread,
    ContainsComputedPropertyName = 1 << 21,
    ContainsBlockScopedBinding = 1 << 22,
    ContainsBindingPattern = 1 << 23,
    ContainsYield = 1 << 24,
    ContainsHoistedDeclarationOrCompletion = 1 << 25,
    ContainsDynamicImport = 1 << 26,
    Super = 1 << 27,
    ContainsSuper = 1 << 28,

    // Please leave this as 1 << 29.
    // It is the maximum bit we can set before we outgrow the size of a v8 small integer (SMI) on an x86 system.
    // It is a good reminder of how much room we have left
    HasComputedFlags = 1 << 29, // Transform flags have been computed.

    // Assertions
    // - Bitmasks that are used to assert facts about the syntax of a node and its subtree.
    AssertTypeScript = TypeScript | ContainsTypeScript,
    AssertJsx = ContainsJsx,
    AssertESNext = ContainsESNext,
    AssertES2017 = ContainsES2017,
    AssertES2016 = ContainsES2016,
    AssertES2015 = ES2015 | ContainsES2015,
    AssertGenerator = Generator | ContainsGenerator,
    AssertDestructuringAssignment = DestructuringAssignment | ContainsDestructuringAssignment,

    // Scope Exclusions
    // - Bitmasks that exclude flags from propagating out of a specific context
    //   into the subtree flags of their container.
    OuterExpressionExcludes = TypeScript | ES2015 | DestructuringAssignment | Generator | HasComputedFlags,
    PropertyAccessExcludes = OuterExpressionExcludes | Super,
    NodeExcludes = PropertyAccessExcludes | ContainsSuper,
    ArrowFunctionExcludes = NodeExcludes | ContainsDecorators | ContainsDefaultValueAssignments | ContainsLexicalThis | ContainsParameterPropertyAssignments | ContainsBlockScopedBinding | ContainsYield | ContainsHoistedDeclarationOrCompletion | ContainsBindingPattern | ContainsObjectRest,
    FunctionExcludes = NodeExcludes | ContainsDecorators | ContainsDefaultValueAssignments | ContainsCapturedLexicalThis | ContainsLexicalThis | ContainsParameterPropertyAssignments | ContainsBlockScopedBinding | ContainsYield | ContainsHoistedDeclarationOrCompletion | ContainsBindingPattern | ContainsObjectRest,
    ConstructorExcludes = NodeExcludes | ContainsDefaultValueAssignments | ContainsLexicalThis | ContainsCapturedLexicalThis | ContainsBlockScopedBinding | ContainsYield | ContainsHoistedDeclarationOrCompletion | ContainsBindingPattern | ContainsObjectRest,
    MethodOrAccessorExcludes = NodeExcludes | ContainsDefaultValueAssignments | ContainsLexicalThis | ContainsCapturedLexicalThis | ContainsBlockScopedBinding | ContainsYield | ContainsHoistedDeclarationOrCompletion | ContainsBindingPattern | ContainsObjectRest,
    ClassExcludes = NodeExcludes | ContainsDecorators | ContainsPropertyInitializer | ContainsLexicalThis | ContainsCapturedLexicalThis | ContainsComputedPropertyName | ContainsParameterPropertyAssignments | ContainsLexicalThisInComputedPropertyName,
    ModuleExcludes = NodeExcludes | ContainsDecorators | ContainsLexicalThis | ContainsCapturedLexicalThis | ContainsBlockScopedBinding | ContainsHoistedDeclarationOrCompletion,
    TypeExcludes = ~ContainsTypeScript,
    ObjectLiteralExcludes = NodeExcludes | ContainsDecorators | ContainsComputedPropertyName | ContainsLexicalThisInComputedPropertyName | ContainsObjectSpread,
    ArrayLiteralOrCallOrNewExcludes = NodeExcludes | ContainsSpread,
    VariableDeclarationListExcludes = NodeExcludes | ContainsBindingPattern | ContainsObjectRest,
    ParameterExcludes = NodeExcludes,
    CatchClauseExcludes = NodeExcludes | ContainsObjectRest,
    BindingPatternExcludes = NodeExcludes | ContainsRest,

    // Masks
    // - Additional bitmasks
    TypeScriptClassSyntaxMask = ContainsParameterPropertyAssignments | ContainsPropertyInitializer | ContainsDecorators,
    ES2015FunctionSyntaxMask = ContainsCapturedLexicalThis | ContainsDefaultValueAssignments,
}

interface TSInternal {
    generateTSConfig(options: ts.CompilerOptions, fileNames: ReadonlyArray<string>, newLine: string): string;
    JsTyping: {
        discoverTypings(
            host: TypingResolutionHost,
            log: ((message: string) => void) | undefined,
            fileNames: string[],
            projectRootPath: ts.Path,
            safeList: SafeList,
            packageNameToTypingLocation: ts.ReadonlyMap<CachedTyping>,
            typeAcquisition: ts.TypeAcquisition,
            unresolvedImports: ReadonlyArray<string>,
            typesRegistry: ts.ReadonlyMap<ts.MapLike<string>>): { cachedTypingPaths: string[], newTypingNames: string[], filesToWatch: string[] };
        validatePackageName(packageName: string): PackageNameValidationResult;
    },
    createMapFromTemplate<T>(template?: ts.MapLike<T>): ts.Map<T>;
    createMap<T>(): ts.Map<T>;
    isExternalModuleNameRelative(moduleName: string): boolean;
    stripQuotes(name: string): string;
    Diagnostics: Record<string, ts.DiagnosticMessage>;
    extensionFromPath(path: string): ts.Extension;
    removeExtension(path: string, extension: string): string;
    textChanges: {
        ChangeTracker: typeof ChangeTracker;
        applyChanges(text: string, changes: TextChange[]): string;
        isValidLocationToAddComment(sourceFile: SourceFile, position: number): boolean;
        useNonAdjustedPositions: ConfigurableStartEnd;
        Position: typeof Position;
    },
    formatting: {
        getFormatContext(options: FormatCodeSettings): FormatContext;
    }
}



interface TypingResolutionHost {
    directoryExists(path: string): boolean;
    fileExists(fileName: string): boolean;
    readFile(path: string, encoding?: string): string | undefined;
    readDirectory(rootDir: string, extensions: ReadonlyArray<string>, excludes: ReadonlyArray<string>, includes: ReadonlyArray<string>, depth?: number): string[];
}

function stringToInt(str: string): number {
    const n = parseInt(str, 10);
    if (isNaN(n)) {
        throw new Error(`Error in parseInt(${JSON.stringify(str)})`);
    }
    return n;
}

const isPrereleaseRegex = /^(.*)-next.\d+/;
const prereleaseSemverRegex = /^(\d+)\.(\d+)\.0-next.(\d+)$/;
const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;

export class Semver {
    static parse(semver: string): Semver {
        const isPrerelease = isPrereleaseRegex.test(semver);
        const result = Semver.tryParse(semver, isPrerelease);
        if (!result) {
            throw new Error(`Unexpected semver: ${semver} (isPrerelease: ${isPrerelease})`);
        }
        return result;
    }

    static fromRaw({ major, minor, patch, isPrerelease }: Semver): Semver {
        return new Semver(major, minor, patch, isPrerelease);
    }

    // This must parse the output of `versionString`.
    private static tryParse(semver: string, isPrerelease: boolean): Semver | undefined {
        // Per the semver spec <http://semver.org/#spec-item-2>:
        // "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."
        const rgx = isPrerelease ? prereleaseSemverRegex : semverRegex;
        const match = rgx.exec(semver);
        return match ? new Semver(stringToInt(match[1]), stringToInt(match[2]), stringToInt(match[3]), isPrerelease) : undefined;
    }

    private constructor(
        readonly major: number, readonly minor: number, readonly patch: number,
        /**
         * If true, this is `major.minor.0-next.patch`.
         * If false, this is `major.minor.patch`.
         */
        readonly isPrerelease: boolean) { }

    get versionString(): string {
        return this.isPrerelease ? `${this.major}.${this.minor}.0-next.${this.patch}` : `${this.major}.${this.minor}.${this.patch}`;
    }

    equals(sem: Semver): boolean {
        return this.major === sem.major && this.minor === sem.minor && this.patch === sem.patch && this.isPrerelease === sem.isPrerelease;
    }

    greaterThan(sem: Semver): boolean {
        return this.major > sem.major || this.major === sem.major
            && (this.minor > sem.minor || this.minor === sem.minor
                && (!this.isPrerelease && sem.isPrerelease || this.isPrerelease === sem.isPrerelease
                    && this.patch > sem.patch));
    }
}

export interface CachedTyping {
    typingLocation: string;
    version: Semver;
}

type SafeList = ts.ReadonlyMap<string>;

