'use strict';

const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  ownerId: { type: String, default: null, index: true },
  baseValue: { type: Number, default: 2500 },
  volatility: { type: Number, default: 0.05 }, // percent change driver
  forSale: { type: Boolean, default: true },
  lastActivityAt: { type: Date, default: null }
}, { timestamps: true });

const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);
module.exports = Property;
