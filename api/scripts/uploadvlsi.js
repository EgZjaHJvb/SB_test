import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import VLSIPathway from '../models/quiz/vlsi/VLSI.model.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, './vlsi_data.json');

let vlsiData;
try {
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  vlsiData = JSON.parse(rawData);
} catch (err) {
  console.error(`❌ Failed to read or parse JSON at ${dataPath}`);
  console.error(err.message);
  process.exit(1);
}

async function uploadData() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    await VLSIPathway.deleteMany({});
    console.log('🧹 Cleared existing VLSI data');

    await VLSIPathway.insertMany(vlsiData);
    console.log('🚀 VLSI data uploaded successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    process.exit(1);
  }
}

uploadData();
