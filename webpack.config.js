const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mode = process.env.ENV || 'development';
console.log('Mode: ', mode);

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
    extensions: ['.tsx', '.ts', '.js', '.json'],
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
    externals: [
      function(context, request, callback) {
        // Insert here modules that should be included directly from node_modules
        if (/^noble$/.test(request)) {
          return callback(null, 'commonjs ' + request);
        }
        // Needed to import sequelize and sqlite3
        if (request === 'sequelize') {
          return callback(null, "require('sequelize')");
        }
        callback();
      },
      // This packages are not needed and required by `sequelize`
      'pg',
      'pg-hstore',
    ],
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
