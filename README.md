# MOX (model + transform) for TypeScript

`MOX` is a powerful base class for building structured, type-safe, and feature-rich data models in TypeScript. It supports:

- Automatic snake_case ↔ camelCase conversion
- Nested models and array relations
- Decorators for exclusions, types, readonly fields, transformations, and default values
- Validation with `class-validator`
- Serialization control with groups and selective changes
- Lifecycle hooks
- Cloning, diffing, equality checks
- Reset, freeze, merge
- FormData conversion

---

## Installation

```bash
npm install advanced-model reflect-metadata class-validator
```

Enable the following in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

And include this at the start of your app:

```ts
import 'reflect-metadata';
```

---

## Basic Usage

```ts
import { Model, Type } from 'advanced-model';

class Profile extends Model {
  bio: string = '';
  website: string = '';
}

class User extends Model {
  firstName: string = '';
  lastName: string = '';

  @Type(Profile)
  profile: Profile = new Profile();
}

const user = User.fromJson({
  first_name: 'Pavel',
  last_name: 'del Pozo',
  profile: {
    bio: 'Frontend Dev',
    website: 'https://pavel.dev'
  }
});
```

---

## Decorators

### `@Type(Class)`
Defines the class to use for nested or array fields.

```ts
@Type(Post)
posts: Post[] = [];
```

### `@Exclude()`
Prevents a field from being included in `toJson()`.

```ts
@Exclude()
password: string = '';
```

### `@Transform(fn)`
Applies a transformation during import (e.g., parse date).

```ts
@Transform((v) => new Date(v))
createdAt: Date = new Date();
```

### `@Readonly()`
Prevents the field from being overwritten by `applyJson()`.

```ts
@Readonly()
id: number = 0;
```

### `@Expose({ groups })`
Includes the field only for certain serialization groups.

```ts
@Expose({ groups: ['admin'] })
internalNotes: string = '';
```

### `@Default(() => value)`
Provides a default value during instantiation.

```ts
@Default(() => new Date())
createdAt: Date;
```

---

## Model Methods

### `fromJson(json)`
Creates a model from JSON, converting snake_case keys automatically.

### `applyJson(json)`
Applies values to an existing instance.

### `toJson({ group?, onlyChanged? })`
Serializes the model:
- `group`: restrict output to fields marked with `@Expose({ groups })`
- `onlyChanged`: only outputs fields that differ from the original

### `clone()`
Returns a deep copy of the instance.

### `diff(other)`
Returns an object with fields that differ from another model instance.

### `isEqual(other)`
Returns true if both instances are equal (based on serialized data).

### `reset()`
Restores the instance to its original state (after `fromJson`).

### `freeze()`
Freezes the instance using `Object.freeze()`.

### `merge(partial)`
Applies a partial object to the instance.

### `toFormData()`
Converts the model into a `FormData` object.

### `getChangesSince()`
Returns an object with only the changed fields.

### `isValid()` / `validate()`
Validates the model using `class-validator` decorators.

---

## Advanced Example

```ts
class Post extends Model {
  title: string = '';

  @Transform(v => new Date(v))
  @Default(() => new Date())
  createdAt: Date;
}

class User extends Model {
  firstName: string = '';
  lastName: string = '';

  @Exclude()
  password: string = '';

  @Type(Post)
  posts: Post[] = [];

  @Expose({ groups: ['admin'] })
  isAdmin: boolean = false;
}

const user = User.fromJson({
  first_name: 'Pavel',
  last_name: 'del Pozo',
  password: 'secret',
  posts: [{ title: 'Hello', created_at: '2023-01-01' }],
  is_admin: true,
});

const json = user.toJson({ group: 'admin', onlyChanged: true });
```

---

## Roadmap
- Discriminator support (`@Discriminator()`)
- Automatic form generation via `@Field()`
- JSON Schema export
- Integration with Vue/React component libraries

---

## License
MIT
