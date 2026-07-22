'use strict';

const { courtCases } = require('./Store');

const CourtCase = {
  findOne(query) {
    return Promise.resolve(courtCases.findOne(query));
  },
  findById(id) {
    return Promise.resolve(courtCases.findById(id));
  },
  find(query) {
    return Promise.resolve(courtCases.find(query));
  },
  create(data) {
    const defaults = {
      caseCode: `DAVA-${Math.floor(100000 + Math.random() * 900000)}`,
      channelId: null,
      status: 'pending_approval', // pending_approval, court_active, closed, archived, rejected
      plaintiffId: null,        // Davacı
      defendantId: null,        // Davalı
      moderatorId: null,        // Savcı / İnceleyen
      lawyerId: null,           // Avukat
      judgeId: null,            // Başhakim / Yargıç
      lawArticle: 'Madde 101',  // Suçlama Maddesi
      lawArticleTitle: 'Spam / Flood',
      reason: 'Belirtilmedi',
      evidence: 'Yok',
      requestedPenalty: '1 Gün Mute / Kamu Hizmeti',
      isBlackmarketLawyer: false,
      briberyState: {
        offered: false,
        amount: 0,
        targetId: null,
        exposed: false
      },
      juryVote: {
        active: false,
        endsAt: null,
        guiltyVotes: [],
        innocentVotes: []
      },
      witnesses: [], // [{ userId, userName, statement }]
      verdict: null, // acquitted, community_service, mouth_tape, jail, slander_penalty, fine
      verdictNote: null,
      verdictBy: null,
      communityService: {
        active: false,
        targetCount: 0,
        currentCount: 0,
        roleId: null
      },
      jailTask: {
        active: false,
        targetCount: 0,
        currentCount: 0,
        bailAmount: 0,
        roleId: null
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return Promise.resolve(courtCases.create({ ...defaults, ...data }));
  }
};

function CourtCaseConstructor(data) {
  const instance = { ...data };
  instance.save = function () {
    if (instance._id) {
      const stored = courtCases.findOne({ _id: instance._id });
      if (stored) {
        Object.assign(stored, instance, { updatedAt: new Date() });
        stored.save();
        return Promise.resolve(instance);
      }
    }
    return CourtCase.create(instance);
  };
  return instance;
}

CourtCaseConstructor.findOne = CourtCase.findOne;
CourtCaseConstructor.findById = CourtCase.findById;
CourtCaseConstructor.find = CourtCase.find;
CourtCaseConstructor.create = CourtCase.create;

module.exports = CourtCaseConstructor;
