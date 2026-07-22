'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LAW_ARTICLES, getSabikaKaydi } = require('../bot/services/courtService');
const CourtCase = require('../models/CourtCase');
const User = require('../models/User');

test('LAW_ARTICLES contains mandatory server law items including Madde 102', () => {
  assert.equal(LAW_ARTICLES['101'].code, 'Madde 101');
  assert.equal(LAW_ARTICLES['102'].code, 'Madde 102');
  assert.equal(LAW_ARTICLES['204'].code, 'Madde 204');
  assert.equal(LAW_ARTICLES['301'].code, 'Madde 301');
  assert.equal(LAW_ARTICLES['606'].code, 'Madde 606');
  assert.equal(LAW_ARTICLES['707'].code, 'Madde 707');
});

test('CourtCase model supports prosecution, KYOK, indictment and appeal fields', async () => {
  const caseCode = `TEST-${Date.now()}`;
  const cCase = await CourtCase.create({
    caseCode,
    phase: 'prosecution',
    plaintiffId: '111222333',
    defendantId: '444555666',
    lawArticle: 'Madde 102',
    reason: 'Huzur bozma'
  });

  assert.equal(cCase.phase, 'prosecution');
  assert.match(cCase.investigationNo, /Dosya No: \d{4}\/\d+/);

  cCase.phase = 'trial';
  cCase.indictmentDetails = 'Kamu davası açılması talebi';
  cCase.appeals.push({ level: 'istinaf', appellantId: '444555666', reason: 'Ağır ceza kararı', verdict: 'Pending', createdAt: new Date() });
  await cCase.save();

  const fetched = await CourtCase.findOne({ caseCode });
  assert.equal(fetched.phase, 'trial');
  assert.equal(fetched.appeals.length, 1);
  assert.equal(fetched.appeals[0].level, 'istinaf');
});

test('User criminal record and Örnek Vatandaş tracking', async () => {
  const testUserId = `USER-${Date.now()}`;
  let user = await User.create({ discordId: testUserId });

  let embed = await getSabikaKaydi(testUserId);
  assert.match(embed.data.description, /ÖRNİK VATANDAŞ/);

  user.criminalRecord.push({
    caseCode: 'DAVA-12345',
    lawArticle: 'Madde 101',
    verdict: 'community_service',
    date: new Date()
  });
  user.isOrnekVatandas = false;
  await user.save();

  embed = await getSabikaKaydi(testUserId);
  assert.match(embed.data.description, /SABIKA KAYDI VAR/);
});

test('CourtCase flexible caseCode lookup (case-insensitive and prefix tolerant)', async () => {
  const num = Math.floor(100000 + Math.random() * 900000);
  const code = `DAVA-${num}`;
  await CourtCase.create({
    caseCode: code,
    plaintiffId: '999111',
    defendantId: '888222',
    reason: 'Test case lookup'
  });

  const match1 = await CourtCase.findOne({ caseCode: code });
  assert.ok(match1);

  const match2 = await CourtCase.findOne({ caseCode: `dava-${num}` });
  assert.ok(match2);

  const match3 = await CourtCase.findOne({ caseCode: `${num}` });
  assert.ok(match3);
});

test('CourtCase contract signing updates case status to closed and acquitted', async () => {
  const { handleContractSignature } = require('../bot/services/courtService');
  const code = `DAVA-${Math.floor(100000 + Math.random() * 900000)}`;
  const defId = 'DEF-USER-777';

  const courtCase = await CourtCase.create({
    caseCode: code,
    plaintiffId: 'PLA-USER-111',
    defendantId: defId,
    contract: {
      terms: '200 Coin ödeme ve özür',
      status: 'pending_signature',
      sentBy: 'ADMIN-1',
      createdAt: new Date()
    }
  });

  const fakeInteraction = {
    user: { id: defId },
    update: async () => {},
    client: { guilds: { cache: { values: () => [] } } }
  };

  await handleContractSignature(fakeInteraction, code, true);

  const updated = await CourtCase.findOne({ caseCode: code });
  assert.equal(updated.contract.status, 'signed');
  assert.equal(updated.status, 'closed');
  assert.equal(updated.verdict, 'acquitted');
});


