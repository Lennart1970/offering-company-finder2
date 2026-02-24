import { stopNationalScan } from "./server/nationalScan";

async function main() {
  console.log("Stopping national scan...");
  
  try {
    const result = stopNationalScan();
    console.log("Stop signal sent:", result);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  process.exit(0);
}

main();
