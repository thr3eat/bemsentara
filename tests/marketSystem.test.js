const test = require('node:test');
const assert = require('node:assert/strict');

const { getMarketSnapshot, calculateSalaryBreakdown } = require('../bot/services/marketSystem');

test('getMarketSnapshot returns bull market values in stable conditions', () => {
  const snapshot = getMarketSnapshot({ pendingTickets: 0, warnings: 0, chatMessages: 120, activeStaff: 6 });

  assert.equal(snapshot.state, 'Boğa Piyasası');
  assert.equal(snapshot.multiplier, 2.5);
  assert.equal(snapshot.diamondRate, 8);
  assert.equal(snapshot.interestRate, 14);
  assert.equal(snapshot.crisisTaxRate, 0.1);
});

test('getMarketSnapshot falls into crash mode when risk spikes', () => {
  const snapshot = getMarketSnapshot({ pendingTickets: 12, warnings: 6, chatMessages: 5, activeStaff: 2 });

  assert.equal(snapshot.state, 'Piyasa Çöktü');
  assert.equal(snapshot.multiplier, 0.5);
  assert.equal(snapshot.diamondRate, 35);
  assert.equal(snapshot.interestRate, 0);
  assert.equal(snapshot.crisisTaxRate, 0.15);
});

test('calculateSalaryBreakdown uses market multiplier and dynamic tax', () => {
  const breakdown = calculateSalaryBreakdown(
    { voiceMinutes: 60, ticketsSolved: 2, moderationActions: 1 },
    { pendingTickets: 0, warnings: 0, chatMessages: 120, activeStaff: 6 }
  );

  assert.equal(breakdown.gross, 785);
  assert.equal(breakdown.taxDeduction, 78);
  assert.equal(breakdown.net, 707);
  assert.equal(breakdown.snapshot.state, 'Boğa Piyasası');
});
