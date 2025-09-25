module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react-hooks',
  ],
  extends: [
    'prettier',
    'plugin:react/recommended',
  ],
  rules: {
    'semi': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
    indent: ["error", 2, {
      "SwitchCase": 1,
    }],
    "react-hooks/rules-of-hooks": "warn",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-tag-spacing": ["error", {
      "beforeSelfClosing": "always",
    }],
  },
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: ['./tsconfig.base.json'],
        tsconfigRootDir: __dirname,
      },
    },
  ],
}
