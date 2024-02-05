# Bundle n Require

Use this package to bundle and require a TypeScript file and its dependencies.

## Installation

```bash
npm install --save bundle-n-require
```

## Usage

```js
import { bundleNRequire } from 'bundle-n-require'

const result = await bundleNRequire('path/to/entry.ts')
// => { mod, dependencies, code }
```

- `mod` is the module that was required.
- `dependencies` is an array of the modules that were required by the entry module.
- `code` is the bundled code.
