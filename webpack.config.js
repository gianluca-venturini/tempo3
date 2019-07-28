const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mode = process.env.ENV || 'development';

const commonConfig = {
  node: {
    __dirname: false,
  },
  mode,
  devtool: mode !== 'production' ? 'inline-source-map' : undefined,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};

module.exports = [
  {
    ...commonConfig,
    target: 'electron-main',
    entry: {
      renderrer: './src/main/index.ts',
    },
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist/main'),
    },
  },
  {
    ...commonConfig,
    target: 'electron-renderer',
    entry: {
      ui: './src/renderer/index.tsx',
    },
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist/renderer'),
    },
    plugins: [new CopyWebpackPlugin([{from: './src/renderer/static'}])],
  },
];
