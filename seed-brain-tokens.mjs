import mysql from 'mysql2/promise';
import crypto from 'crypto';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all brains
const [brains] = await conn.execute('SELECT id, brainName FROM offering_brain');
console.log(`Found ${brains.length} brains`);

// Get existing tokens
const [existing] = await conn.execute('SELECT brainId FROM brain_share_tokens');
const existingIds = new Set(existing.map(r => r.brainId));
console.log(`Already have tokens for ${existingIds.size} brains`);

// Get the owner user id for created_by
const [users] = await conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
const createdBy = users.length > 0 ? users[0].id : 1;

let created = 0;
for (const brain of brains) {
  if (!existingIds.has(brain.id)) {
    const token = crypto.randomBytes(16).toString('hex');
    await conn.execute(
      'INSERT INTO brain_share_tokens (token, brainId, createdBy) VALUES (?, ?, ?)',
      [token, brain.id, createdBy]
    );
    console.log(`  Created token for brain ${brain.id}: ${brain.brainName}`);
    created++;
  }
}

console.log(`\nDone. Created ${created} new tokens. Total brains with tokens: ${existingIds.size + created}`);
await conn.end();
