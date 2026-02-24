ALTER TABLE `companyDecisions` DROP FOREIGN KEY `companyDecisions_companyId_companies_id_fk`;
--> statement-breakpoint
ALTER TABLE `contacts` DROP FOREIGN KEY `contacts_companyId_companies_id_fk`;
--> statement-breakpoint
ALTER TABLE `salesPackages` DROP FOREIGN KEY `salesPackages_companyId_companies_id_fk`;
--> statement-breakpoint
ALTER TABLE `companyDecisions` ADD CONSTRAINT `companyDecisions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesPackages` ADD CONSTRAINT `salesPackages_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;