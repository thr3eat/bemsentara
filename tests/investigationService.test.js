'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canStartInvestigationToday } = require('../bot/services/investigationService');

test('canStartInvestigationToday allows starts below the daily limit', () => {
  assert.equal(canStartInvestigationToday(2, 3), true);
});

test('canStartInvestigationToday blocks starts at the daily limit', () => {
  assert.equal(canStartInvestigationToday(3, 3), false);
});
