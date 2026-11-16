import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
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
