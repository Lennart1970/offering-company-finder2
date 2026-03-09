CREATE TABLE `niches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`searchId` int,
	`brainId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`companyCount` int NOT NULL DEFAULT 0,
	`topKeywords` text,
	`sampleCompanies` text,
	`companyIds` text,
	`centroid` text,
	`rationale` text,
	`fitScore` int,
	`fitReasoning` text,
	`scoreBreakdown` text,
	`scoredAt` timestamp,
	`scoredWithBrainId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `niches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `niches` ADD CONSTRAINT `niches_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `niches` ADD CONSTRAINT `niches_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `niches` ADD CONSTRAINT `niches_brainId_offering_brain_id_fk` FOREIGN KEY (`brainId`) REFERENCES `offering_brain`(`id`) ON DELETE set null ON UPDATE no action;