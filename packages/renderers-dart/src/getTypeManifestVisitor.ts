import {
    AccountNode,
    ArrayTypeNode,
    BooleanTypeNode,
    DefinedTypeLinkNode,
    DefinedTypeNode,
    EnumEmptyVariantTypeNode,
    EnumStructVariantTypeNode,
    EnumTupleVariantTypeNode,
    EnumTypeNode,
    FixedSizeTypeNode,
    InstructionNode,
    isNode,
    MapTypeNode,
    NumberTypeNode,
    OptionTypeNode,
    parseDocs,
    pascalCase,
    REGISTERED_TYPE_NODE_KINDS,
    REGISTERED_VALUE_NODE_KINDS,
    SetTypeNode,
    SizePrefixTypeNode,
    snakeCase,
    StructFieldTypeNode,
    StructTypeNode,
    structTypeNodeFromInstructionArgumentNodes,
    TupleTypeNode,
} from '@codama/nodes';
import { extendVisitor, mergeVisitor, pipe, visit, Visitor } from '@codama/visitors-core';

import { getDartTypedArrayType } from './fragments/dartTypedArray';
import { ImportMap } from './ImportMap';
import TypeManifest, { TypeManifestOptions } from './TypeManifest';
import { dartDocblock } from './utils';


export function getTypeManifestVisitor(options: TypeManifestOptions) {
    const { getImportFrom } = options;
    let parentName: string | null = options.parentName ?? null;
    let nestedStruct: boolean = options.nestedStruct ?? false;
    let inlineStruct: boolean = false;

    return pipe(
        mergeVisitor(
            (): TypeManifest => ({ imports: new ImportMap(), nestedStructs: [], type: '' }),
            (_: unknown, values: TypeManifest[]) => ({
                imports: new ImportMap().mergeWith(...values.map((v) => v.imports)),
                nestedStructs: values.flatMap((v) => v.nestedStructs),
                type: values.map((v) => v.type).join('\n'),
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
        ) as Visitor<TypeManifest>,

        (v: Visitor<TypeManifest>) =>
            extendVisitor(v, {
                visitAccount(account: AccountNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    parentName = pascalCase(account.name);
                    const manifest = visit(account.data, self);
                    parentName = null;
                    return manifest;
                },

                visitArrayType(arrayType: ArrayTypeNode , { self }: { self: Visitor<TypeManifest>}): TypeManifest {
                    /*
                        ArrayTypeNode structure:
                        https://github.com/codama-idl/codama/blob/main/packages/nodes/docs/typeNodes/ArrayTypeNode.md
                    */
                    const childManifest = visit(arrayType.item, self); // Item
                    
                    const typedArrayManifest = getDartTypedArrayType(arrayType.item, childManifest);
                    if (typedArrayManifest) {
                        if (isNode(arrayType.count, 'fixedCountNode')) {
                            // Fixed-size typed array handler
                            return {
                                ...typedArrayManifest,
                                // If is a fixed-sized array, include the length in a comment so i can extract that using regex
                                type: `${typedArrayManifest.type} /* length: ${arrayType.count.value} */`,
                            };
                        }
                        return typedArrayManifest;
                    }

                    return {
                        ...childManifest,
                        type: `List<${childManifest.type}>`,
                    }
                },

                visitBooleanType(_booleanType: BooleanTypeNode): TypeManifest {
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

                visitDefinedType(definedType: DefinedTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    parentName = pascalCase(definedType.name);
                    const manifest = visit(definedType.type, self);
                    parentName = null;

                    const renderedType = isNode(definedType.type, ['enumTypeNode', 'structTypeNode'])
                        ? manifest.type
                        : `typedef ${pascalCase(definedType.name)} = ${manifest.type};`;
                    
                    return { ...manifest, type: renderedType};
                },

                visitDefinedTypeLink(node: DefinedTypeLinkNode): TypeManifest {
                    const snake_case = snakeCase(node.name); // This is the correct way to name files in Dart
                    const pascal_case = pascalCase(node.name); // This is the correct way to name types in Dart
                    // Example: types/simple_struct.dart -> SimpleStruct (is the actual type name)
                    const importFrom = getImportFrom(node);

                    return {
                        imports: new ImportMap().add(`../${importFrom}/${snake_case}.dart`, [snake_case]),
                        nestedStructs: [],
                        type: pascal_case,
                    };
                },

                visitEnumEmptyVariantType(enumEmptyVariantType: EnumEmptyVariantTypeNode): TypeManifest {
                    const name = pascalCase(enumEmptyVariantType.name);
                    return {
                        imports: new ImportMap(),
                        nestedStructs: [],
                        type: `class ${name} extends ${parentName} {}`
                    };
                },

                visitEnumStructVariantType(enumStructVariantType: EnumStructVariantTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const name = pascalCase(enumStructVariantType.name);
                    const originalParentName = parentName;
                    
                    inlineStruct = true;
                    // Sets the name of the parent to the variant name only
                    parentName = name;
                    const typeManifest = visit(enumStructVariantType.struct, self);
                    inlineStruct = false;
                    // Set the Parent name back to the original parent name(Enum class name)
                    parentName = originalParentName;
                    
                    return {
                        ...typeManifest,
                        type: `class ${name} extends ${parentName}
                            ${typeManifest.type}`,
                    };
                },

                visitEnumTupleVariantType(enumTupleVariantType: EnumTupleVariantTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const name = pascalCase(enumTupleVariantType.name);
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const variantParentName = originalParentName || 'AnonymousEnum';

                    parentName = pascalCase(variantParentName) + name;
                    const childManifest = visit(enumTupleVariantType.tuple, self);
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

                visitEnumType(enumType: EnumTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const enumName = originalParentName || 'AnonymousEnum';

                    const variants = enumType.variants.map((variant) => visit(variant, self));

                    const variantNames = variants.map((variant) => variant.type).join('\n');

                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...variants.map((v) => v.imports)),
                        nestedStructs: variants.flatMap((v) => v.nestedStructs),
                    };

                    return {
                        ...mergedManifest,
                        type: `abstract class ${pascalCase(enumName)} {}
                            ${variantNames}`,
                    };
                },

                visitFixedSizeType(fixedSizeType: FixedSizeTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const manifest = visit(fixedSizeType.type, self);
                    return manifest;
                },

                visitInstruction(instruction: InstructionNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const originalParentName = parentName;
                    parentName = pascalCase(instruction.name);
                    const struct = structTypeNodeFromInstructionArgumentNodes(instruction.arguments);
                    const manifest = visit(struct, self);
                    parentName = originalParentName;
                    return manifest;
                },

                visitMapType(mapType: MapTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const key = visit(mapType.key, self);
                    const value = visit(mapType.value, self);
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(key.imports, value.imports),
                        nestedStructs: [...key.nestedStructs, ...value.nestedStructs],
                    };
                    return {
                        ...mergedManifest,
                        type: `Map<${key.type}, ${value.type}>`,
                    };
                },

                visitNumberType(numberType: NumberTypeNode): TypeManifest {
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

                visitOptionType(optionType: OptionTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const childManifest = visit(optionType.item, self);

                     // Regex to split type and comment (e.g., 'Uint32List /* length: 2 */')
                    const typeMatch = childManifest.type.match(/^([^\s]+)(.*)$/);
                    let typeWithOptional: string;

                    if (typeMatch) {
                        typeWithOptional = `${typeMatch[1]}?${typeMatch[2]}`;
                    } else {
                        // Fallback if regex fails
                        typeWithOptional = `${childManifest.type}?`;
                    }
            
                    return {
                        ...childManifest,
                        type: typeWithOptional,
                    };
                },

                visitPublicKeyType() {
                    return {
                        imports: new ImportMap().add('package:solana/solana.dart', ['Ed25519HDPublicKey']),
                        nestedStructs: [],
                        type: 'Ed25519HDPublicKey',
                    };
                },

                visitSetType(setType: SetTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const childManifest = visit(setType.item, self);
                    return {
                        ...childManifest,
                        type: `Set<${childManifest.type}>`,
                    };
                },

                visitSizePrefixType(sizePrefixType: SizePrefixTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const manifest = visit(sizePrefixType.type, self);
                    return manifest;
                },

                visitStringType() {
                    return {
                        imports: new ImportMap(),
                        nestedStructs: [],
                        type: 'String',

                    };
                },

                visitStructFieldType(structFieldType: StructFieldTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const originalParentName = parentName;
                    const originalInlineStruct = inlineStruct;
                    const originalNestedStruct = nestedStruct;
                    const fieldParentName = originalParentName || 'AnonymousStruct';

                    parentName = pascalCase(fieldParentName) + pascalCase(structFieldType.name);
                    nestedStruct = true;
                    inlineStruct = false;

                    const fieldManifest = visit(structFieldType.type, self);
                    
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

                visitStructType(structType: StructTypeNode, { self }: { self: Visitor<TypeManifest> }) {
                    const originalParentName = parentName;
                    // Use a default name if no parent name is available
                    const structName = originalParentName || 'AnonymousStruct';
                    
                    // In Dart, every variable must be initialized, either via constructor or with a default value.
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    const classConstrutor = `  ${pascalCase(structName)}({\n${structType.fields.map((field) => `    required this.${snakeCase(field.name)},`).join('\n')}\n  });\n`;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const fields = structType.fields.map((field: StructFieldTypeNode) =>
                        visit(field, self)
                    );

                    const fieldTypes = fields.map((field) => field.field).join('\n');
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...fields.map((f) => f.imports)),
                        nestedStructs: fields.flatMap((f) => f.nestedStructs),
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

                visitTupleType(tupleType: TupleTypeNode, { self }: { self: Visitor<TypeManifest> }): TypeManifest {
                    const items = tupleType.items.map((item) =>
                        visit(item, self)
                    );
                    const mergedManifest = {
                        imports: new ImportMap().mergeWith(...items.map((f) => f.imports)),
                        nestedStructs: items.flatMap((f) => f.nestedStructs),
                    };
                    return {
                        ...mergedManifest,
                        type: `(${items.map((item) => item.type).join(', ')})`,
                    };
                },

                // eslint-disable-next-line sort-keys-fix/sort-keys-fix
                visitDateTimeType(): TypeManifest {
                    return {
                        imports: new ImportMap(),
                        nestedStructs: [],
                        type: 'DateTime',
                    };
                },
            }),
    );
}
