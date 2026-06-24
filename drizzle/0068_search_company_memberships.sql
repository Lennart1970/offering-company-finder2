-- RUN ON: TiDB / MySQL (DATABASE_URL) — NOT Supabase PostgreSQL
-- Supabase already uses lt_campaign_companies for campaign links on the read replica.
-- LeadTrigger app code reads/writes search_company_memberships on MySQL only.

CREATE TABLE `search_company_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchId` int NOT NULL,
	`companyId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_company_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `search_company_memberships_search_company_unique` UNIQUE(`searchId`,`companyId`)
);
--> statement-breakpoint
ALTER TABLE `search_company_memberships` ADD CONSTRAINT `search_company_memberships_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `search_company_memberships` ADD CONSTRAINT `search_company_memberships_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;
