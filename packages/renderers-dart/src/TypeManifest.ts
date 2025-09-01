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


// '  final Int64List i64_array;\n' +
// '  final Int8List /* length: 2 */ fixed_i8;\n' +
export function extractFieldsFromTypeManifest(typeManifest: TypeManifest): { 
    baseType: string 
    field: string, 
    name: string, 
    nesting: number, 
    type: string, 
}[] {
    return typeManifest.type
        .split('\n')
        .map((line) => {
            // That handles lines like: final Uint8List fieldName; and extracts the type and name in order to be used from borsh readers/writers
            const match = line.trim().match(/^final\s+([\w<>, ?]+)\s+(\w+);$/);
            if (match && match[2] !== 'discriminator') {
                const isOptional = /\?$/.test(match[1]); // check if the string ends with a '?'
                const rawType = match[1].replace(/\?$/, '').trim();

                // Count nesting depth of List<>
                let nesting = 0;
                let inner = rawType;
                const listRegex = /^List<(.+)>$/;

                while (listRegex.test(inner)) {
                    nesting += 1;
                    inner = inner.replace(listRegex, '$1').trim();
                }

                return {
                    baseType: inner,
                    field: line,
                    name: match[2],
                    nesting,
                    optional: isOptional, 
                    type: match[1].replace(/\?$/, ''),
                };
            }
            return null;
        })
        .filter((entry): entry is { 
            baseType: string;
            field: string;
            name: string; 
            nesting: number;
            optional: boolean;
            type: string; 
        } => entry !== null);
}