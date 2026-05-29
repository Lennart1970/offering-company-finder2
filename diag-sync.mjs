import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. Check what's in Supabase for campaign 1980003
const { data: pages, error: pErr } = await supabase
  .from("lt_mns_company_pages")
  .select("company_name, domain, campaign_id, synced_at")
  .eq("campaign_id", 1980003)
  .limit(5);

console.log("\n=== lt_mns_company_pages for campaign 1980003 ===");
if (pErr) console.error("Error:", pErr.message);
else console.log("Count:", pages?.length, "\nSample:", JSON.stringify(pages?.slice(0,3), null, 2));

// 2. Check what's in lt_mns_companies for that campaign
const { data: comps, error: cErr } = await supabase
  .from("lt_mns_companies")
  .select("company_name, domain, search_name, synced_at")
  .eq("search_name", "1980003")
  .limit(5);

console.log("\n=== lt_mns_companies search_name=1980003 ===");
if (cErr) console.error("Error:", cErr.message);
else console.log("Count:", comps?.length, "\nSample:", JSON.stringify(comps?.slice(0,3), null, 2));

// 3. Check the most recently synced companies (to confirm sync is working at all)
const { data: recent, error: rErr } = await supabase
  .from("lt_mns_company_pages")
  .select("company_name, campaign_id, synced_at")
  .order("synced_at", { ascending: false })
  .limit(5);

console.log("\n=== Most recently synced company pages ===");
if (rErr) console.error("Error:", rErr.message);
else console.log(JSON.stringify(recent, null, 2));

// 4. Check distinct campaign_ids in Supabase
const { data: campaigns } = await supabase
  .from("lt_mns_company_pages")
  .select("campaign_id")
  .order("campaign_id", { ascending: false })
  .limit(100);

const uniqueCampaigns = [...new Set(campaigns?.map(r => r.campaign_id))].sort((a,b) => b-a);
console.log("\n=== Campaign IDs in lt_mns_company_pages ===");
console.log(uniqueCampaigns.join(", "));
