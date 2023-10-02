import { build } from 'esbuild'
import path from 'path'
import fs from 'fs'
import { resolveImport} from 'resolve-import'

const conditions = [
  "development",
  "production",
  "import",
  "module",
  "require",
  "node",
  "default",
]

/* -----------------------------------------------------------------------------
 * Given a file path, require it directly
 * -----------------------------------------------------------------------------*/

function requireDirect(file: string): BundleResult {
  const fileName = fs.realpathSync(file)
  delete require.cache[file]
  const mod = require(fileName)
  return {
    mod: mod.default ?? mod,
    dependencies: [fileName],
    code: fs.readFileSync(fileName, 'utf-8'),
  }
}

/* -----------------------------------------------------------------------------
 * Bundle a file and return the result
 * -----------------------------------------------------------------------------*/

async function bundleConfigFile(file: string, cwd: string) {
  const result = await build({
    absWorkingDir: cwd,
    entryPoints: [file],
    outfile: 'out.js',
    write: false,
    platform: 'node',
    bundle: true,
    format: 'cjs',
    sourcemap: false,
    metafile: true,
    mainFields: ['module', 'main'],
    conditions
  })

  const { text } = result.outputFiles[0]

  return {
    code: text,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
  }
}

/* -----------------------------------------------------------------------------
 * Load the bundled file into the current require cache
 * -----------------------------------------------------------------------------*/

function loadBundledFile(file: string, code: string): Promise<any> {
  const extension = path.extname(file)
  const realFileName = fs.realpathSync(file)

  const loader = require.extensions[extension]!

  require.extensions[extension] = (mod: any, filename: string) => {
    if (filename === realFileName) {
      mod._compile(code, filename)
    } else {
      loader(mod, filename)
    }
  }

  delete require.cache[require.resolve(file)]

  const raw = require(file)
  const result = raw.default ?? raw
  require.extensions[extension] = loader
  return result
}

type BundleResult = {
  mod: any
  dependencies: string[]
  code: string
}

/* -----------------------------------------------------------------------------
 * Finally, the bundle require code
 * -----------------------------------------------------------------------------*/

export type BundleNRequireOptions = {
  cwd?: string
  interopDefault?: boolean
}

export async function bundleNRequire(
  file: string,
  opts: BundleNRequireOptions = {}
) {
  const { cwd = process.cwd() } = opts
  let absPath;
  try {
    const fileUrl = await resolveImport(file, cwd, { conditions });
    absPath = typeof fileUrl === "string" ? fileUrl : fileUrl.pathname;
  } catch {
    absPath = require.resolve(file, { paths: [cwd] })
  }

  try {
    return requireDirect(absPath)
    //
  } catch {
    const bundle = <BundleResult>await bundleConfigFile(absPath, cwd)
    try {
      bundle.mod = await loadBundledFile(absPath, bundle.code)
    } catch {
      bundle.mod = require('node-eval')(bundle.code, absPath).default
    }
    return bundle
  }
}
