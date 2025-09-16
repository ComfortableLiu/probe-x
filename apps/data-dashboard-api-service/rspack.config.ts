import { Configuration } from '@rspack/core';
import { NxAppWebpackPlugin } from '@nx/webpack/src/plugins/nx-app-webpack-plugin';
import { join } from 'path';

const config: Configuration = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  entry: './src/main.ts',
  target: 'node',
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@src': join(__dirname, 'src'),
      '@shared-types': join(__dirname, '../../libs/shared-types/src/index.ts'),
    },
  },
  output: {
    path: join(__dirname, 'dist'),
    filename: 'main.js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
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
        ],
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.json',
      assets: [],
      optimization: false,
              outputHashing: 'none',
    }),
  ],
  externals: {
    'kafkajs': 'commonjs kafkajs',
    'mysql2': 'commonjs mysql2',
    'ioredis': 'commonjs ioredis',
  },
};

export default config;
