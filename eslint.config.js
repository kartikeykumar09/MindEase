import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/** Flat ESLint config for the React + Vite app (browser src), Node tooling, and tests. */
export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  // Browser-side React source.
  {
    files: ['src/**/*.{js,jsx}'],
    ...js.configs.recommended,
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // not needed with the modern JSX transform
      'react/prop-types': 'off', // we document props with JSDoc instead
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Node-side tooling (Vite config, Vercel function).
  {
    files: ['vite.config.js', 'api/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Tests (logic + component render tests).
  {
    files: ['**/*.test.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]
