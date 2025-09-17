import path from 'path';
import { fileURLToPath } from 'node:url';
import type { Configuration } from '@rspack/core';
import { rspack } from '@rspack/core';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';

const PORT = 9000

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

const config: Configuration = {
  entry: {
    main: path.resolve(__dirname, 'src/main.tsx')
  },

  output: {
    path: path.resolve(__dirname, '../../dist/apps/ecommerce-demo'),
    filename: isDev ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
    chunkFilename: isDev ? 'js/[name].js' : 'js/[name].[contenthash:8].js',
    assetModuleFilename: 'assets/[name].[hash:8][ext]',
    cssFilename: isDev ? 'css/[name].css' : 'css/[name].[contenthash:8].css',
    cssChunkFilename: isDev ? 'css/[name].css' : 'css/[name].[contenthash:8].css',
    clean: true,
    publicPath: '/ecommerce-demo/',
  },

  devServer: {
    port: PORT,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public')
    },
  },

  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
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
                  refresh: isDev
                }
              },
              target: 'es5',
            },
          },
        },
        exclude: /node_modules/
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
        type: 'asset/resource'
      },
    ]
  },

  plugins: [
    new rspack.CssExtractRspackPlugin({
      filename: 'css/[name].[contenthash].css',
      chunkFilename: 'css/[id].[contenthash].css',
    }),
    new rspack.HtmlRspackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      inject: 'body'
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
          chunks: 'all'
        },
        antd: {
          test: /[\\/]node_modules[\\/](@ant-design|antd)[\\/]/,
          name: 'antd',
          priority: 15,
          chunks: 'all'
        },
      },
    },
  },
};

export default config;
