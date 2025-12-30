import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';

import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

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
      file: 'dist/probe-x-sdk.js',
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
      file: 'dist/probe-x-sdk.min.js',
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
      file: 'dist/probe-x-sdk.esm.js',
      format: 'es',
      sourcemap: true,
    },
  },
  // CommonJS build
  {
    ...baseConfig,
    output: {
      file: 'dist/probe-x-sdk.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
  },
  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/probe-x-sdk.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
  // Copy files
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/temp.js',
      format: 'es',
    },
    plugins: [
      copy({
        targets: [
          { src: 'README.md', dest: 'dist' },
          { src: 'examples/**/*', dest: 'dist/examples' },
        ],
      }),
    ],
  },
];
