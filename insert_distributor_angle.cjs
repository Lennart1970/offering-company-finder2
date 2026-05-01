/**
 * Insert the Distributor angle into lt_mns_angles with embedding.
 * Run once: node insert_distributor_angle.cjs
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DISTRIBUTOR_ANGLE = {
  name: "Distributor",
  description: `A company that sells, distributes, or resells products to end-users through an established commercial channel. 
They operate as a dealer, reseller, importer, wholesaler, or specialty retailer with an existing customer base in the relevant end-market. 
They have commercial infrastructure: sales team, showroom or online store, logistics capability, and established supplier relationships. 
They are NOT the end-user of the product — they are the channel through which end-users are reached. 
Ideal distributor partners have: (1) an existing product portfolio that complements the offering, (2) access to the target end-customer segment, (3) commercial motivation to add new premium products to their range, and (4) the technical capability to support the product post-sale.`,
};

// Embedding text — buyer-characteristics-only, describes what a distributor LOOKS LIKE as a company
const EMBEDDING_TEXT = `A specialty retailer, dealer, importer, or wholesaler that sells products to end-consumers or businesses in a specific niche market. 
They operate physical showrooms, online stores, or B2B sales channels. 
They carry multiple complementary brands and product lines. 
They have an established customer base of enthusiasts, professionals, or businesses in the target end-market. 
They are NOT a manufacturer or technology company. 
They generate revenue through product margins, not service fees. 
They actively seek new premium products to add to their portfolio. 
They have logistics, after-sales support, and customer relationships in place.`;

async function main() {
  console.log('Inserting Distributor angle...');

  // 1. Check if already exists
  const { data: existing } = await sb.from('lt_mns_angles').select('id, name').eq('name', 'Distributor');
  if (existing && existing.length > 0) {
    console.log('Distributor angle already exists:', existing[0].id);
    return;
  }

  // 2. Generate embedding via OpenAI
  console.log('Generating embedding...');
  const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: EMBEDDING_TEXT,
    }),
  });
  
  if (!embeddingRes.ok) {
    const err = await embeddingRes.text();
    throw new Error(`OpenAI embedding failed: ${err}`);
  }
  
  const embeddingData = await embeddingRes.json();
  const embedding = embeddingData.data[0].embedding;
  console.log(`Embedding generated: ${embedding.length} dimensions`);

  // 3. Insert into lt_mns_angles
  const { data: inserted, error } = await sb.from('lt_mns_angles').insert({
    name: DISTRIBUTOR_ANGLE.name,
    description: DISTRIBUTOR_ANGLE.description,
    embedding,
  }).select('id, name');

  if (error) {
    console.error('Insert failed:', error.message);
    return;
  }

  console.log('Distributor angle inserted successfully:', inserted[0]);
  console.log('\nAll angles now:');
  const { data: all } = await sb.from('lt_mns_angles').select('id, name, created_at').order('created_at');
  all.forEach(a => console.log(' -', a.name, '|', a.id));
}

main().catch(console.error);
