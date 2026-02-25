import { readFileSync } from "fs";
import { parseApolloCSV, mapApolloRowToCompany } from "./server/apolloCSVParser";

const csvContent = readFileSync("/home/ubuntu/upload/apollo-accounts-export(2).csv", "utf-8");

const rows = parseApolloCSV(csvContent);
console.log(`Parsed ${rows.length} companies`);

if (rows.length > 0) {
  const firstCompany = mapApolloRowToCompany(rows[0], 999); // Test searchId
  console.log("First company mapped:");
  console.log(JSON.stringify(firstCompany, null, 2));
}
