CREATE TABLE `company_brain_outputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`brainId` int NOT NULL,
	`urgencyScore` int,
	`fitScore` int,
	`fitScoreData` text,
	`briefData` text,
	`briefGeneratedAt` timestamp,
	`salesApproachData` text,
	`salesApproachGeneratedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_brain_outputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_brain_outputs` ADD CONSTRAINT `company_brain_outputs_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_brain_outputs` ADD CONSTRAINT `company_brain_outputs_brainId_offering_brain_id_fk` FOREIGN KEY (`brainId`) REFERENCES `offering_brain`(`id`) ON DELETE cascade ON UPDATE no action;