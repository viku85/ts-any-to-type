# ts-any-to-type README

Automatically infer and replace `any` in TypeScript code with specific types.

## Features

- Automatically replace `any` with inferred types in TypeScript.
- Supports nested objects, arrays, and functions.
- Easy integration with VS Code Lightbulb suggestions.
- Test your code changes with embedded unit testing.
- Extensible with class-based inference for new scenarios.

## Installation

1. Open VS Code.
2. Go to the Extensions Marketplace (Ctrl+Shift+X).
3. Search for `TS-Any-to-Type`.
4. Click `Install`.

## Usage

1. Hover over a TypeScript `any` type.
2. Click the lightbulb suggestion or run the command `Convert Any to Specific Type`.
3. View the inferred type and confirm to replace it in your code.

### Example

Before:

```typescript
let obj: any = { name: "John", age: 30 };
```

Before:

```typescript
let obj: { name: string; age: number } = { name: "John", age: 30 };
```

## Test Cases

| Code                                           | Expected Type           | Result |
| ---------------------------------------------- | ----------------------- | ------ |
| `let x: any = "text";`                         | `string`                | ✅     |
| `let y: any = [1, 2, 3];`                      | `number[]`              | ✅     |
| `let z: any = { id: 123 };`                    | `{ id: number }`        | ✅     |
| `let a: any = Math.random() > 0.5 ? "A" : 42;` | `string \| number`      | ✅     |
| `onChange(value: any) {}`                      | `{ property: unknown }` | ✅     |

## Supported Scenarios

- Simple variable declarations:
  ```typescript
  let x: any = "text";
  ```
- Nested object structures:

```typescript
Copy code
let obj: any = { name: "Alice", age: 25 };
```

Functions:

```typescript
Copy code
let func: any = (a: number, b: number) => a + b;
```

## Roadmap

- Support for complex conditional types.
- Customizable inference rules.
- Improved performance for large files.

## Known Issues

- Cannot infer types from dynamic object properties.
- Limited support for union and intersection types in deeply nested structures.

## Contributing

We welcome contributions! Please fork the repository and submit a pull request with your changes.

## Feedback

Please report any issues [here](https://github.com/your-repo/ts-any-to-type/issues).
