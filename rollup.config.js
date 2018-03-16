// rollup.config.js
// import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import builtins from 'rollup-plugin-node-builtins'

export default {
  experimentalCodeSplitting: true,
  input: ['src/index.js'],
  output: {
    dir: 'dist',
    format: 'cjs',
    exports: 'named',
    sourcemap: true
  },
  external: ['events', 'path', 'ws', 'node-fetch'],
  plugins: [
    builtins(),
    resolve({
      module: true,
      main: false,
      modulesOnly: true,
      preferBuiltins: true
    })
  ]
}
