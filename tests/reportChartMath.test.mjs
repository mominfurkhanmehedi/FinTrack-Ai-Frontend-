import { strict as assert } from 'node:assert';
import test from 'node:test';

import { buildPath, clamp, niceMax, str } from '../.test-build/components/reports/reportChartMath.js';

test('1. buildPath emits exactly one leading M and valid segments', () => {
  const d = buildPath([
    { x: 55, y: 170.68 },
    { x: 63.82, y: 170.68 },
    { x: 72.65, y: 105.5 },
  ]);
  assert.equal(d, 'M 55 170.68 L 63.82 170.68 L 72.65 105.5');
  assert.ok(!d.includes('MM'), 'must not contain a doubled M command');
  assert.ok(d.startsWith('M '), 'must start with a single M command');
});

test('2. buildPath skips NaN/undefined/Infinity coordinates (coords stay numeric)', () => {
  const d = buildPath([
    { x: 55, y: 170.68 },
    { x: Number.NaN, y: 170.68 },
    { x: 63.82, y: Number.NaN },
    { x: undefined, y: 70 },
    { x: 72.65, y: 105.5 },
    { x: 100, y: Number.POSITIVE_INFINITY },
  ]);
  assert.equal(d, 'M 55 170.68 L 72.65 105.5');
});

test('3. buildPath returns empty string with fewer than 2 valid points', () => {
  assert.equal(buildPath([]), '');
  assert.equal(buildPath([{ x: 55, y: 170.68 }]), '');
  assert.equal(buildPath([{ x: Number.NaN, y: 1 }, { x: 2, y: 3 }]), '');
});

test('4. buildPath never contains NaN, Infinity, undefined or MM tokens', () => {
  for (let i = 0; i < 50; i++) {
    const pts = Array.from({ length: 7 }, () => ({
      x: i % 3 === 0 ? Number.NaN : Number(i) * 1.5,
      y: i % 5 === 0 ? Number.NEGATIVE_INFINITY : Number(i) - 2,
    }));
    const d = buildPath(pts);
    assert.ok(!d.includes('NaN'));
    assert.ok(!d.includes('Infinity'));
    assert.ok(!d.includes('undefined'));
    assert.ok(!d.includes('MM'));
    const coords = d.split(/[ML\s]+/).filter(Boolean);
    for (const c of coords) assert.ok(Number.isFinite(Number(c)), `coordinate must be finite, got ${c}`);
  }
});

test('5. helper math stays finite and clamped', () => {
  assert.equal(str(Number.NaN), '0');
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(niceMax(1200), 2000);
  assert.equal(niceMax(0), 1);
});