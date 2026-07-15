const mongoose = require('mongoose');
const StaffProgress = require('../models/StaffProgress');
const { MONGODB_URI } = require('../config');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || MONGODB_URI || 'mongodb://localhost:27017/sentara');
  const allStaff = await StaffProgress.find({});
  console.log("ALL STAFF:", JSON.stringify(allStaff, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
