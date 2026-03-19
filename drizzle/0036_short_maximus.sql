CREATE TABLE `campaign_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchId` int NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(512) NOT NULL,
	`jobType` enum('full','brief_only') NOT NULL DEFAULT 'full',
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaign_queue` ADD CONSTRAINT `campaign_queue_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_queue` ADD CONSTRAINT `campaign_queue_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_queue` ADD CONSTRAINT `campaign_queue_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;