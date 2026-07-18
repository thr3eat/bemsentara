const test = require('node:test');
const assert = require('node:assert/strict');

const { createAuctionState, getAuctionStatus, resolveLoungeGame, createLotteryState, buyLotteryTicket, drawLotteryWinner } = require('../bot/services/staffFinanceSystem');

test('createAuctionState initializes a weekly auction with a prize and deadline', () => {
  const state = createAuctionState({ staffFinanceSettings: {} });

  assert.equal(state.isActive, true);
  assert.equal(state.itemKey, 'weekly_salary_multiplier');
  assert.ok(state.endsAt instanceof Date);
});

test('resolveLoungeGame returns a payout for a winning coin flip', () => {
  const result = resolveLoungeGame('coinflip', 500);

  assert.ok(result.payout >= 0);
  assert.ok(['win', 'lose'].includes(result.outcome));
});

test('createLotteryState and drawLotteryWinner manage a basic lottery flow', () => {
  const state = createLotteryState();
  const first = buyLotteryTicket(state, 'user-1');
  const second = buyLotteryTicket(state, 'user-2');

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(state.pool, 400);

  const drawn = drawLotteryWinner(state);
  assert.equal(drawn.success, true);
  assert.ok(['user-1', 'user-2'].includes(drawn.winnerId));
});
