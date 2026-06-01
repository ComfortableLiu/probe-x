import path from 'path'
import type { Configuration } from '@rspack/core'
import { rspack } from '@rspack/core'
import ReactRefreshPlugin from '@rspack/plugin-react-refresh'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'fs'

const PORT = parseInt(process.env.ECOMMERCE_DEMO_PORT || '', 10) || 9000

// 由于在 ES 模块中没有 __dirname，所以我们需要创建它
// @ts-ignore
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = process.env.NODE_ENV === 'development'

// 优先使用源码，这样 swc-loader 可以正确处理 TypeScript
// 如果需要在生产环境使用构建产物，可以在这里添加条件判断
const webSdkSrcPath = path.resolve(__dirname, '../web-sdk/src/index.ts')
const webSdkPath = webSdkSrcPath

const config: Configuration = {
  entry: {
    main: path.resolve(__dirname, 'src/main.tsx'),
  },

  output: {
    path: path.resolve(__dirname, '../../dist/apps/ecommerce-demo'),
    filename: isDev ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
    chunkFilename: isDev ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
    assetModuleFilename: 'assets/[name].[hash:8][ext]',
    cssFilename: isDev ? 'css/[name].css' : 'css/[name].[contenthash:8].css',
    cssChunkFilename: isDev ? 'css/[name].css' : 'css/[name].[contenthash:8].css',
    clean: true,
    publicPath: '/',
  },

  devServer: {
    port: PORT,
    host: '0.0.0.0',
    allowedHosts: 'all',
    hot: true,
    historyApiFallback: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
      reconnect: 5,
    },
    watchFiles: {
      paths: ['src/**/*'],
      options: {
        usePolling: false,
        ignored: /node_modules/,
      },
    },
  },

  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 如果web-sdk已构建，使用dist目录；否则使用源码
      '@probe-x/web-sdk': webSdkPath,
    },
  },

  module: {
    rules: [
      {
        test: /\.(tsx|ts|jsx|js)$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: isDev,
                  refresh: isDev,
                },
              },
              target: 'es5',
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },

  plugins: [
    new rspack.CssExtractRspackPlugin({
      filename: 'css/[name].[contenthash].css',
      chunkFilename: 'css/[id].[contenthash].css',
    }),
    new rspack.HtmlRspackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      inject: 'body',
    }),
    // 定义 process.env 以便在浏览器环境中使用
    new rspack.DefinePlugin({
      'process.env': JSON.stringify({
        NODE_ENV: isDev ? 'development' : 'production',
        BUILD_VERSION: process.env.BUILD_VERSION || 'dev',
      }),
    }),
    isDev ? new ReactRefreshPlugin() : false,
  ].filter(Boolean) as Configuration['plugins'],

  optimization: {
    minimize: !isDev,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
          name: 'react',
          priority: 20,
          chunks: 'all',
        },
        antd: {
          test: /[\\/]node_modules[\\/](@ant-design|antd)[\\/]/,
          name: 'antd',
          priority: 15,
          chunks: 'all',
        },
      },
    },
  },
}

export default config
