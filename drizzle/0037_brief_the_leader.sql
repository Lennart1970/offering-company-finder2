CREATE TABLE `leadinfo_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`searchId` int,
	`companyId` int,
	`companyName` varchar(512) NOT NULL,
	`domain` varchar(256) NOT NULL,
	`rawUrl` varchar(1024),
	`city` varchar(128),
	`country` varchar(8),
	`salesRegion` varchar(64),
	`employees` int,
	`branch` varchar(256),
	`linkedinUrl` varchar(512),
	`salesVolume` varchar(128),
	`totalPages` int DEFAULT 0,
	`totalSessions` int DEFAULT 0,
	`totalDuration` int DEFAULT 0,
	`engagementScore` int DEFAULT 0,
	`pagesViewed` text,
	`topPages` text,
	`intentSignals` text,
	`personas` text,
	`importBatchId` varchar(36),
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadinfo_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leadinfo_visits` ADD CONSTRAINT `leadinfo_visits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leadinfo_visits` ADD CONSTRAINT `leadinfo_visits_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leadinfo_visits` ADD CONSTRAINT `leadinfo_visits_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;