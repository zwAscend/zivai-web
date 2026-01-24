import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import fs from 'fs';
import path from 'path';
import Plan from '../models/planModel.js';

// Load env vars early
dotenv.config();
//hdsshdss

// DEBUG
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is missing from .env');
  process.exit(1);
}

const loadPlans = async () => {
  try {
    console.log('⏳ Connecting to DB...');
    await connectDB(); // MUST be awaited
    console.log('✅ DB connected');

    const filePath = path.resolve('data', 'plans.json');
    const plans = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!Array.isArray(plans)) {
      throw new Error('❌ plans.json must be an array');
    }

    const inserted = await Plan.insertMany(plans);
    console.log(`✅ Inserted ${inserted.length} plans successfully`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error loading plans:', error.message);
    process.exit(1);
  }
};

loadPlans();
