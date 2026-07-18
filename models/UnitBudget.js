'use strict';

const mongoose = require('mongoose');

/**
 * Birimlerin Ortak Bütçe ve Kaynak Yönetim Modeli
 */
const unitBudgetSchema = new mongoose.Schema({
  unitName: { type: String, required: true, unique: true, index: true }, // 'BAN_BIRIMI', 'SES_BIRIMI', 'SOHBET_BIRIMI'
  budget: { type: Number, default: 0 },   // Birim TL Havuzu
  diamonds: { type: Number, default: 0 }  // Birim Elmas Havuzu
}, { timestamps: true });

const UnitBudget = mongoose.models.UnitBudget
  || mongoose.model('UnitBudget', unitBudgetSchema);

module.exports = UnitBudget;
