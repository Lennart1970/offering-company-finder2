import { runNationalScan } from "./server/nationalScan";

// Run scan for Delaware only (modify the function to accept specific states)
async function main() {
  console.log("Starting Delaware scan...");
  
  // User ID 1 (you)
  const userId = 1;
  
  // We'll call the national scan with test mode, but modify it to just do Delaware
  const result = await runNationalScan(userId, true);
  
  console.log("Scan complete!");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error("Scan failed:", error);
  process.exit(1);
});
