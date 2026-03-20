import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

import { baseConfig } from '../../eslint.config.base.mjs';

const eslintConfig = defineConfig([
  ...baseConfig,

  ...nextVitals,
  ...nextTs,

  {
    rules: {
      'react/function-component-definition': [
        'error',
        { namedComponents: 'function-declaration', unnamedComponents: 'arrow-function' },
      ],
    },
  },

  {
    files: ['components/ui/**/*.tsx'],
    rules: {
      'react/function-component-definition': 'off',
    },
  },

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),
]);

export default eslintConfig;
