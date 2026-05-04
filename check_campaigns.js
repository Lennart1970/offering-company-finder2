const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Check distinct campaigns synced today and their created_at range
s.from('lt_mns_company_pages')
  .select('campaign_name, campaign_id, created_at, synced_at')
  .gte('synced_at', '2026-05-04T00:00:00')
  .order('synced_at', { ascending: false })
  .limit(200)
  .then(r => {
    if (r.error) { console.log('ERROR:', r.error.message); return; }
    const campaigns = {};
    r.data.forEach(row => {
      const k = row.campaign_name;
      if (!campaigns[k]) {
        campaigns[k] = { created_at_min: row.created_at, created_at_max: row.created_at, synced_at: row.synced_at, count: 0 };
      }
      campaigns[k].count++;
      if (row.created_at < campaigns[k].created_at_min) campaigns[k].created_at_min = row.created_at;
      if (row.created_at > campaigns[k].created_at_max) campaigns[k].created_at_max = row.created_at;
    });
    Object.entries(campaigns).forEach(([name, info]) => {
      console.log(`\nCampaign: ${name}`);
      console.log(`  created_at range: ${info.created_at_min} → ${info.created_at_max}`);
      console.log(`  synced_at: ${info.synced_at}`);
      console.log(`  rows: ${info.count}`);
    });
  });
