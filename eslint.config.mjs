import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import perfectionist from 'eslint-plugin-perfectionist'

export default defineConfig([
  ...nextVitals,
  {
    plugins: { perfectionist },
    rules: {
      'perfectionist/sort-named-exports': ['error', { type: 'natural', order: 'asc' }],
      'perfectionist/sort-named-imports': ['error', { type: 'natural', order: 'asc' }],
    },
  },
  {
    files: ['components/DetailBar.tsx', 'components/MonitorDetail.tsx'],
    rules: {
      'react-hooks/purity': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    '.open-next/**',
    'out/**',
    'build/**',
    'coverage/**',
    '.wrangler/**',
    'worker/dist/**',
    'worker/worker-configuration.d.ts',
  ]),
])
