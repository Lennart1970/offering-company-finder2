ALTER TABLE `companies` DROP FOREIGN KEY `companies_searchId_searches_id_fk`;
--> statement-breakpoint
ALTER TABLE `companyDecisions` DROP FOREIGN KEY `companyDecisions_searchId_searches_id_fk`;
--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyDecisions` ADD CONSTRAINT `companyDecisions_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;