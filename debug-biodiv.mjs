import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get BIODIV-WIND data
const [rows] = await conn.execute(
  "SELECT id, name, websiteUrl, primaryDomain, apolloId, enrichmentStatus, fitScore, urgencyScore, briefGeneratedAt, salesApproachGeneratedAt, generatedWithBrainId, CHAR_LENGTH(briefData) as briefLen, CHAR_LENGTH(salesApproachData) as approachLen FROM companies WHERE name LIKE '%BIODIV%'"
);
console.log('BIODIV-WIND rows:', rows.length);
rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

if (rows.length > 0) {
  const id = rows[0].id;
  // Check brain outputs
  const [outputs] = await conn.execute(
    'SELECT brainId, CHAR_LENGTH(briefData) as briefLen, CHAR_LENGTH(salesApproachData) as approachLen, briefGeneratedAt, salesApproachGeneratedAt FROM company_brain_outputs WHERE companyId = ?',
    [id]
  );
  console.log('\nBrain outputs for company', id, ':', outputs);
}

// Check the stuck job details
const [jobs] = await conn.execute(
  "SELECT * FROM batch_jobs WHERE currentCompany = 'BIODIV-WIND' ORDER BY createdAt DESC LIMIT 3"
);
console.log('\nJobs stuck on BIODIV-WIND:');
jobs.forEach(j => {
  const age = Math.round((Date.now() - new Date(j.updatedAt).getTime()) / 1000);
  console.log(`  id=${j.id} status=${j.status} enriched=${j.enriched} researched=${j.researched} approached=${j.approached} updatedAt=${age}s ago`);
});

// Check the queue building: what companies are in the DO 10 queue for search 1650001
// The queue picks companies with enrichmentStatus='pending' OR no brain output for the selected brain
// Let's see what the first 10 unprocessed companies look like for the active brain
const [brains] = await conn.execute("SELECT id, brainName, companyName, isActive FROM offering_brain WHERE isActive = 1 LIMIT 1");
console.log('\nActive brain:', brains);

await conn.end();
