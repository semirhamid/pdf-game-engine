import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function bundleRuntime(): string {
  const result = buildSync({
    stdin: {
      contents: "export { bind } from './src/runtime/main.ts';",
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'PDRuntime',
    target: 'es2020',
    minifyWhitespace: false,
    legalComments: 'none',
    absWorkingDir: root,
  });
  // esbuild can't output ES5, so let TypeScript do that part.
  const es5 = ts
    .transpileModule(result.outputFiles[0]!.text, {
      compilerOptions: {
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.None,
        removeComments: true,
        ignoreDeprecations: '5.0',
      },
    })
    .outputText.replace(/^"use strict";\s*/, '');
  return `${es5}\nvar PD = PDRuntime.bind(this);\n`;
}
