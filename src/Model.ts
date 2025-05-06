import 'reflect-metadata';
import { validateSync, ValidationError } from 'class-validator';

const typeMetadataKey = Symbol('design:type-map');
const excludeMetadataKey = Symbol('exclude:fields');
const transformMetadataKey = Symbol('transform:fields');
const readonlyMetadataKey = Symbol('readonly:fields');
const exposeMetadataKey = Symbol('expose:fields');
const defaultMetadataKey = Symbol('default:fields');

// --- Decorators ---

export function Type(type: new () => any) {
    return (target: any, propertyKey: string) => {
        const map = Reflect.getMetadata(typeMetadataKey, target) ?? {};
        map[propertyKey] = type;
        Reflect.defineMetadata(typeMetadataKey, map, target);
    };
}

export function Exclude() {
    return (target: any, propertyKey: string) => {
        const set = Reflect.getMetadata(excludeMetadataKey, target) ?? new Set();
        set.add(propertyKey);
        Reflect.defineMetadata(excludeMetadataKey, set, target);
    };
}

export function Transform(transformFn: (value: any) => any) {
    return (target: any, propertyKey: string) => {
        const map = Reflect.getMetadata(transformMetadataKey, target) ?? {};
        map[propertyKey] = transformFn;
        Reflect.defineMetadata(transformMetadataKey, map, target);
    };
}

export function Readonly() {
    return (target: any, propertyKey: string) => {
        const set = Reflect.getMetadata(readonlyMetadataKey, target) ?? new Set();
        set.add(propertyKey);
        Reflect.defineMetadata(readonlyMetadataKey, set, target);
    };
}

export function Expose(options: { groups?: string[] } = {}) {
    return (target: any, propertyKey: string) => {
        const map = Reflect.getMetadata(exposeMetadataKey, target) ?? {};
        map[propertyKey] = options.groups || [];
        Reflect.defineMetadata(exposeMetadataKey, map, target);
    };
}

export function Default(valueFn: () => any) {
    return (target: any, propertyKey: string) => {
        const map = Reflect.getMetadata(defaultMetadataKey, target) ?? {};
        map[propertyKey] = valueFn;
        Reflect.defineMetadata(defaultMetadataKey, map, target);
    };
}

// --- Base Model class ---

export abstract class Model {
    private _originalState: any;

    // --- Helpers for key conversion ---

    protected static toCamelCaseKey(key: string): string {
        return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }

    protected static toSnakeCaseKey(key: string): string {
        return key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    }

    protected static toCamelCase(obj: any): any {
        if (obj instanceof Model) return obj;
        if (Array.isArray(obj)) return obj.map(Model.toCamelCase);
        if (obj && typeof obj === 'object' && obj.constructor === Object) {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => {
                    const safeVal = v instanceof Model ? v : Model.toCamelCase(v);
                    return [Model.toCamelCaseKey(k), safeVal];
                })
            );
        }
        return obj;
    }

    protected static toSnakeCase(obj: any): any {
        if (obj instanceof Model) return obj;
        if (Array.isArray(obj)) return obj.map(Model.toSnakeCase);
        if (obj && typeof obj === 'object' && obj.constructor === Object) {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => {
                    const safeVal = v instanceof Model ? v : Model.toSnakeCase(v);
                    return [Model.toSnakeCaseKey(k), safeVal];
                })
            );
        }
        return obj;
    }

    static fromJson<T extends Model>(this: new () => T, json: Partial<T>, skipOriginalState = false): T {
        const instance = new this();
        instance.applyDefaults();
        instance.beforeApplyJson?.();
        instance.applyJson(json);
        instance.afterApplyJson?.();
        if (!skipOriginalState) {
            instance._originalState = instance.clone();
        }
        return instance;
    }

    applyDefaults(): void {
        const defaults = Reflect.getMetadata(defaultMetadataKey, this) ?? {};
        for (const [key, fn] of Object.entries(defaults)) {
            (this as any)[key] = (fn as () => any)(); // ✅ type assertion
        }
    }

    applyJson<T>(json?: Partial<T>): void {
        if (!json) return;

        const camel = (this.constructor as typeof Model).toCamelCase(json);
        const types = Reflect.getMetadata(typeMetadataKey, this) ?? {};
        const transforms = Reflect.getMetadata(transformMetadataKey, this) ?? {};
        const readOnly = Reflect.getMetadata(readonlyMetadataKey, this) ?? new Set();

        for (const [key, val] of Object.entries(camel)) {
            if (readOnly.has(key)) continue;

            const value = transforms[key] ? transforms[key](val) : val;

            if (types[key]) {
                const ClassType = types[key];
                if (Array.isArray(value)) {
                    (this as any)[key] = value.map((v: any) => v instanceof ClassType ? v : ClassType.fromJson(v));
                } else {
                    (this as any)[key] = value instanceof ClassType ? value : ClassType.fromJson(value);
                }
            } else {
                (this as any)[key] = value;
            }
        }
    }

    toJson(options: { group?: string; onlyChanged?: boolean } = {}): Record<string, any> {
        const excluded = Reflect.getMetadata(excludeMetadataKey, this) ?? new Set();
        const exposed = Reflect.getMetadata(exposeMetadataKey, this) ?? {};

        const plain: Record<string, any> = {};
        for (const key of Object.keys(this)) {
            if (key.startsWith('_')) continue;
            if (excluded.has(key)) continue;
            if (options.group && exposed[key] && !exposed[key].includes(options.group)) continue;
            if (options.onlyChanged && this._originalState && JSON.stringify((this as any)[key]) === JSON.stringify((this._originalState as any)[key])) continue;

            const value = (this as any)[key];
            const isModel = value instanceof Model;
            plain[(this.constructor as typeof Model).toSnakeCaseKey(key)] =
                isModel ? value.toJson(options) : (this.constructor as typeof Model).toSnakeCase(value);
        }

        return plain;
    }

    clone(): this {
        return (this.constructor as any).fromJson(this.toJson(), true);
    }

    diff(other: this): Partial<this> {
        const diffs: Partial<this> = {};
        for (const key of Object.keys(this)) {
            if (JSON.stringify((this as any)[key]) !== JSON.stringify((other as any)[key])) {
                (diffs as any)[key] = (this as any)[key];
            }
        }
        return diffs;
    }

    isEqual(other: this): boolean {
        return JSON.stringify(this.toJson()) === JSON.stringify(other.toJson());
    }

    reset(): void {
        if (this._originalState) {
            this.applyJson(this._originalState.toJson());
        }
    }

    freeze(): void {
        Object.freeze(this);
    }

    merge(other: Partial<this>): void {
        this.applyJson(other);
    }

    toFormData(): FormData {
        const json = this.toJson();
        const formData = new FormData();
        Object.entries(json).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                val.forEach((v, i) => formData.append(`${key}[${i}]`, v));
            } else {
                formData.append(key, val);
            }
        });
        return formData;
    }

    getChangesSince(): Partial<this> {
        if (!this._originalState) return {};
        return this.diff(this._originalState);
    }

    isValid(): boolean {
        return this.validate().length === 0;
    }

    validate(): ValidationError[] {
        return validateSync(this as any);
    }

    protected beforeApplyJson?(): void;
    protected afterApplyJson?(): void;
}
