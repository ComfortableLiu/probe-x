import type { Configuration } from "@rspack/cli"
import { rspack } from "@rspack/core"
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin"
import { fileURLToPath } from "node:url"
import * as path from "node:path"

const PORT = 3004

// 由于在 ES 模块中没有 __dirname，所以我们需要创建它
// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
// 根目录路径
const __dirname = path.dirname(path.dirname(path.dirname(path.dirname(__filename))))
const receivingPointServicePath = path.dirname(__filename)

const config: Configuration = {
  context: __dirname,
  target: 'node',
  entry: {
    main: [
      path.resolve(receivingPointServicePath, './src/main.ts'),
    ],
  },
  output: {
    path: path.resolve(path.dirname(path.dirname(__dirname)), 'dist/apps/receiving-point-service'),
    clean: true,
  },
  resolve: {
    extensions: ['...', 'js', '.ts', '.tsx', '.jsx'],
    alias: {
      "@src": path.resolve(receivingPointServicePath, 'src'),
      "@entity": path.resolve(receivingPointServicePath, 'src/entity'),
      "@modules": path.resolve(receivingPointServicePath, 'src/modules'),
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
