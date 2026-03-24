/**
 * One-time migration: Convert urgencyTriggers objects to plain strings in all brains.
 * Run with: node server/migrate-brain-triggers.mjs
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  const [rows] = await conn.execute('SELECT id, brainName, urgencyTriggers, icpBuyingSignals, icpPainPoints, coreCapabilities, icpIndustries FROM offering_brain');
  
  console.log(`Found ${rows.length} brains to check`);
  
  const jsonFields = ['urgencyTriggers', 'icpBuyingSignals', 'icpPainPoints', 'coreCapabilities', 'icpIndustries'];
  
  for (const row of rows) {
    const updates = {};
    
    for (const field of jsonFields) {
      if (!row[field]) continue;
      
      try {
        const arr = JSON.parse(row[field]);
        if (!Array.isArray(arr)) continue;
        
        let needsUpdate = false;
        const normalised = arr.map(item => {
          if (typeof item === 'string') return item;
          needsUpdate = true;
          // Convert object to a clean string preserving key info
          if (typeof item === 'object' && item !== null) {
            const type = item.type || '';
            const desc = item.description || item.conversationStarter || item.opener || '';
            if (type && desc) return `${type} — ${desc}`;
            if (desc) return desc;
            if (type) return type;
            return JSON.stringify(item);
          }
          return String(item);
        });
        
        if (needsUpdate) {
          updates[field] = JSON.stringify(normalised);
        }
      } catch (e) {
        console.warn(`  Skipping ${field} for brain ${row.id} (invalid JSON)`);
      }
    }
    
    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `\`${k}\` = ?`).join(', ');
      const values = Object.values(updates);
      values.push(row.id);
      
      await conn.execute(`UPDATE offering_brain SET ${setClauses} WHERE id = ?`, values);
      console.log(`✓ Brain ${row.id} (${row.brainName}): normalised ${Object.keys(updates).join(', ')}`);
    } else {
      console.log(`  Brain ${row.id} (${row.brainName}): already clean`);
    }
  }
  
  // Also check fitCriteria sub-arrays
  const [fitRows] = await conn.execute('SELECT id, brainName, fitCriteria FROM offering_brain WHERE fitCriteria IS NOT NULL');
  
  for (const row of fitRows) {
    try {
      const fc = JSON.parse(row.fitCriteria);
      let needsUpdate = false;
      
      for (const key of ['mustHave', 'niceToHave', 'disqualifiers']) {
        if (!Array.isArray(fc[key])) {
          fc[key] = [];
          needsUpdate = true;
          continue;
        }
        const normalised = fc[key].map(item => {
          if (typeof item === 'string') return item;
          needsUpdate = true;
          if (typeof item === 'object' && item !== null) {
            return item.description || item.type || JSON.stringify(item);
          }
          return String(item);
        });
        fc[key] = normalised;
      }
      
      if (needsUpdate) {
        await conn.execute('UPDATE offering_brain SET fitCriteria = ? WHERE id = ?', [JSON.stringify(fc), row.id]);
        console.log(`✓ Brain ${row.id} (${row.brainName}): normalised fitCriteria`);
      }
    } catch (e) {
      console.warn(`  Skipping fitCriteria for brain ${row.id} (invalid JSON)`);
    }
  }
  
  console.log('\nDone. All brain data normalised.');
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
