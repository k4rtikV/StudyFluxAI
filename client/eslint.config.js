import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // StudyFluxAI does not enable the React Compiler. These compiler-only
      // diagnostics were promoted to errors by eslint-plugin-react-hooks 7.x
      // and flag established, valid React patterns such as initial async loads
      // inside effects. Keep correctness hooks rules enabled while avoiding a
      // CI-only refactor of stable UI behavior solely for compiler eligibility.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/context/AuthContext.jsx'],
    rules: {
      // The context object and its provider intentionally live together. This
      // only affects development Fast Refresh boundaries, not production code.
      'react-refresh/only-export-components': 'off',
    },
  },
])
