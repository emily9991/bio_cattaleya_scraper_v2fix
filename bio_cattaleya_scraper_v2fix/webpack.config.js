const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
// const JavaScriptObfuscator = require('webpack-obfuscator'); // DESHABILITADO - causa crash
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'inline-source-map',
    
    entry: {
      background: { import: './background.js', layer: undefined },
      popup: './popup.js'
    },
    target: ['web', 'es2020'],
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
      globalObject: 'self',
      environment: { dynamicImport: false }
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    },
    
    plugins: [
      // Inyectar variables de entorno (solo frontend)
      new Dotenv({
        systemvars: false,
        safe: false,
        defaults: false,
        allowEmptyValues: false,
        path: './.env'
      }),
      
      // Ofuscación DESHABILITADA - causa crash en content script injection
      // new JavaScriptObfuscator({...}, ['background']),
      // new JavaScriptObfuscator({...}, ['popup']),
      // new JavaScriptObfuscator({...}, ['content']),
      
      // Copiar assets sin procesar
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/config.js', to: 'config.js' },
          { from: 'src/utils/secureStorage.js', to: 'secureStorage.js' },
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'popup.html', to: 'popup.html' },
          { from: 'sidepanel.html', to: 'sidepanel.html' },
          { from: 'tesseract.min.js', to: 'tesseract.min.js' },
          { from: 'lib/', to: 'lib/' },
          { from: 'icons/', to: 'icons/', noErrorOnMissing: true }
        ]
      })
    ],
    
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction,
              pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : []
            },
            mangle: isProduction,
            format: {
              comments: false
            }
          },
          extractComments: false
        })
      ]
    },
    
    resolve: {
      extensions: ['.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    
    // Excluir tesseract del procesamiento
    externals: {
      'tesseract': 'null'
    },
    
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }
  };
};
