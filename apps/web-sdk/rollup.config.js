import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const baseConfig = {
  input: 'src/index.ts',
  // uuid 仅在 UMD 构建中内联（浏览器 script 标签使用），ESM/CJS 保持外部依赖以支持 tree-shaking
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

// UMD 构建需要内联 uuid（浏览器无法自动解析 node_modules）
const umdConfig = {
  ...baseConfig,
  external: [],
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
  // UMD build (用于 <script> 标签)
  {
    ...umdConfig,
    output: {
      file: 'dist/probe-x-sdk.umd.js',
      format: 'umd',
      name: 'ProbeX',
      sourcemap: true,
      exports: 'named',
    },
  },
  // UMD minified build (用于生产环境 CDN)
  {
    ...umdConfig,
    plugins: [
      ...umdConfig.plugins,
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 2,
        },
        mangle: {
          reserved: ['ProbeX'],
        },
        format: {
          comments: false,
        },
      }),
    ],
    output: {
      file: 'dist/probe-x-sdk.umd.min.js',
      format: 'umd',
      name: 'ProbeX',
      sourcemap: true,
      exports: 'named',
    },
  },
  // ES module build (支持 tree-shaking)
  {
    ...baseConfig,
    output: {
      file: 'dist/probe-x-sdk.esm.js',
      format: 'es',
      sourcemap: true,
    },
  },
  // ES module minified build
  {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 2,
        },
        format: {
          comments: false,
        },
      }),
    ],
    output: {
      file: 'dist/probe-x-sdk.esm.min.js',
      format: 'es',
      sourcemap: true,
    },
  },
  // CommonJS build (用于 require)
  {
    ...baseConfig,
    output: {
      file: 'dist/probe-x-sdk.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
  },
  // CommonJS minified build
  {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 2,
        },
        format: {
          comments: false,
        },
      }),
    ],
    output: {
      file: 'dist/probe-x-sdk.cjs.min.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
  },
  // TypeScript declarations (.d.ts)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/probe-x-sdk.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
