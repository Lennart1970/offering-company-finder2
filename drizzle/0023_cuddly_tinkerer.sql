CREATE TABLE `callOutcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`outcome` enum('reached','voicemail','no_answer','meeting_booked','not_interested') NOT NULL,
	`notes` text,
	`followUpDate` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `callOutcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `callReadinessSummary` text;--> statement-breakpoint
ALTER TABLE `callOutcomes` ADD CONSTRAINT `callOutcomes_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `callOutcomes` ADD CONSTRAINT `callOutcomes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;