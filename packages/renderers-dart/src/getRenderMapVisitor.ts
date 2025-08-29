import {
    AccountNode,
    camelCase,
    DefinedTypeNode,
    getAllAccounts,
    getAllDefinedTypes,
    getAllInstructionsWithSubs,
    getAllPdas,
    getAllPrograms,
    pascalCase,
    PdaNode,
    resolveNestedTypeNode,
    snakeCase,
    structTypeNodeFromInstructionArgumentNodes,
} from '@codama/nodes';
import { RenderMap } from '@codama/renderers-core';
import {
    extendVisitor,
    findProgramNodeFromPath,
    LinkableDictionary,
    NodeStack,
    pipe,
    recordLinkablesOnFirstVisitVisitor,
    recordNodeStackVisitor,
    staticVisitor,
    visit,
    Visitor,
} from '@codama/visitors-core';
import { join } from 'path';

import { getTypeManifestVisitor } from './getTypeManifestVisitor';
import { ImportMap } from './ImportMap';
import TypeManifest, { extractFieldsFromTypeManifest } from './TypeManifest';
import { extractDiscriminatorBytes, getImportFromFactory, LinkOverrides, render } from './utils';
import getAllDefinedTypesInNode from './utils/getAllDefinedTypesInNode';


export type GetRenderMapOptions = {
    dependencyMap?: Record<string, string>;
    linkOverrides?: LinkOverrides;
    renderParentInstructions?: boolean;
};


// Given a type like List<SomeStruct> or Option<SomeStruct> or Set<SomeStruct>, it returns SomeStruct
function getBaseType(type: string): string {
    const match = type.match(/^(?:List|Set|Option)<([\w\d_]+)>$/);
    return match ? match[1] : type;
}

