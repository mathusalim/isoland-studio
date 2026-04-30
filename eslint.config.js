import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'pnpm-lock.yaml'] },
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        // Parse TypeScript inside <script lang="ts"> blocks
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettierConfig,
)
