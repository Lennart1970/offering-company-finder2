import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT * FROM share_allowed_domains');
console.log('Current allowed domains:', rows);

const hasCG = rows.some(r => r.domain === 'connectgroup.com');
if (!hasCG) {
  await conn.execute('INSERT INTO share_allowed_domains (domain) VALUES (?)', ['connectgroup.com']);
  console.log('Seeded connectgroup.com');
} else {
  console.log('connectgroup.com already exists');
}

const [final] = await conn.execute('SELECT * FROM share_allowed_domains');
console.log('Final allowed domains:', final);
await conn.end();
