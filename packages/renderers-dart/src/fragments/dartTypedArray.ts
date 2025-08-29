import { pascalCase, TypeNode } from '@codama/nodes';

import TypeManifest from '../getTypeManifestVisitor';
import { ImportMap} from '../ImportMap';
/**
 * Utility for mapping Rust number formats to Dart typed array types.
 * 
 * Provides a function to convert a number type format (e.g. 'u8', 'i16', etc.)
 * into the corresponding Dart typed array (Uint8List, Int16List, etc.) 
 * and generate the serialization/deserialization borsch methods
 */

const numberFormatToDartType: Record<string, string> = {
    i16: 'Int16List',
    i32: 'Int32List',
    i64: 'Int64List',
    i8: 'Int8List',
    u16: 'Uint16List',
    u32: 'Uint32List',
    u64: 'Uint64List',
    u8: 'Uint8List',
};

export function getDartTypedArrayType(item: TypeNode, childManifest: TypeManifest) {
    
    // Handle string arrays
    if (item?.kind === 'sizePrefixTypeNode' && item.type?.kind === 'stringTypeNode') {
        return {
            ...childManifest,
            type: 'List<String>',
        };
    }

    // Handle struct arrays
    if (item?.kind === 'definedTypeLinkNode') {
        const structName = pascalCase(item.name);
        return {
            ...childManifest,
            type: `List<${structName}>`,
        }
    }

    // Handle number arrays
    if (item.kind === 'numberTypeNode' && 'format' in item) {
        if (item?.format && numberFormatToDartType[item.format]) {
            return {
                ...childManifest,
                imports: new ImportMap().add('dart:typed_data', [numberFormatToDartType[item.format]]),
                type: numberFormatToDartType[item.format],
            };
        }
    }

    // Fallback: generic Dart list
    return {
        ...childManifest,
        type: `List<${childManifest.type}>`,
    };

}