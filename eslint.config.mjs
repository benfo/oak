import babelParser from '@babel/eslint-parser'

// Only file size is checked. Size is a prompt to look for a second responsibility, not a rule.
// Babel parses the TypeScript syntax because typescript-eslint does not support TypeScript 7 yet.
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript', '@babel/preset-react']
        }
      }
    },
    rules: {
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }]
    }
  }
]
