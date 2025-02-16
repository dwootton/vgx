// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: 'alx',
    libraryTarget: 'var',
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // speeds up compilation
              experimentalWatchApi: true,
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  plugins: [
    // new HtmlWebpackPlugin({
    //   template: './src/index.html',
    //   inject: 'body',
    // }),
  ],

  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    hot: true,
    port: 3000,
    open: true,
    watchFiles: ['src/**/*'],
  },

  // Enable source maps for debugging
  devtool: 'eval-source-map',

  // Add cache for faster rebuilds
  cache: {
    type: 'filesystem',
  },
};