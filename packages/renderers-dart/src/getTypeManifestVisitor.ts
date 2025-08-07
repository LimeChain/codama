import {
    REGISTERED_TYPE_NODE_KINDS,
    REGISTERED_VALUE_NODE_KINDS,
    isNode,
    pascalCase,
    snakeCase,
    structTypeNodeFromInstructionArgumentNodes,
    parseDocs
} from '@codama/nodes';
import { extendVisitor, mergeVisitor, pipe, visit } from '@codama/visitors-core';

import { dartDocblock } from './utils';
import { ImportMap } from './ImportMap';


export type TypeManifest = {
    imports: ImportMap;
    type: string;
    nestedStructs: string[];
};

export type GetImportFromFunction = (node: any) => string;

export type TypeManifestOptions = {
    getImportFrom: GetImportFromFunction;
    nestedStruct?: boolean;
    parentName?: string | null;
};

export function getTypeManifestVisitor(options: TypeManifestOptions) {
    const { getImportFrom } = options;
    let parentName: string | null = options.parentName ?? null;
    let nestedStruct: boolean = options.nestedStruct ?? false;
    let inlineStruct: boolean = false;

    return pipe(
        mergeVisitor(
            (): TypeManifest => ({ imports: new ImportMap(), type: '', nestedStructs: [] }),
            (_: any, values: any[]) => ({
                imports: new ImportMap().mergeWith(...values.map((v: any) => v.imports)),
                type: values.map((v: any) => v.type).join('\n'),
                nestedStructs: values.flatMap((v: any) => v.nestedStructs),
            }),
            {
                keys: [
                    ...REGISTERED_TYPE_NODE_KINDS,
                    ...REGISTERED_VALUE_NODE_KINDS,
                    'definedTypeLinkNode',
                    'definedTypeNode',
                    'accountNode',
                    'instructionNode',
                ],
            }
        ),
        (v: any) =>
            extendVisitor(v, {
                visitAccount(account: any, { self }: { self: any }) {
                    parentName = pascalCase(account.name);
                    const manifest = visit(account.data, self) as TypeManifest;
                    parentName = null;
                    return manifest;
                },

                visitArrayType(arrayType: any, { self }: { self: any }) {
                    const childManifest = visit(arrayType.item, self) as TypeManifest;

                    if (isNode(arrayType.count, 'fixedCountNode')) {
                        return {
                            ...childManifest,
                            type: `List<${childManifest.type}> /* length: ${arrayType.count.value} */`,
                        };
                    }

                    return {
                        ...childManifest,
                        type: `List<${childManifest.type}>`,
                    };
                },

                visitBooleanType(_booleanType: any) {
                    return {
                        imports: new ImportMap(),
                        type: 'bool',
                        nestedStructs: [],
                    };
                },

                visitBytesType() {
                    return {
                        imports: new ImportMap().add('dart:typed_data', ['Uint8List']),
                        type: 'Uint8List',
                        nestedStructs: [],
                    };
                },

                visitDefinedType(definedType: any, { self }: { self: any }) {
                    parentName = pascalCase(definedType.name);
                    const manifest = visit(definedType.type, self) as TypeManifest;
                    parentName = null;

                    const renderedType = isNode(definedType.type, ['enumTypeNode', 'structTypeNode'])
                        ? manifest.type
                        : `typedef ${pascalCase(definedType.name)} = ${manifest.type};`;

                    return { ...manifest, type: renderedType };
                },

                visitDefinedTypeLink(node: any) {
                    const pascal = pascalCase(node.name);
                    const importFrom = getImportFrom(node);
                    return {
                        imports: new ImportMap().add(`${importFrom}::${pascal}`, [pascal]),
                        type: pascal,
                        nestedStructs: [],
                    };
                },

                visitEnumEmptyVariantType(enumEmptyVariantType: any) {
                    const name = pascalCase(enumEmptyVariantType.name);
                    return {
                        imports: new ImportMap(),
                        nestedStructs: [],
                        type: `${name},`,
                    };
                },

                visitEnumStructVariantType(enumStructVariantType: any, { self }: { self: any }) {
                    const name = pascalCase(enumStructVariantType.name);
                    const originalParentName = parentName;

                    // Use a default name if no parent name is available
                    const variantParentName = originalParentName || 'AnonymousEnum';

                    inlineStruct = true;
                    parentName = pascalCase(variantParentName) + name;
                    const typeManifest = visit(enumStructVariantType.struct, self) as TypeManifest;
                    inlineStruct = false;
                    parentName = originalParentName;

                    return {
                        ...typeManifest,
                        type: `${name} ${typeManifest.type},`,
                    };
                },

                visitEnumTupleVariantType(enumTupleVariantType: any, { self }: { self: any }) {
                    const name = pascalCase(enumTupleVariantType.name);
                    const originalParentName = parentName;

                    // Use a default name if no parent name is available
                    const variantParentName = originalParentName || 'AnonymousEnum';

                    parentName = pascalCase(variantParentName) + name;
                    const childManifest = visit(enumTupleVariantType.tuple, self) as TypeManifest;
                    parentName = originalParentName;

                    return {
                        ...childManifest,
                        type: `${name}${childManifest.type},`,
                    };
                },

                visitEnumType(enumType: any, { self }: { self: any }) {
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const enumName = originalParentName || 'AnonymousEnum';

                    const variants = enumType.variants.map((variant: any) =>
                        visit(variant, self) as TypeManifest
                    );
                    const variantNames = variants.map((variant: any) => variant.type).join('\n');
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...variants.map((v: any) => v.imports)),
                        nestedStructs: variants.flatMap((v: any) => v.nestedStructs),
                    };

                    return {
                        ...mergedManifest,
                        type: `enum ${pascalCase(enumName)} {
${variantNames}
}`,
                    };
                },

                visitFixedSizeType(fixedSizeType: any, { self }: { self: any }) {
                    const manifest = visit(fixedSizeType.type, self) as TypeManifest;
                    return manifest;
                },

                visitInstruction(instruction: any, { self }: { self: any }) {
                    const originalParentName = parentName;
                    parentName = pascalCase(instruction.name);
                    const struct = structTypeNodeFromInstructionArgumentNodes(instruction.arguments);
                    const manifest = visit(struct, self) as TypeManifest;
                    parentName = originalParentName;
                    return manifest;
                },

                visitMapType(mapType: any, { self }: { self: any }) {
                    const key = visit(mapType.key, self) as TypeManifest;
                    const value = visit(mapType.value, self) as TypeManifest;
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(key.imports, value.imports),
                        nestedStructs: [...key.nestedStructs, ...value.nestedStructs],
                    };
                    return {
                        ...mergedManifest,
                        type: `Map<${key.type}, ${value.type}>`,
                    };
                },

                visitNumberType(numberType: any) {
                    switch (numberType.format) {
                        case 'u8':
                        case 'u16':
                        case 'u32':
                        case 'i8':
                        case 'i16':
                        case 'i32':
                            return {
                                imports: new ImportMap(),
                                type: 'int',
                                nestedStructs: [],
                            };
                        case 'u64':
                        case 'i64':
                        case 'u128':
                        case 'i128':
                            return {
                                imports: new ImportMap(),
                                type: 'BigInt',
                                nestedStructs: [],
                            };
                        case 'shortU16':
                            return {
                                imports: new ImportMap(),
                                type: 'int',
                                nestedStructs: [],
                            };
                        default:
                            throw new Error(`Unknown number format: ${numberType.format}`);
                    }
                },

                visitOptionType(optionType: any, { self }: { self: any }) {
                    const childManifest = visit(optionType.item, self) as TypeManifest;

                    return {
                        ...childManifest,
                        type: `${childManifest.type}?`,
                    };
                },

                visitPublicKeyType() {
                    return {
                        imports: new ImportMap().add('package:solana/solana.dart', ['Ed25519HDPublicKey']),
                        type: 'Ed25519HDPublicKey',
                        nestedStructs: [],
                    };
                },

                visitSetType(setType: any, { self }: { self: any }) {
                    const childManifest = visit(setType.item, self) as TypeManifest;
                    return {
                        ...childManifest,
                        type: `Set<${childManifest.type}>`,
                    };
                },

                visitSizePrefixType(sizePrefixType: any, { self }: { self: any }) {
                    const manifest = visit(sizePrefixType.type, self) as TypeManifest;
                    return manifest;
                },

                visitStringType() {
                    return {
                        imports: new ImportMap(),
                        type: 'String',
                        nestedStructs: [],
                    };
                },

                visitStructFieldType(structFieldType: any, { self }: { self: any }) {
                    const originalParentName = parentName;
                    const originalInlineStruct = inlineStruct;
                    const originalNestedStruct = nestedStruct;

                    const fieldParentName = originalParentName || 'AnonymousStruct';

                    parentName = pascalCase(fieldParentName) + pascalCase(structFieldType.name);
                    nestedStruct = true;
                    inlineStruct = false;

                    const fieldManifest = visit(structFieldType.type, self) as TypeManifest;

                    parentName = originalParentName;
                    inlineStruct = originalInlineStruct;
                    nestedStruct = originalNestedStruct;

                    const fieldName = snakeCase(structFieldType.name);
                    const docblock = dartDocblock(parseDocs(structFieldType.docs));

                    return {
                        ...fieldManifest,
                        type: fieldManifest.type,
                        nestedStructs: fieldManifest.nestedStructs,
                        imports: fieldManifest.imports,
                        field: `${docblock}  final ${fieldManifest.type} ${fieldName};`,
                    };
                },

                visitStructType(structType: any, { self }: { self: any }) {
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const structName = originalParentName || 'AnonymousStruct';

                    const fields = structType.fields.map((field: any) =>
                        visit(field, self) as TypeManifest
                    );
                    const fieldTypes = fields.map((field: any) => field.field).join('\n');
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...fields.map((f: any) => f.imports)),
                        nestedStructs: fields.flatMap((f: any) => f.nestedStructs),
                    };

                    if (nestedStruct) {
                        return {
                            ...mergedManifest,
                            nestedStructs: [
                                ...mergedManifest.nestedStructs,
                                `class ${pascalCase(structName)} {
${fieldTypes}
}`,
                            ],
                            type: pascalCase(structName),
                        };
                    }

                    if (inlineStruct) {
                        return {
                            ...mergedManifest, type: `{
${fieldTypes}
}` };
                    }

                    return {
                        ...mergedManifest,
                        type: `class ${pascalCase(structName)} {
${fieldTypes}
}`,
                    };
                },

                visitTupleType(tupleType: any, { self }: { self: any }) {
                    const items = tupleType.items.map((item: any) =>
                        visit(item, self) as TypeManifest
                    );
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...items.map((f: any) => f.imports)),
                        nestedStructs: items.flatMap((f: any) => f.nestedStructs),
                    };
                    return {
                        ...mergedManifest,
                        type: `(${items.map((item: any) => item.type).join(', ')})`,
                    };
                },

                visitDateTimeType() {
                    return {
                        imports: new ImportMap(),
                        type: 'DateTime',
                        nestedStructs: [],
                    };
                },
            }),
    );
}