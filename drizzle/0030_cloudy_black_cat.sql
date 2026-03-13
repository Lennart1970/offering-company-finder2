CREATE TABLE `batch_jobs` (
	`id` varchar(36) NOT NULL,
	`searchId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`progress` int NOT NULL DEFAULT 0,
	`currentCompany` varchar(512),
	`totalCompanies` int NOT NULL DEFAULT 0,
	`enriched` int NOT NULL DEFAULT 0,
	`researched` int NOT NULL DEFAULT 0,
	`approached` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`remaining` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `batch_jobs` ADD CONSTRAINT `batch_jobs_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_jobs` ADD CONSTRAINT `batch_jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;