CREATE TABLE `companyDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`searchId` int NOT NULL,
	`userId` int NOT NULL,
	`decision` enum('call_today','park','not_relevant') NOT NULL,
	`reasonCode` varchar(50),
	`reasonNotes` text,
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companyDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `excludedCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`codeType` enum('sic','naics') NOT NULL,
	`code` varchar(16) NOT NULL,
	`codeDescription` text,
	`rejectionCount` int NOT NULL DEFAULT 1,
	`lastRejectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `excludedCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companyDecisions` ADD CONSTRAINT `companyDecisions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyDecisions` ADD CONSTRAINT `companyDecisions_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companyDecisions` ADD CONSTRAINT `companyDecisions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `excludedCodes` ADD CONSTRAINT `excludedCodes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;