import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';

import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

const baseConfig = {
  input: 'src/index.js',
  external: ['uuid'],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              browsers: ['> 1%', 'last 2 versions', 'not ie <= 8'],
            },
          },
        ],
      ],
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
    },
  },
  // UMD minified build
  {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      terser({
        compress: {
          drop_console: true,
        },
      }),
    ],
    output: {
      file: 'dist/probe-x-sdk.min.js',
      format: 'umd',
      name: 'ProbeX',
      sourcemap: true,
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
    input: 'src/index.d.ts',
    output: {
      file: 'dist/probe-x-sdk.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
  // Copy files
  {
    input: 'src/index.js',
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
