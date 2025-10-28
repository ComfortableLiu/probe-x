import type { Configuration } from "@rspack/cli"
import { CopyRspackPlugin, rspack } from "@rspack/core"
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PORT = 3003

// 由于在 ES 模块中没有 __dirname，所以我们需要创建它
// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const preliminaryDataProcessingServicePath = path.dirname(__filename)
// 根目录路径
const rootDir = path.resolve(preliminaryDataProcessingServicePath, '../..')

const config: Configuration = {
  context: rootDir,
  target: 'node',
  entry: {
    main: [
      path.resolve(preliminaryDataProcessingServicePath, './src/main.ts'),
    ],
  },
  output: {
    path: path.resolve(rootDir, 'dist/apps/preliminary-data-processing-service'),
    clean: true,
  },
  resolve: {
    extensions: ['...', 'js', '.ts', '.tsx', '.jsx'],
    alias: {
      "@src": path.resolve(preliminaryDataProcessingServicePath, 'src'),
      '@entity': path.resolve(preliminaryDataProcessingServicePath, 'src/entity'),
      '@modules': path.resolve(preliminaryDataProcessingServicePath, 'src/modules'),
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
          from: path.resolve(preliminaryDataProcessingServicePath, 'config'),
          to: path.resolve(rootDir, 'dist/apps/preliminary-data-processing-service/config'),
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
        "Module not found: Can't resolve '@nestjs/websockets/socket-module' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/core'",
        "Module not found: Can't resolve '@grpc/grpc-js' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/client'",
        "Module not found: Can't resolve '@grpc/proto-loader' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/client'",
        "Module not found: Can't resolve 'mqtt' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/client'",
        "Module not found: Can't resolve 'nats' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/client'",
        "Module not found: Can't resolve 'amqplib' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/client'",
        "Module not found: Can't resolve 'amqp-connection-manager' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/client'",
        "Module not found: Can't resolve 'nats' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/deserializers'",
        "Module not found: Can't resolve 'nats' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/deserializers'",
        "Module not found: Can't resolve '@nestjs/websockets/socket-module' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices'",
        "Module not found: Can't resolve 'nats' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/serializers'",
        "Module not found: Can't resolve '@grpc/grpc-js' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/server'",
        "Module not found: Can't resolve '@grpc/proto-loader' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/server'",
        "Module not found: Can't resolve 'mqtt' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/server'",
        "Module not found: Can't resolve 'nats' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/server'",
        "Module not found: Can't resolve 'amqplib' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/server'",
        "Module not found: Can't resolve 'amqp-connection-manager' in '/Users/a58/Documents/probe-x/node_modules/@nestjs/microservices/server'",
      ]
      return list.some((item) => warning.message.includes(item))
    },
  ],
}

export default config
