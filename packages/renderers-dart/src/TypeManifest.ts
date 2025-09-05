import { ImportMap } from "./ImportMap";


type TypeManifest = {
    imports: ImportMap;
    nestedStructs: string[];
    type: string;
    // eslint-disable-next-line typescript-sort-keys/interface
    field?: string;
};

export default TypeManifest;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GetImportFromFunction = (node: any) => string;

export type TypeManifestOptions = {
    getImportFrom: GetImportFromFunction;
    nestedStruct?: boolean;
    parentName?: string | null;
};

export interface TypeManifestField {
  baseType: string;
  field: string;
  format?: string; // Since dart have `int` or `BigInt` i need to know the original format to handle the borsh read/write
  name: string;
  nesting: number;
  optional: boolean;
  size?: number; // In case of fixed-sized i need to know the size to handle the borsh read/write
  type: string;
}


// '  final Int64List i64_array;\n' +
// '  final Int8List /* length: 2 */ fixed_i8;\n' +
export function extractFieldsFromTypeManifest(typeManifest: TypeManifest): TypeManifestField[] {
    return typeManifest.type
        .split('\n')
        .map((line): TypeManifestField | null => {
            // That handles lines like: final Uint8List fieldName; and extracts the type and name in order to be used from borsh readers/writers
            const match = line.trim().match(/^final\s+([\w<>, ?]+)(?:\s*\/\*.*?\*\/)*\s+(\w+);$/);
            if (match && match[2] !== 'discriminator') {
                let size: number | undefined; // Placeholder for size extraction logic if needed
                let format: string | undefined; // Placeholder for format extraction logic if needed

                const isOptional = /\?$/.test(match[1].trim()); // check if the string ends with a '?'
                const rawType = match[1].replace(/\?$/, '').trim();
                
                const lengthMatch = line.match(/\/\*\s*length:\s*(\d+)\s*\*\//); // Extract length if present
                if (lengthMatch) {
                    size = parseInt(lengthMatch[1]);
                }

                const typeMatch = line.match(/\/\*\s*type:\s*([\w<>, ?]+)\s*\*\//); // Extract type if present
                if (typeMatch) {
                    format = typeMatch[1].trim();
                }

                // Count nesting depth of List<>
                let nesting = 0;
                let inner = rawType;
                const listRegex = /^List<(.+)>$/;

                while (listRegex.test(inner)) {
                    nesting += 1;
                    inner = inner.replace(listRegex, '$1').trim();
                }

                return {
                    baseType: inner.trim(),
                    field: line,
                    format: format,
                    name: match[2],
                    nesting,
                    optional: isOptional, 
                    size: size,
                    type: match[1].replace(/\?$/, '').trim(),
                };
            }
            return null;
        })
        .filter((entry): entry is TypeManifestField => entry !== null);
}