'use strict';

const Property = require('../../models/Property');
const StaffProgress = require('../../models/StaffProgress');

function computePrice(property) {
  if (!property) return 0;
  const base = Number(property.baseValue || 0);
  const vol = Number(property.volatility || 0.05);
  // Simple price model: base * (1 + vol * ageHoursFactor)
  const last = property.lastActivityAt ? new Date(property.lastActivityAt).getTime() : Date.now();
  const ageHours = Math.max(0, (Date.now() - last) / (1000 * 60 * 60));
  const timeFactor = 1 + vol * Math.min(48, ageHours) / 24; // up to ~2x over 48h
  return Math.max(100, Math.round(base * timeFactor));
}

async function listActiveProperties(limit = 4) {
  const props = await Property.find().limit(limit).lean();
  return props.map(p => ({ ...p, currentPrice: computePrice(p) }));
}

async function buyProperty(buyerId, propertyId, price) {
  const prop = await Property.findById(propertyId);
  if (!prop) return { success: false, message: 'Property not found' };
  if (!prop.forSale) return { success: false, message: 'Property is not for sale' };
  const currentPrice = computePrice(prop);
  if (price < currentPrice) return { success: false, message: 'Offered price too low' };

  // transfer ownership
  prop.ownerId = buyerId;
  prop.forSale = false;
  prop.lastActivityAt = new Date();
  await prop.save();

  const p = await StaffProgress.findOne({ userId: buyerId });
  if (p) {
    p.portfolio = p.portfolio || [];
    p.portfolio.push({ propertyId: prop._id.toString(), purchasedAt: new Date(), purchasePrice: currentPrice });
    await p.save();
  }

  return { success: true, property: prop, purchasedAtPrice: currentPrice };
}

async function sellProperty(sellerId, propertyId) {
  const prop = await Property.findById(propertyId);
  if (!prop) return { success: false, message: 'Property not found' };
  if (prop.ownerId !== sellerId) return { success: false, message: 'Not owner' };

  const currentPrice = computePrice(prop);

  // Remove from owner's portfolio
  const p = await StaffProgress.findOne({ userId: sellerId });
  if (p && Array.isArray(p.portfolio)) {
    p.portfolio = p.portfolio.filter(x => x.propertyId !== prop._id.toString());
    await p.save();
  }

  // Reset ownership and put back for sale
  prop.ownerId = null;
  prop.forSale = true;
  prop.lastActivityAt = new Date();
  await prop.save();

  return { success: true, soldFor: currentPrice };
}

module.exports = { computePrice, listActiveProperties, buyProperty, sellProperty };
