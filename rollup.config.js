// rollup.config.js
// import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
// import builtins from 'rollup-plugin-node-builtins'

export default {
  experimentalCodeSplitting: true,
  input: ['src/index.js'],
  output: {
    dir: 'dist',
    format: 'cjs',
    exports: 'named',
    sourcemap: true
  },
  external: ['umzug','sequelize', 'micro', 'micro-route/dispatch', 'net', 'fs', 'http', 'screeps-api', 'axios', 'events', 'path', 'ws', 'node-fetch'],
  plugins: [
    // builtins(),
    resolve({
      module: true,
      main: true,
      modulesOnly: true,
      jail: __dirname + '/src',
      preferBuiltins: true
    })
  ]
}
