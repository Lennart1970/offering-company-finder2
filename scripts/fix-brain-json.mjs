import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const fields = ['coreCapabilities','valuePropositions','icpIndustries','icpPainPoints','icpBuyingSignals','fitCriteria','urgencyTriggers'];

const [brains] = await conn.execute(
  `SELECT id, brainName, coreCapabilities, valuePropositions, icpIndustries, icpPainPoints, icpBuyingSignals, fitCriteria, urgencyTriggers FROM offering_brain WHERE status = 'completed'`
);

console.log(`Checking ${brains.length} completed brains...`);

let fixed = 0;
let ok = 0;

for (const b of brains) {
  for (const f of fields) {
    const val = b[f];
    if (!val) continue;
    try {
      JSON.parse(val);
      ok++;
    } catch (e) {
      console.log(`CORRUPT brain ${b.id} "${b.brainName}" field: ${f}`);
      console.log(`  Raw (first 200): ${val.substring(0, 200)}`);
      
      // Fix: convert comma-separated plain string to JSON array
      // This handles the case where the field was saved as plain text instead of JSON
      let fixedVal;
      
      // Check if it looks like a JSON object (starts with {)
      if (val.trim().startsWith('{')) {
        // Try to salvage as object - skip, too risky
        console.log(`  -> Skipping object-type corruption (manual fix needed)`);
        continue;
      }
      
      // Treat as comma-separated list of strings
      const items = val.split(',').map(s => s.trim()).filter(Boolean);
      fixedVal = JSON.stringify(items);
      
      console.log(`  -> Fixed to JSON array with ${items.length} items`);
      
      await conn.execute(`UPDATE offering_brain SET ${f} = ? WHERE id = ?`, [fixedVal, b.id]);
      fixed++;
    }
  }
}

console.log(`\nDone. ${ok} fields OK, ${fixed} fields fixed.`);
await conn.end();
