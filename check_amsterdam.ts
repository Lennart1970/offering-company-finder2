import { getDb } from "./server/db";

async function checkAmsterdamSearches() {
  const db = await getDb();
  
  const searches = await db.query.searches.findMany({
    where: (searches, { like }) => like(searches.location, "%Amsterdam%"),
    orderBy: (searches, { desc }) => [desc(searches.createdAt)],
    limit: 5,
  });
  
  console.log("Amsterdam searches found:", searches.length);
  for (const search of searches) {
    console.log("\n---");
    console.log("Search ID:", search.id);
    console.log("Location:", search.location);
    console.log("Status:", search.status);
    console.log("Codes searched:", search.codesSearched, "/", search.codesTotal);
    console.log("Error:", search.errorMessage);
    console.log("Created:", search.createdAt);
    
    const companies = await db.query.companies.findMany({
      where: (companies, { eq }) => eq(companies.searchId, search.id),
    });
    console.log("Companies found:", companies.length);
  }
}

checkAmsterdamSearches().catch(console.error);
