import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';

import {readFileSync} from 'fs';
import path from "node:path";
import {fileURLToPath} from "node:url";

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

const __filename = fileURLToPath(import.meta.url)
const receivingPointServicePath = path.dirname(__filename)
// 根目录路径
const rootDir = path.resolve(receivingPointServicePath, '../..')

const baseConfig = {
  input: 'src/index.ts',
  external: ['uuid'],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
    }),
  ],
};

export default [
  // UMD build (for browsers)
  {
    ...baseConfig,
    output: {
      file: path.resolve(rootDir, 'dist/apps/web-sdk/probe-x-sdk.js'),
      format: 'umd',
      name: 'ProbeX',
      sourcemap: true,
      globals: {
        uuid: 'uuid',
      },
    },
  },
  // UMD minified build
  {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      terser({
        compress: {
          drop_console: false, // 保留console.log用于调试
          drop_debugger: true,
        },
        mangle: {
          reserved: ['ProbeX'], // 保留主类名
        },
      }),
    ],
    output: {
      file: path.resolve(rootDir, 'dist/apps/web-sdk/probe-x-sdk.min.js'),
      format: 'umd',
      name: 'ProbeX',
      sourcemap: true,
      globals: {
        uuid: 'uuid',
      },
    },
  },
  // ES module build
  {
    ...baseConfig,
    output: {
      file: path.resolve(rootDir, 'dist/apps/web-sdk/probe-x-sdk.esm.js'),
      format: 'es',
      sourcemap: true,
    },
  },
  // CommonJS build
  {
    ...baseConfig,
    output: {
      file: path.resolve(rootDir, 'dist/apps/web-sdk/probe-x-sdk.cjs.js'),
      format: 'cjs',
      sourcemap: true,
    },
  },
  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: path.resolve(rootDir, 'dist/apps/web-sdk/probe-x-sdk.d.ts'),
      format: 'es',
    },
    plugins: [dts()],
  },
  // Copy files
  {
    input: 'src/index.ts',
    output: {
      file: path.resolve(rootDir, 'dist/apps/web-sdk/temp.js'),
      format: 'es',
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
      }),
      copy({
        targets: [
          { src: 'README.md', dest: path.resolve(rootDir, 'dist/apps/web-sdk') },
          { src: 'examples/**/*', dest: path.resolve(rootDir, 'dist/apps/web-sdk/examples') },
        ],
      }),
    ],
  },
];