export function getRenderMapVisitor(options: GetRenderMapOptions = {}): Visitor<RenderMap,
'accountNode' | 'definedTypeNode' | 'instructionNode' | 'pdaNode' | 'programNode' | 'rootNode'
> {
    const linkables = new LinkableDictionary();
    const stack = new NodeStack();

    const renderParentInstructions = options.renderParentInstructions ?? false;
    const dependencyMap = options.dependencyMap ?? {};
    const getImportFrom = getImportFromFactory(options.linkOverrides ?? {});
    const typeManifestVisitor = getTypeManifestVisitor({ getImportFrom });

    const renderTemplate = (template: string, context?: object): string => {
        return render(join('pages', template), context);
    };

    return pipe(
        staticVisitor(() => new RenderMap(), {
            keys: [
                'rootNode',
                'programNode',
                'pdaNode',
                'instructionNode',
                'accountNode',
                'definedTypeNode',
            ],
        }),
        (v) =>
            extendVisitor(v, {
                visitAccount(node) {
                    const typeManifest: TypeManifest = visit(node, typeManifestVisitor);
                    const { imports } = typeManifest;
                    
                    imports.add('dartTypedData', new Set(['Uint8List', 'ByteData']));
                    imports.add('package:collection/collection.dart', new Set(['ListEquality']));
                    imports.add('package:solana/dto.dart', new Set(['AccountResult', 'BinaryAccountData']));
                    imports.add('package:solana/solana.dart', new Set(['RpcClient', 'Ed25519HDPublicKey']));
                    imports.add('../shared.dart', new Set(['BinaryReader', 'BinaryWriter', 'AccountNotFoundError']));
                    
                    // Find the current program node for this account using the stack path.
                    // This allows us to get all user-defined struct types for codegen and type checks.
                    const programNode = findProgramNodeFromPath(stack.getPath('accountNode'));
                    const structTypeNames = getAllDefinedTypesInNode(programNode);

                    const fields = extractFieldsFromTypeManifest(typeManifest).map(field => ({
                        ...field,
                        isStruct: structTypeNames.has(getBaseType(field.type))
                    }));

                    return new RenderMap().add(
                        `accounts/${snakeCase(node.name)}.dart`,
                        renderTemplate('accountsPage.njk', {
                            account: {
                                ...node,
                                discriminator: extractDiscriminatorBytes(node)
                            },
                            fields: fields,
                            getBaseType, // <-- Pass the function that is used to find if i have a collection
                            imports: imports
                                .remove(`generatedAccounts::${pascalCase(node.name)}`, [pascalCase(node.name)])
                                .toString(dependencyMap),
                            typeManifest,
                        }),
                    );
                },

                visitDefinedType(node) {
                    const typeManifest = visit(node, typeManifestVisitor);
                    const imports = new ImportMap().mergeWithManifest(typeManifest);

                    imports.add('../shared.dart', new Set(['BinaryReader', 'BinaryWriter', 'AccountNotFoundError']));
                    imports.add('dartTypedData', new Set(['Uint8List', 'ByteData']));

                    // This allows us to later distinguish between Object Data types and other types like string, int, arrays, etc
                    // So that when we generate the serialization logic we know which types needs special handling
                    const programNode = findProgramNodeFromPath(stack.getPath('definedTypeNode'));
                    const structTypeNames = getAllDefinedTypesInNode(programNode);
                        
                    const fields = extractFieldsFromTypeManifest(typeManifest).map(field => ({
                        ...field,
                        isStruct: structTypeNames.has(getBaseType(field.type))
                    }));

                    return new RenderMap().add(
                        `types/${snakeCase(node.name)}.dart`,
                        renderTemplate('definedTypesPage.njk', {
                            definedType: node,
                            fields: fields,
                            imports: imports.remove(`generatedTypes::${pascalCase(node.name)}`, [pascalCase(node.name)]).toString(dependencyMap),
                            typeManifest,
                        }),
                    );
                },

                visitInstruction(node) {
                    const instructionPath = stack.getPath('instructionNode');
                    const programNode = findProgramNodeFromPath(instructionPath);
                    if (!programNode) {
                        throw new Error('Instruction must be visited inside a program.');
                    }

                    const imports = new ImportMap();
                    const struct = structTypeNodeFromInstructionArgumentNodes(node.arguments);
                    const typeManifest = visit(struct, typeManifestVisitor);
                    imports.mergeWith(typeManifest.imports);

                    imports
                        .add('dartTypedData', new Set(['Uint8List']))
                        .add('package:solana/solana.dart', new Set(['Ed25519HDPublicKey']))
                        .add('package:solana/encoder.dart', new Set(['Instruction', 'AccountMeta', 'ByteArray']))
                        .add('../shared.dart', new Set(['BinaryWriter']))
                        .add('../programs.dart', new Set([`${pascalCase(programNode.name)}Program`]));

                    const importsString =
                        imports
                            .remove(`generatedInstructions::${pascalCase(node.name)}`, [pascalCase(node.name)])
                            .toString(dependencyMap) || '';

                    const args = node.arguments
                        .filter(a => a.name !== 'discriminator')
                        .map(a => {
                            const argManifest = visit(a.type, getTypeManifestVisitor({
                                getImportFrom,
                                nestedStruct: true,
                                parentName: `${pascalCase(node.name)}InstructionArgs`,
                            }));

                            imports.mergeWith(argManifest.imports);
                            const rt = resolveNestedTypeNode(a.type);
                            return {
                                dartType: argManifest.type,
                                name: camelCase(a.name),
                                resolvedType: rt,
                            };
                        });

                    const context = {
                        args,
                        imports: importsString,
                        instruction: {
                            ...node,
                            discriminator: extractDiscriminatorBytes(node),
                        },
                        program: { name: pascalCase(programNode.name || '') },
                        typeManifest: typeManifest || { nestedStructs: [] },
                    };

                    return new RenderMap().add(
                        `instructions/${snakeCase(node.name)}.dart`,
                        renderTemplate('instructionsPage.njk', context),
                    );
                },

                visitPda(node) {
                    return new RenderMap().add(
                        `pdas/${snakeCase(node.name)}.dart`,
                        renderTemplate('pdasPage.njk', {
                            pda: node,
                        }),
                    );
                },

                visitProgram(node, { self }) {
                    const renderMap = new RenderMap()
                        .mergeWith(...(node.pdas ?? []).map((p: PdaNode) => visit(p, self)))
                        .mergeWith(...node.accounts.map((account: AccountNode) => visit(account, self)))
                        .mergeWith(...node.definedTypes.map((type: DefinedTypeNode) => visit(type, self)))
                        .mergeWith(
                            ...getAllInstructionsWithSubs(node, {
                                leavesOnly: !renderParentInstructions,
                            }).map((ix) => visit(ix, self)),
                        );

                    if (node.errors.length > 0) {
                        const importsString = new ImportMap().toString(dependencyMap) || '';
                        const errorsContext = {
                            errors: node.errors || [],
                            imports: importsString,
                            program: { name: pascalCase(node.name || '') }
                        };

                        renderMap.add(
                            `errors/${snakeCase(node.name)}.dart`,
                            renderTemplate('errorsPage.njk', errorsContext),
                        );
                    }

                    return renderMap;
                },

                visitRoot(node, { self }) {
                    const programsToExport = getAllPrograms(node);
                    const pdasToExport = getAllPdas(node);
                    const accountsToExport = getAllAccounts(node);
                    const instructionsToExport = getAllInstructionsWithSubs(node, {
                        leavesOnly: !renderParentInstructions,
                    });
                    const definedTypesToExport = getAllDefinedTypes(node);
                    const hasAnythingToExport =
                        programsToExport.length > 0 ||
                        pdasToExport.length > 0 ||
                        accountsToExport.length > 0 ||
                        instructionsToExport.length > 0 ||
                        definedTypesToExport.length > 0;

                    const ctx = {
                        accountsToExport,
                        definedTypesToExport,
                        hasAnythingToExport,
                        instructionsToExport,
                        pdasToExport,
                        programsToExport,
                        root: node,
                    };

                    const map = new RenderMap();
                    if (accountsToExport.length > 0) {
                        map.add('shared.dart', renderTemplate('sharedPage.njk', ctx));
                    }
                    if (programsToExport.length > 0) {
                        const programsImports = new ImportMap().add('package:solana/solana.dart', new Set(['Ed25519HDPublicKey']));
                        map.add(
                            'programs.dart',
                            renderTemplate('programsMod.njk', {
                                ...ctx,
                                imports: programsImports.toString(dependencyMap),
                            }),
                        );
                        map.add('errors.dart', renderTemplate('errorsMod.njk', ctx));
                    }
                    if (pdasToExport.length > 0) {
                        map.add('pdas.dart', renderTemplate('pdasMod.njk', ctx));
                    }
                    if (accountsToExport.length > 0) {
                        map.add('accounts.dart', renderTemplate('accountsMod.njk', ctx));
                    }
                    if (instructionsToExport.length > 0) {
                        map.add('instructions.dart', renderTemplate('instructionsMod.njk', ctx));
                    }
                    if (definedTypesToExport.length > 0) {
                        map.add('types.dart', renderTemplate('definedTypesMod.njk', ctx));
                    }

                    return map
                        .add('lib.dart', renderTemplate('rootMod.njk', ctx))
                        .mergeWith(...getAllPrograms(node).map((p) => visit(p, self)));
                },
            }),
        (v) => recordNodeStackVisitor(v, stack),
        (v) => recordLinkablesOnFirstVisitVisitor(v, linkables),
    );
}
