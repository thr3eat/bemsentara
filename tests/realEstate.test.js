const test = require('node:test');
const assert = require('assert');
const mongoose = require('mongoose');

test('Real Estate MVP buy/sell flow', async (t) => {
  const Property = require('../models/Property');
  const StaffProgress = require('../models/StaffProgress');
  const market = require('../bot/services/marketPropertyService');

  await mongoose.connect('mongodb://127.0.0.1:27017/bemtest', { useNewUrlParser: true, useUnifiedTopology: true });
  await Property.deleteMany({});
  await StaffProgress.deleteMany({});

  const prop = new Property({ name: 'Test Sektör A', description: 'Test', baseValue: 2500 });
  await prop.save();

  const user = new StaffProgress({ userId: 'user1', guildId: 'g' });
  user.gamification = { ecoCoins: 10000 };
  await user.save();

  const list = await market.listActiveProperties(4);
  assert.strictEqual(list.length, 1);

  const price = market.computePrice(list[0]);
  const buyRes = await market.buyProperty('user1', list[0]._id, price);
  assert.strictEqual(buyRes.success, true);

  const sellRes = await market.sellProperty('user1', list[0]._id);
  assert.strictEqual(sellRes.success, true);

  await mongoose.connection.close();
});
