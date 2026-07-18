const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureStaffProgressShape } = require('../bot/handlers/modalHandler');

test('ensureStaffProgressShape creates missing stats/daily/gamification containers', () => {
  const progress = {};
  const normalized = ensureStaffProgressShape(progress);

  assert.deepStrictEqual(normalized.daily, {});
  assert.deepStrictEqual(normalized.stats, {});
  assert.deepStrictEqual(normalized.gamification, {});
});
