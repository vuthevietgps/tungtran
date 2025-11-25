const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/tungtran';

function resolveEnvPath() {
  const envPath = path.join(__dirname, '..', '.env');
  return fs.existsSync(envPath) ? envPath : null;
}

function loadEnv() {
  const envPath = resolveEnvPath();
  if (!envPath) {
    return;
  }
  // Lazy load dotenv only if available
  try {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: envPath });
  } catch (err) {
    console.warn('dotenv not installed, falling back to process env only');
  }
}

loadEnv();

const mongoUri = process.env.MONGODB_URI || DEFAULT_URI;
const passwordPlain = process.env.SEED_DEFAULT_PASSWORD || '123456789';

const seedUsers = [
  { email: 'sale1@example.com', fullName: 'Sale One', role: 'SALE' },
  { email: 'sale2@example.com', fullName: 'Sale Two', role: 'SALE' },
  { email: 'sale3@example.com', fullName: 'Sale Three', role: 'SALE' },
  { email: 'teacher1@example.com', fullName: 'Teacher One', role: 'TEACHER' },
  { email: 'teacher2@example.com', fullName: 'Teacher Two', role: 'TEACHER' },
  { email: 'teacher3@example.com', fullName: 'Teacher Three', role: 'TEACHER' },
  { email: 'teacher4@example.com', fullName: 'Teacher Four', role: 'TEACHER' },
  { email: 'manager1@example.com', fullName: 'Manager One', role: 'MANAGER' },
  { email: 'manager2@example.com', fullName: 'Manager Two', role: 'MANAGER' },
  { email: 'hcns1@example.com', fullName: 'HCNS One', role: 'HCNS' },
  { email: 'hcns2@example.com', fullName: 'HCNS Two', role: 'HCNS' },
  { email: 'partime1@example.com', fullName: 'Partime One', role: 'PARTIME' },
  { email: 'partime2@example.com', fullName: 'Partime Two', role: 'PARTIME' },
  { email: 'partime3@example.com', fullName: 'Partime Three', role: 'PARTIME' },
];

async function run() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured');
  }

  console.log('Connecting to', mongoUri);
  await mongoose.connect(mongoUri);

  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const collection = mongoose.connection.collection('users');
  for (const user of seedUsers) {
    const email = user.email.toLowerCase();
    const now = new Date();
    const updateResult = await collection.updateOne(
      { email },
      {
        $set: {
          fullName: user.fullName,
          role: user.role,
          password: passwordHash,
          status: 'ACTIVE',
          updatedAt: now,
        },
        $setOnInsert: {
          email,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    if (updateResult.upsertedCount) {
      console.log('Created user', email);
    } else if (updateResult.modifiedCount) {
      console.log('Updated user', email);
    } else {
      console.log('No changes for', email);
    }
  }
}

run()
  .then(() => console.log('Seeding completed'))
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
