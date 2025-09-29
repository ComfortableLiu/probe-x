import path from 'path'
import type { Configuration } from '@rspack/core'
import { rspack } from '@rspack/core'
import ReactRefreshPlugin from '@rspack/plugin-react-refresh'
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin'
import { fileURLToPath } from "node:url"
import Dotenv from "dotenv-webpack"
import SassEmbedded from "sass-embedded"

const PORT = 8000

// 由于在 ES 模块中没有 __dirname，所以我们需要创建它
const __filename = fileURLToPath(import.meta.url)
// 根目录路径
const __dirname = path.dirname(path.dirname(path.dirname(__filename)))
const frontendPath = path.dirname(__filename)

const sharedPath = path.resolve(path.dirname(path.dirname(path.dirname(__filename))), 'dist/libs')

// 获取当前环境
const env = process.env.NODE_ENV || 'development'

// 确定环境文件路径
const envPath = path.resolve(frontendPath, `config/env/.env.${env}`)

const htmlPath = path.resolve(frontendPath, `public/index.html`)
const entryPath = path.resolve(frontendPath, `src/main.tsx`)

// 获取当前环境
const isDev = process.env.NODE_ENV === 'development'

const config: Configuration = {

  entry: {
    main: entryPath,
  },

  output: {
    chunkFilename: isDev ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
    assetModuleFilename: 'assets/[name].[hash:8][ext]',
    cssFilename: isDev ? 'css/[name].css' : 'css/[name].[contenthash:8].css',
    cssChunkFilename: isDev ? 'css/[name].css' : 'css/[name].[contenthash:8].css',
    asyncChunks: true,
    clean: true,
    publicPath: isDev ? '/' : '/assets/',
    path: path.resolve(__dirname, 'dist/apps/frontend'),
    filename: isDev ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
  },

  devServer: {
    port: PORT,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },

  experiments: {
    css: false,
  },

  // 解析配置
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      "@pages": path.resolve(frontendPath, 'src/pages'),
      "@utils": path.resolve(frontendPath, 'src/utils'),
      "@router": path.resolve(frontendPath, 'src/router'),
      "@public": path.resolve(frontendPath, 'public'),
      "@components": path.resolve(frontendPath, 'src/components'),
      '@': path.resolve(frontendPath, 'src'),
      '@config': path.resolve(frontendPath, 'config/configuration'),
      '@shared-types': path.resolve(sharedPath, 'shared-types'),
      '@shared-utils': path.resolve(sharedPath, 'shared-utils'),
    },
  },

  // 开发工具配置
  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',

  // 模式配置
  mode: isDev ? 'development' : 'production',
  // 模块规则
  module: {
    rules: [
      {
        test: /\.(tsx|ts|jsx)$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
        exclude: /node_modules/,
      },

      // 图片资源规则
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
      },

      // 字体资源规则
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.css$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                exportLocalsConvention: 'camelCase',
                localIdentName: '[name]__[local]--[hash:base64:5]',
              },
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                exportLocalsConvention: 'camelCase',
                localIdentName: '[name]__[local]--[hash:base64:5]',
              },
            },
          },
          {
            loader: 'sass-loader',
            options: {
              api: 'modern-compiler',
              implementation: SassEmbedded,
            },
          },
        ],
      },
    ],
  },

  // 插件配置
  plugins: [
    // 配置 CSS 抽离插件
    new rspack.CssExtractRspackPlugin({
      filename: 'css/[name].[contenthash].css',
      chunkFilename: 'css/[id].[contenthash].css',
    }),
    new rspack.HtmlRspackPlugin({
      template: htmlPath,
      inject: 'body',
    }),
    // React 热更新插件 (仅开发环境)
    isDev ? new ReactRefreshPlugin() : false,
    // 注入环境变量
    new Dotenv({
      path: envPath,
      safe: false, // 使用 .env.example 验证变量
      defaults: '.env', // 基础配置
      expand: true, // 支持变量扩展
      systemvars: true, // 包含系统环境变量
    }),
  ].filter(Boolean) as Configuration['plugins'],

  // 优化配置
  optimization: {
    minimize: !isDev,
    minimizer: [new CssMinimizerPlugin()], splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 默认缓存组
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
        // 默认的 vendors 缓存组
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          reuseExistingChunk: true,
        },
        // React 相关库打包成一个 chunk
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
          name: 'react',
          priority: 20,
          chunks: 'all',
        },
        // Ant Design 相关库打包成一个 chunk
        antd: {
          test: /[\\/]node_modules[\\/](@ant-design|antd|@ant-design\/v5-patch-for-react-19)[\\/]/,
          name: 'antd',
          priority: 15,
          chunks: 'all',
        },
        // CodeMirror 相关库打包成一个 chunk
        codemirror: {
          test: /[\\/]node_modules[\\/](codemirror|@codemirror)[\\/]/,
          name: 'codemirror',
          priority: 10,
          chunks: 'all',
        },
        // 其他 node_modules 中的库
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 5,
          chunks: 'all',
          minChunks: 2,
        },
      },
      // 控制 chunk 的最大大小
      maxInitialRequests: 10,
      maxAsyncRequests: 10,
      minSize: 20000,
      maxSize: 244000,
    },
    // 运行时 chunk 配置
    runtimeChunk: {
      name: 'runtime',
    },
  },
}

export default config
