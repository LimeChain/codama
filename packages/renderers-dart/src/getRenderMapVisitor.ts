import { logWarn } from '@codama/errors';
import {
    getAllAccounts,
    getAllDefinedTypes,
    getAllInstructionsWithSubs,
    getAllPdas,
    getAllPrograms,
    InstructionNode,
    pascalCase,
    snakeCase,
    resolveNestedTypeNode,
    structTypeNodeFromInstructionArgumentNodes,
    AccountNode,
    isNode,
    ConstantDiscriminatorNode,
} from '@codama/nodes';
import { RenderMap } from '@codama/renderers-core';
import {
    extendVisitor,
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

import { getTypeManifestVisitor, TypeManifest } from './getTypeManifestVisitor';
import { ImportMap } from './ImportMap';
import { getImportFromFactory, LinkOverrides, render } from './utils';

export type GetRenderMapOptions = {
    dependencyMap?: Record<string, string>;
    linkOverrides?: LinkOverrides;
    renderParentInstructions?: boolean;
};

function extractDiscriminatorBytes(node: AccountNode): number[] {
    const d = (node.discriminators ?? []).find(
        (d): d is ConstantDiscriminatorNode => d.kind === 'constantDiscriminatorNode',
    );

    if (d && isNode(d.constant?.value, 'arrayValueNode')) {
        const elements = d.constant.value.items;
        if (
            Array.isArray(elements) &&
            elements.every((el) => isNode(el, 'numberValueNode'))
        ) {
            return elements.map((el) => el.number);
        }
    }

    const fields = resolveNestedTypeNode(node.data).fields;
    const discriminatorField = fields.find((f) => f.name === 'discriminator');
    if (
        discriminatorField &&
        isNode(discriminatorField.defaultValue, 'bytesValueNode') &&
        typeof discriminatorField.defaultValue.data === 'string'
    ) {
        const hex = discriminatorField.defaultValue.data;
        const buffer = Buffer.from(hex, 'hex');
        return Array.from(buffer);
    }

    return [];
}


function extractFieldsFromTypeManifest(typeManifest: TypeManifest): { name: string, type: string, field: string }[] {
    return typeManifest.type
        .split('\n')
        .map((line) => {
            const match = line.trim().match(/^final\s+([\w<>, ?]+)\s+(\w+);$/);
            if (match && match[2] !== 'discriminator') {
                return {
                    name: match[2],
                    type: match[1].replace(/\?$/, ''),
                    field: line,
                };
            }
            return null;
        })
        .filter((entry): entry is { name: string; type: string; field: string } => entry !== null);
}


export function getRenderMapVisitor(options: GetRenderMapOptions = {}): Visitor<RenderMap,
    | 'rootNode'
    | 'programNode'
    | 'pdaNode'
    | 'instructionNode'
    | 'accountNode'
    | 'definedTypeNode'
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
                    const typeManifest = visit(node, typeManifestVisitor) as TypeManifest;
                    const { imports } = typeManifest;

                    return new RenderMap().add(
                        `accounts/${snakeCase(node.name)}.dart`,
                        renderTemplate('accountsPage.njk', {
                            account: {
                                ...node,
                                discriminator: extractDiscriminatorBytes(node)
                            },
                            imports: imports
                                .remove(`generatedAccounts::${pascalCase(node.name)}`, [pascalCase(node.name)])
                                .toString(dependencyMap),
                            typeManifest,
                            fields: extractFieldsFromTypeManifest(typeManifest),

                        }),
                    );
                },

                visitDefinedType(node) {
                    const typeManifest = visit(node, typeManifestVisitor) as TypeManifest;
                    const imports = new ImportMap().mergeWithManifest(typeManifest);

                    return new RenderMap().add(
                        `types/${snakeCase(node.name)}.dart`,
                        renderTemplate('definedTypesPage.njk', {
                            definedType: node,
                            imports: imports.remove(`generatedTypes::${pascalCase(node.name)}`, [pascalCase(node.name)]).toString(dependencyMap),
                            typeManifest,
                        }),
                    );
                },

                visitInstruction(node) {
                    const imports = new ImportMap();
                    const accountsAndArgsConflicts = getConflictsForInstructionAccountsAndArgs(node);
                    if (accountsAndArgsConflicts.length > 0) {
                        logWarn(
                            `[Dart] Accounts and args of instruction [${node.name}] have the following ` +
                            `conflicting attributes [${accountsAndArgsConflicts.join(', ')}]. ` +
                            `Thus, the conflicting arguments will be suffixed with "_arg". ` +
                            'You may want to rename the conflicting attributes.',
                        );
                    }

                    const struct = structTypeNodeFromInstructionArgumentNodes(node.arguments);
                    const typeManifest = visit(struct, typeManifestVisitor) as TypeManifest;
                    imports.mergeWith(typeManifest.imports);

                    const hasArgs = node.arguments && node.arguments.length > 0;

                    const importsString = imports
                        .remove(`generatedInstructions::${pascalCase(node.name)}`, [pascalCase(node.name)])
                        .toString(dependencyMap) || '';

                    const context = {
                        imports: importsString,
                        instruction: node,
                        typeManifest: typeManifest || { nestedStructs: [] },
                        hasArgs,
                        program: { name: pascalCase(node.name || '') }
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
                        .mergeWith(...(node.pdas ?? []).map((p: any) => visit(p, self)))
                        .mergeWith(...node.accounts.map((account: any) => visit(account, self)))
                        .mergeWith(...node.definedTypes.map((type: any) => visit(type, self)))
                        .mergeWith(
                            ...getAllInstructionsWithSubs(node, {
                                leavesOnly: !renderParentInstructions,
                            }).map((ix: any) => visit(ix, self)),
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
                        programsToExport,
                        pdasToExport,
                        accountsToExport,
                        instructionsToExport,
                        definedTypesToExport,
                        hasAnythingToExport,
                        root: node,
                    };

                    const map = new RenderMap();
                    if (accountsToExport.length > 0) {
                        map.add('shared.dart', renderTemplate('sharedPage.njk', ctx));
                    }
                    if (programsToExport.length > 0) {
                        map.add('programs.dart', renderTemplate('programsMod.njk', ctx));
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
                        .mergeWith(...getAllPrograms(node).map((p: any) => visit(p, self)));
                },
            }),
        (v) => recordNodeStackVisitor(v, stack),
        (v) => recordLinkablesOnFirstVisitVisitor(v, linkables),
    );
}

function getConflictsForInstructionAccountsAndArgs(instruction: InstructionNode): string[] {
    const allNames = [
        ...instruction.accounts.map((account: any) => account.name),
        ...instruction.arguments.map((argument: any) => argument.name),
    ];
    const duplicates = allNames.filter((e, i, a) => a.indexOf(e) !== i);
    return [...new Set(duplicates)];
}
