import type { Configuration } from "@rspack/cli"
import { CopyRspackPlugin, rspack } from "@rspack/core"
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin"
import { fileURLToPath } from "node:url"
import * as path from "node:path"

const PORT = 3002

// 由于在 ES 模块中没有 __dirname，所以我们需要创建它
// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const dataDashboardServicePath = path.dirname(__filename)
// 根目录路径
const rootDir = path.resolve(dataDashboardServicePath, '../..')

const sharedPath = path.resolve(rootDir, 'libs')

const config: Configuration = {
  context: rootDir,
  target: 'node',
  entry: {
    main: [
      path.resolve(dataDashboardServicePath, './src/main.ts'),
    ],
  },
  output: {
    path: path.resolve(rootDir, 'dist/apps/data-dashboard-api-service'),
    clean: true,
  },
  resolve: {
    extensions: ['...', 'js', '.ts', '.tsx', '.jsx'],
    alias: {
      "@src": path.resolve(dataDashboardServicePath, 'src'),
      '@config': path.resolve(dataDashboardServicePath, 'config'),
      '@entity': path.resolve(dataDashboardServicePath, 'src/entity'),
      '@modules': path.resolve(dataDashboardServicePath, 'src/modules'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: true,
              },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
            },
          },
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            keep_classnames: true,
            keep_fnames: true,
          },
          mangle: {
            keep_classnames: true,
            keep_fnames: true,
          },
        },
      }),
    ],
  },
  externalsType: 'commonjs',
  plugins: [
    new CopyRspackPlugin({
      patterns: [
        {
          from: path.resolve(dataDashboardServicePath, 'config'),
          to: path.resolve(rootDir, 'dist/apps/data-dashboard-api-service/config'),
        },
      ],
    }),
    !process.env.BUILD &&
    new RunScriptWebpackPlugin({
      name: 'main.js',
      autoRestart: false,
    }),
  ].filter(Boolean),
  devServer: {
    port: PORT,
    devMiddleware: {
      writeToDisk: true,
    },
  },
  ignoreWarnings: [
    (warning) => {
      const list = [
        'Critical dependency: the request of a dependency is an expression',
      ]
      return list.some((item) => warning.message.includes(item))
    },
  ],
}

export default config
