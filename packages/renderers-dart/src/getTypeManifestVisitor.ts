import {
    ArrayTypeNode,
    isNode,
    parseDocs,
    pascalCase,
    REGISTERED_TYPE_NODE_KINDS,
    REGISTERED_VALUE_NODE_KINDS,
    snakeCase,
    structTypeNodeFromInstructionArgumentNodes,
} from '@codama/nodes';
import { extendVisitor, mergeVisitor, pipe, visit } from '@codama/visitors-core';

import { getDartTypedArrayType } from './fragments/dartTypedArray';
import { ImportMap } from './ImportMap';
import { dartDocblock } from './utils';

type TypeManifest = {
    imports: ImportMap;
    nestedStructs: string[];
    type: string;
};

export default TypeManifest;

export type GetImportFromFunction = (node: any) => string;

export type TypeManifestOptions = {
    getImportFrom: GetImportFromFunction;
    nestedStruct?: boolean;
    parentName?: string | null;
};

export const structManifestMap: Record<string, TypeManifest> = {

};

export function getTypeManifestVisitor(options: TypeManifestOptions) {
    const { getImportFrom } = options;
    let parentName: string | null = options.parentName ?? null;
    let nestedStruct: boolean = options.nestedStruct ?? false;
    let inlineStruct: boolean = false;

    return pipe(
        mergeVisitor(
            (): TypeManifest => ({ imports: new ImportMap(), nestedStructs: [], type: '' }),
            (_: any, values: any[]) => ({
                imports: new ImportMap().mergeWith(...values.map((v: any) => v.imports)),
                nestedStructs: values.flatMap((v: any) => v.nestedStructs),
                type: values.map((v: any) => v.type).join('\n'),
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
                visitAccount(account: any, { self }: { self: any }): TypeManifest {
                    parentName = pascalCase(account.name);
                    const manifest = visit(account.data, self) as TypeManifest;
                    parentName = null;
                    return manifest;
                },

                visitArrayType(arrayType: ArrayTypeNode , { self }: { self: any}): TypeManifest {
                    /*
                    ArrayTypeNode structure:
                    https://github.com/codama-idl/codama/blob/main/packages/nodes/docs/typeNodes/ArrayTypeNode.md
                    */
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                    const childManifest = visit(arrayType.item, self) as TypeManifest; // Item
                    
                    // console.log('===========Array Type ', arrayType);
                    const typedArrayManifest = getDartTypedArrayType(arrayType.item, childManifest);
                    if (typedArrayManifest) {
                        if (isNode(arrayType.count, 'fixedCountNode')) {
                            // Fixed-size typed array handler
                            return {
                                ...typedArrayManifest,
                                // type: `${typedArrayManifest.type} /* length: ${arrayType.count.value} */`,
                                type: `${typedArrayManifest.type}`,
                            };
                        }
                        return typedArrayManifest;
                    }

                    return {
                        ...childManifest,
                        type: `List<${childManifest.type}>`,
                    }
                },

                visitBooleanType(_booleanType: any): TypeManifest {
                    return {
                        imports: new ImportMap(),
                        nestedStructs: [],
                        type: 'bool',
                    };
                },

                visitBytesType(): TypeManifest {
                    return {
                        imports: new ImportMap().add('dart:typed_data', ['Uint8List']),
                        nestedStructs: [],
                        type: 'Uint8List',
                    };
                },

                visitDefinedType(definedType: any, { self }: { self: any }): TypeManifest {
                    parentName = pascalCase(definedType.name);
                    const manifest = visit(definedType.type, self) as TypeManifest;
                    parentName = null;

                    const renderedType = isNode(definedType.type, ['enumTypeNode', 'structTypeNode'])
                        ? manifest.type
                        : `typedef ${pascalCase(definedType.name)} = ${manifest.type};`;
                    
                    return { ...manifest, type: renderedType};
                },

                visitDefinedTypeLink(node: any): TypeManifest {
                    const snake_case = snakeCase(node.name); // This is the correct way to name files in Dart
                    const pascal_case = pascalCase(node.name); // This is the correct way to name types in Dart
                    // Example: types/simple_struct.dart -> SimpleStruct (is the actual type name)
                    const importFrom = getImportFrom(node);
                    return {
                        imports: new ImportMap().add(`../${importFrom}/${snake_case}.dart`, [snake_case]),
                        type: pascal_case,
                        nestedStructs: [],
                    };
                },

                visitEnumEmptyVariantType(enumEmptyVariantType: any) {
                    const name = pascalCase(enumEmptyVariantType.name);
                    return {
                        imports: new ImportMap(),
                        nestedStructs: [],
                        type: `class ${name} extends ${parentName} {}`
                    };
                },

                visitEnumStructVariantType(enumStructVariantType: any, { self }: { self: any }) {
                    const name = pascalCase(enumStructVariantType.name);
                    const originalParentName = parentName;
                    
                    inlineStruct = true;
                    // Sets the name of the parent to the variant name only
                    parentName = name;
                    const typeManifest = visit(enumStructVariantType.struct, self) as TypeManifest;
                    inlineStruct = false;
                    // Set the Parent name back to the original parent name(Enum class name)
                    parentName = originalParentName;
                    
                    return {
                        ...typeManifest,
                        type: `class ${name} extends ${parentName}
                            ${typeManifest.type}`,
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

                    const tupleTypes = childManifest.type.replace(/[()]/g, '').split(',').map(s => s.trim());
                    const fields = tupleTypes.map((type, i) => `final ${type} value${i};`).join('\n');
                    const constructorArgs = tupleTypes.map((_, i) => `this.value${i}`).join(', ');

                    return {
                        ...childManifest,
                        type: `class ${name} extends ${parentName} {
                            ${fields}

                            ${name}(${constructorArgs});
                        }`,
                    };
                },

                visitEnumType(enumType: any, { self }: { self: any }) {
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const enumName = originalParentName || 'AnonymousEnum';

                    const variants = enumType.variants.map((variant: any) => visit(variant, self) as TypeManifest);
                    const variantNames = variants.map((variant: any) => variant.type).join('\n');
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...variants.map((v: any) => v.imports)),
                        nestedStructs: variants.flatMap((v: any) => v.nestedStructs),
                    };

                    return {
                        ...mergedManifest,
                        type: `abstract class ${pascalCase(enumName)} {}
                            ${variantNames}`,
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
                                nestedStructs: [],
                                type: 'int',
                            };
                        case 'u64':
                        case 'i64':
                        case 'u128':
                        case 'i128':
                            return {
                                imports: new ImportMap(),
                                nestedStructs: [],
                                type: 'BigInt',
                            };
                        case 'shortU16':
                            return {
                                imports: new ImportMap(),
                                nestedStructs: [],
                                type: 'int',
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
                        nestedStructs: [],
                        type: 'Ed25519HDPublicKey',
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
                        nestedStructs: [],
                        type: 'String',

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
                        field: `${docblock} final ${fieldManifest.type} ${fieldName};`,
                        imports: fieldManifest.imports,
                        nestedStructs: fieldManifest.nestedStructs,
                        type: fieldManifest.type,                    
                    };
                },

                visitStructType(structType: any, { self }: { self: any }) {
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const structName = originalParentName || 'AnonymousStruct';
                    
                    // In Dart, every variable must be initialized, either via constructor or with a default value.
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    const classConstrutor = `  ${pascalCase(structName)}({\n${structType.fields.map((field: any) => `    required this.${snakeCase(field.name)},`).join('\n')}\n  });\n`;
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
                            isStruct: true,
                            nestedStructs: [
                                ...mergedManifest.nestedStructs,
                                `class ${pascalCase(structName)} {
                                ${fieldTypes}

                                ${classConstrutor}
                                }`,
                            ],
                            type: pascalCase(structName),
                        };
                    }

                    if (inlineStruct) {
                        return {
                            ...mergedManifest, type: `{
                            ${fieldTypes}

                            ${classConstrutor}
                            }` 
                        };
                    }

                    return {
                        ...mergedManifest,
                        type: `class ${pascalCase(structName)} {
                        ${fieldTypes}

                        ${classConstrutor}
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
                        nestedStructs: [],
                        type: 'DateTime',
                    };
                },
            }),
    );
}