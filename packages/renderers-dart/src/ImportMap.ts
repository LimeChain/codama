import TypeManifest from "./TypeManifest";

const DEFAULT_DART_CORE_LIBRARIES: Record<string, string> = {
    dartAsync: 'dart:async',
    dartCollection: 'dart:collection',
    dartConvert: 'dart:convert',
    dartCore: 'dart:core',
    dartMath: 'dart:math',
    dartTypedData: 'dart:typed_data',
};

const DEFAULT_INTERNAL_MODULE_MAP: Record<string, string> = {
    generated: 'package:generated',
    generatedAccounts: 'package:generated/accounts',
    generatedErrors: 'package:generated/errors',
    generatedInstructions: 'package:generated/instructions',
    generatedPdas: 'package:generated/pdas',
    generatedTypes: 'package:generated/types',
    models: 'package:generated/models',
    utils: 'package:generated/utils',
};

export class ImportMap {
    protected readonly _imports: Map<string, Set<string>> = new Map();
    protected readonly _prefixes: Map<string, string> = new Map();
    protected readonly _showHide: Map<string, { hide?: string[], show?: string[] }> = new Map();

    add(module: string, imports: Set<string> | string[] | string): ImportMap {
        const newImports = new Set(typeof imports === 'string' ? [imports] : imports);
        if (newImports.size === 0) return this;

        const currentImports = this._imports.get(module) ?? new Set();
        newImports.forEach(i => currentImports.add(i));
        this._imports.set(module, currentImports);

        return this;
    }

    remove(module: string, imports?: Set<string> | string[] | string): ImportMap {
        if (!this._imports.has(module)) return this;
        if (!imports) {
            this._imports.delete(module);
            return this;
        }
        const importsToRemove = new Set(typeof imports === 'string' ? [imports] : imports);
        const currentImports = this._imports.get(module)!;
        importsToRemove.forEach(i => currentImports.delete(i));
        if (currentImports.size === 0) this._imports.delete(module);
        else this._imports.set(module, currentImports);
        return this;
    }

    mergeWith(...others: ImportMap[]): ImportMap {
        others.forEach(other => {
            other._imports.forEach((imports, module) => {
                this.add(module, imports);
            });

            other._prefixes.forEach((prefix, module) => {
                this.addPrefix(module, prefix);
            });

            other._showHide.forEach((directives, module) => {
                if (directives.show) {
                    this.addShowDirective(module, directives.show);
                }
                if (directives.hide) {
                    this.addHideDirective(module, directives.hide);
                }
            });
        });

        return this;
    }

    mergeWithManifest(manifest: TypeManifest): ImportMap {
        return this.mergeWith(manifest.imports);
    }

    addPrefix(module: string, prefix: string): ImportMap {
        this._prefixes.set(module, prefix);
        return this;
    }

    addShowDirective(module: string, symbols: string[]): ImportMap {
        const directives = this._showHide.get(module) ?? {};
        directives.show = [...new Set([...(directives.show ?? []), ...symbols])];
        this._showHide.set(module, directives);
        return this;
    }

    addHideDirective(module: string, symbols: string[]): ImportMap {
        const directives = this._showHide.get(module) ?? {};
        directives.hide = [...new Set([...(directives.hide ?? []), ...symbols])];
        this._showHide.set(module, directives);
        return this;
    }

    isEmpty(): boolean {
        return this._imports.size === 0;
    }

    resolve(dependencies: Record<string, string> = {}): Map<string, Set<string>> {
        const dependencyMap = {
            ...DEFAULT_DART_CORE_LIBRARIES,
            ...DEFAULT_INTERNAL_MODULE_MAP,
            ...dependencies,
        };

        const resolvedMap = new Map<string, Set<string>>();
        this._imports.forEach((imports, module) => {
            const resolvedModule = dependencyMap[module] ?? module;
            const currentImports = resolvedMap.get(resolvedModule) ?? new Set();
            imports.forEach(i => currentImports.add(i));
            resolvedMap.set(resolvedModule, currentImports);
        });

        return resolvedMap;
    }

    toString(dependencies: Record<string, string> = {}): string {
        return [...this.resolve(dependencies).entries()]
            .sort(([a], [b]) => {
                const aIsDart = a.startsWith('dart:');
                const bIsDart = b.startsWith('dart:');
                const aIsPackage = a.startsWith('package:');
                const bIsPackage = b.startsWith('package:');

                if (aIsDart && !bIsDart) return -1;
                if (!aIsDart && bIsDart) return 1;
                if (aIsPackage && !bIsPackage && !bIsDart) return -1;
                if (!aIsPackage && bIsPackage && !aIsDart) return 1;

                return a.localeCompare(b);
            })
            .map(([module, _imports]) => {
                let importStatement = `import '${module}'`;

                const prefix = this._prefixes.get(module);
                if (prefix) {
                    importStatement += ` as ${prefix}`;
                }

                const directives = this._showHide.get(module);
                if (directives?.show?.length) {
                    importStatement += ` show ${directives.show.sort().join(', ')}`;
                } else if (directives?.hide?.length) {
                    importStatement += ` hide ${directives.hide.sort().join(', ')}`;
                }

                return importStatement + ';';
            })
            .join('\n');
    }
}