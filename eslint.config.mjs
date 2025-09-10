import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript specific rules - relaxed for this project
      '@typescript-eslint/explicit-function-return-type': 'off',
      
      // TODO: Re-enable these rules once we have proper types for the JSON-RPC protocol
      // The ACP protocol involves dynamic JSON structures that are difficult to type strictly
      // without a complete protocol specification. For now, we're disabling these warnings
      // to focus on more critical issues.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-floating-promises': ['error', {
        ignoreVoid: true,
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: {
          arguments: false,
        },
      }],
      '@typescript-eslint/require-await': 'off',
      
      // General JavaScript/TypeScript best practices
      'no-console': 'off', // Console is needed for CLI tools
      'eqeqeq': ['error', 'always'],
      'no-throw-literal': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-template': 'warn',
      'no-eval': 'error',
      
      // Code quality - relaxed limits
      'complexity': ['warn', 15],
      'max-depth': ['warn', 5],
      'max-lines-per-function': 'off',
      
      // Prettier integration
      'prettier/prettier': ['warn', {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        bracketSpacing: true,
        arrowParens: 'always',
        endOfLine: 'lf',
      }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js', '*.d.ts', '.qodo/', 'eslint.config.mjs'],
  }
);