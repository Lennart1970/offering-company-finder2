import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await createConnection(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS \`brain_share_tokens\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`token\` varchar(64) NOT NULL,
    \`brainId\` int NOT NULL,
    \`createdBy\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`brain_share_tokens_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`brain_share_tokens_token_unique\` UNIQUE(\`token\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`share_access_log\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`email\` varchar(320) NOT NULL,
    \`domain\` varchar(128) NOT NULL,
    \`tokenType\` enum('company','list','brain') NOT NULL,
    \`tokenValue\` varchar(64) NOT NULL,
    \`accessGranted\` tinyint NOT NULL DEFAULT 0,
    \`ipAddress\` varchar(64),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`share_access_log_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`share_allowed_domains\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`domain\` varchar(128) NOT NULL,
    \`addedBy\` int,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`share_allowed_domains_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`share_allowed_domains_domain_unique\` UNIQUE(\`domain\`)
  )`,
  // Seed default allowed domains
  `INSERT IGNORE INTO \`share_allowed_domains\` (\`domain\`) VALUES ('connectgroup.com')`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("✓", sql.slice(0, 60).replace(/\s+/g, " ").trim());
  } catch (e) {
    console.error("✗", e.message);
  }
}

// Add FK constraints separately (ignore if already exist)
const fks = [
  `ALTER TABLE \`brain_share_tokens\` ADD CONSTRAINT \`brain_share_tokens_brainId_fk\` FOREIGN KEY (\`brainId\`) REFERENCES \`offering_brain\`(\`id\`) ON DELETE CASCADE`,
  `ALTER TABLE \`brain_share_tokens\` ADD CONSTRAINT \`brain_share_tokens_createdBy_fk\` FOREIGN KEY (\`createdBy\`) REFERENCES \`users\`(\`id\`)`,
  `ALTER TABLE \`share_allowed_domains\` ADD CONSTRAINT \`share_allowed_domains_addedBy_fk\` FOREIGN KEY (\`addedBy\`) REFERENCES \`users\`(\`id\`)`,
];
for (const fk of fks) {
  try { await conn.execute(fk); console.log("✓ FK added"); } catch { /* already exists */ }
}

await conn.end();
console.log("Migration complete.");
