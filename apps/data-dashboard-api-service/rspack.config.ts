import type { Configuration } from "@rspack/cli"
import { CopyRspackPlugin, rspack } from "@rspack/core"
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin"
import { fileURLToPath } from "node:url"
import * as path from "node:path"

// 由于在 ES 模块中没有 __dirname，所以我们需要创建它
// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const dataDashboardServicePath = path.dirname(__filename)
// 根目录路径
const rootDir = path.resolve(dataDashboardServicePath, '../..')

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
  externals: {
    typeorm: 'commonjs typeorm',
    'reflect-metadata': 'commonjs reflect-metadata',
    mysql2: 'commonjs mysql2',
  },
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
    port: 3001,
    devMiddleware: {
      writeToDisk: true,
    },
  },
  ignoreWarnings: [
    (warning) => {
      const list = [
        'Critical dependency: the request of a dependency is an expression',
        "Module not found: Can't resolve 'react-native-sqlite-storage' in '/Users/a58/Documents/probe-x/node_modules/typeorm/driver/react-native'",
        "Module not found: Can't resolve '@google-cloud/spanner' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'mongodb' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve '@sap/hana-client' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve '@sap/hana-client/extension/Stream' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'mysql' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'oracledb' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'pg' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'pg-native' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'pg-query-stream' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'typeorm-aurora-data-api-driver' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'redis' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'better-sqlite3' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'sqlite3' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'sql.js' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'mssql' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
        "Module not found: Can't resolve 'react-native-sqlite-storage' in '/Users/a58/Documents/probe-x/node_modules/typeorm/platform'",
      ]
      return list.some((item) => warning.message.includes(item))
    },
  ],
}

export default config
