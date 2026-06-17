const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');

const env = dotenv.config({ path: path.join(__dirname, '.env') }).parsed;

const envKeys = Object.keys(env).reduce((prev, key) => {
  prev[`process.env.${key}`] = JSON.stringify(env[key]);
  return prev;
}, {});

module.exports = {
  entry: {
    analysis: './src/frontend/views/analysis.jsx'
  },
  output: {
    filename: 'analysis.bundle.js',
    path: path.resolve(__dirname, 'analyzer/static/js'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './analyzer/templates/analysis.html',
      filename: path.resolve(__dirname, 'analyzer/templates/analysis.html'),
      publicPath: '/analyzer/static/js/',
      chunks: ['analysis']
    }),
    new webpack.DefinePlugin(envKeys)
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
};
