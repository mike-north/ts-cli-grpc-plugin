import * as eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    ignores: ['**/dist/**/*', 'ts-cli-grpc-plugin/bin/**', 'ts-cli-grpc-plugin/scripts/**'],
  },
  {
    files: ['./*.cjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
      },
    },
  },
  {
    files: ['**/src/**/*.ts', '**/test/**/*.ts', 'examples/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
