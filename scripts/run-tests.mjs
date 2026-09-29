/**
 * Minimal test runner for the pure finance calculation layers.
 *
 * The project has no test framework installed, so this:
 *   1. transpiles the calculation entry points with the project's own `tsc`
 *      (TypeScript 6.0 CLI, pure CommonJS output) into `.test-build/`,
 *   2. runs the plain-JS tests in `tests/` with Node's built-in test runner
 *      (`node --test`), which needs no extra dependencies.
 *
 * Usage: npm test
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.test-build');

const tscJs = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(outDir, { recursive: true, force: true });

console.log('[tests] transpiling services/safeToSpend.ts + services/tokenClaims.ts + components/reports/reportData.ts + components/reports/reportChartMath.ts + components/insights/calendarData.ts + components/insights/insightMetrics.ts → .test-build/');
const build = spawnSync(
  process.execPath,
  [
    tscJs,
    '--ignoreConfig',
    path.join('services', 'safeToSpend.ts'),
    path.join('services', 'tokenClaims.ts'),
    path.join('components', 'reports', 'reportData.ts'),
    path.join('components', 'reports', 'reportChartMath.ts'),
    path.join('components', 'insights', 'calendarData.ts'),
    path.join('components', 'insights', 'insightMetrics.ts'),
    '--outDir',
    outDir,
    '--module',
    'node16',
    '--moduleResolution',
    'node16',
    '--target',
    'es2020',
    '--esModuleInterop',
    '--skipLibCheck',
  ],
  { cwd: root, stdio: 'inherit' },
);

if (build.status !== 0) {
  console.error('[tests] TypeScript compile failed.');
  process.exit(build.status ?? 1);
}

console.log('[tests] running node --test tests/');
const run = spawnSync(
  process.execPath,
  ['--test', path.join('tests', 'finance.test.mjs'), path.join('tests', 'reports.test.mjs'), path.join('tests', 'reportChartMath.test.mjs'), path.join('tests', 'calendar.test.mjs'), path.join('tests', 'authSession.test.mjs')],
  { cwd: root, stdio: 'inherit' },
);

process.exit(run.status ?? 1);