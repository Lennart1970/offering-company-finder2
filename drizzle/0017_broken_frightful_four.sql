CREATE TABLE `offering_brain` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(256) NOT NULL,
	`companyWebsite` varchar(512) NOT NULL,
	`offeringSummary` text,
	`coreCapabilities` text,
	`valuePropositions` text,
	`competitiveAdvantages` text,
	`icpIndustries` text,
	`icpCompanySize` text,
	`icpGeography` text,
	`icpPainPoints` text,
	`icpBuyingSignals` text,
	`fitCriteria` text,
	`urgencyTriggers` text,
	`rawResearchData` text,
	`status` enum('researching','completed','failed') NOT NULL DEFAULT 'researching',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offering_brain_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `offering_brain` ADD CONSTRAINT `offering_brain_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;