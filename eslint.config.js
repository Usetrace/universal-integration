const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node, // Add Node.js globals
        ...globals.jest, // Allow the use of Jest globally
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
]
