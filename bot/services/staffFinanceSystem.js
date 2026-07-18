'use strict';

function createAuctionState(options = {}) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const auctionItems = [
    { key: 'weekly_salary_multiplier', label: '🎁 Haftalık +%15 Maaş Çarpanı', cost: 4000 },
    { key: 'extra_leave_days', label: '🏖️ Ekstra 2 Gün İzin Kredisi', cost: 2500 },
    { key: 'head_advisor_role', label: '👑 1 Haftalık Özel Baş Danışman Rolü', cost: 7000 }
  ];

  return {
    isActive: true,
    startsAt: now,
    endsAt,
    itemKey: auctionItems[0].key,
    itemLabel: auctionItems[0].label,
    highestOffer: 0,
    highestBidderId: null,
    itemOptions: auctionItems,
    ...options.staffFinanceSettings
  };
}

function getAuctionStatus(state) {
  if (!state) return { isActive: false, highestOffer: 0, itemLabel: 'Yok' };
  return {
    isActive: Boolean(state.isActive),
    highestOffer: Number(state.highestOffer || 0),
    itemLabel: state.itemLabel || 'Yok',
    endsAt: state.endsAt,
    bidderId: state.highestBidderId || null
  };
}

function resolveLoungeGame(gameType, stake) {
  const safeStake = Number(stake || 0);
  if (gameType === 'coinflip') {
    const outcome = Math.random() < 0.5 ? 'win' : 'lose';
    const payout = outcome === 'win' ? safeStake * 2 : 0;
    return { outcome, payout, stake: safeStake };
  }

  if (gameType === 'highrisk') {
    const outcome = Math.random() < 0.35 ? 'win' : 'lose';
    const payout = outcome === 'win' ? safeStake * 3 : 0;
    return { outcome, payout, stake: safeStake };
  }

  return { outcome: 'lose', payout: 0, stake: safeStake };
}

function createLotteryState() {
  return {
    isOpen: true,
    ticketCost: 200,
    maxTicketsPerUser: 3,
    pool: 0,
    winnerId: null,
    lastDrawAt: null
  };
}

function buyLotteryTicket(state, userId) {
  if (!state) return { success: false, message: 'Piyango havuzu bulunamadı.' };
  if (!state.isOpen) return { success: false, message: 'Piyango satışları kapalı.' };

  state.pool = (state.pool || 0) + state.ticketCost;
  state.entries = state.entries || [];
  state.entries.push(userId);
  return { success: true, pool: state.pool, entries: state.entries.length };
}

function drawLotteryWinner(state) {
  if (!state || !state.entries || state.entries.length === 0) {
    return { success: false, message: 'Katılımcı yok.' };
  }

  const winnerId = state.entries[Math.floor(Math.random() * state.entries.length)];
  state.winnerId = winnerId;
  state.lastDrawAt = new Date();
  state.isOpen = false;
  return { success: true, winnerId, pool: state.pool };
}

module.exports = {
  createAuctionState,
  getAuctionStatus,
  resolveLoungeGame,
  createLotteryState,
  buyLotteryTicket,
  drawLotteryWinner
};
