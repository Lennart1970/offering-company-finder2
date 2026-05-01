const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  // 1. Check all angles
  const { data: angles } = await sb.from('lt_mns_angles').select('id, name, description');
  console.log('\n=== lt_mns_angles ===');
  (angles || []).forEach(a => console.log(' -', a.name, '|', a.description?.substring(0, 60)));

  // 2. Check tables that might store angle references
  const tablesToCheck = [
    'lt_mns_company_angles',
    'lt_mns_search_angles', 
    'lt_mns_brain_angles',
    'lt_mns_searches',
    'lt_mns_companies',
    'lt_mns_watchlist',
  ];
  
  for (const t of tablesToCheck) {
    const { data, error } = await sb.from(t).select('*').limit(1);
    if (error) {
      console.log(`\n${t}: NOT FOUND (${error.message})`);
    } else {
      const cols = Object.keys(data[0] || {});
      const angleCols = cols.filter(c => c.includes('angle') || c.includes('lens'));
      console.log(`\n${t}: cols=${cols.join(', ')}`);
      if (angleCols.length > 0) console.log(`  >>> angle cols: ${angleCols.join(', ')}`);
    }
  }

  // 3. Check how briefGenerator uses angles - look at lt_mns_company_briefs
  const { data: briefs } = await sb.from('lt_mns_company_briefs').select('*').limit(1);
  if (briefs) {
    console.log('\n=== lt_mns_company_briefs cols ===', Object.keys(briefs[0] || {}));
  }

  // 4. Check the prospect_finder intelligence tables
  const { data: intel } = await sb.from('lt_mns_prospect_intelligence').select('*').limit(1);
  if (intel) {
    console.log('\n=== lt_mns_prospect_intelligence cols ===', Object.keys(intel[0] || {}));
  }
}

main().catch(console.error);
