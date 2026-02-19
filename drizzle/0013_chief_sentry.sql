CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`apolloPersonId` varchar(128),
	`firstName` varchar(128),
	`lastName` varchar(128),
	`fullName` varchar(256),
	`title` varchar(256),
	`email` varchar(320),
	`phone` varchar(64),
	`linkedinUrl` varchar(512),
	`searchedTitle` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;