'use strict';

const mongoose = require('mongoose');

/**
 * Disiplin Soruşturması ve İtiraz Mahkemesi Modeli
 */
const disciplinaryHearingSchema = new mongoose.Schema({
  hearingId: { type: String, required: true, unique: true, index: true },
  targetUserId: { type: String, required: true, index: true },
  reason: { type: String, required: true },
  issuedBy: { type: String, required: true },
  status: { type: String, default: 'pending_defense', enum: ['pending_defense', 'submitted_defense', 'accepted', 'rejected'] },
  defense: { type: String, default: null }
}, { timestamps: true });

const DisciplinaryHearing = mongoose.models.DisciplinaryHearing
  || mongoose.model('DisciplinaryHearing', disciplinaryHearingSchema);

module.exports = DisciplinaryHearing;
