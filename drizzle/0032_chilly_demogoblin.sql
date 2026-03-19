CREATE TABLE `prototype_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`imageUrls` text NOT NULL,
	`productUrl` varchar(1024),
	`productTypeGuess` text,
	`keyFeatureGuess` text,
	`whatWeStillNeed` text,
	`extractionRaw` text,
	`annualUnits` varchar(128),
	`expectedSop` varchar(128),
	`region` enum('EU','US','APAC','Other'),
	`designIntent` enum('equivalent','modified'),
	`hasBom` tinyint DEFAULT 0,
	`customerNotes` text,
	`customerName` varchar(256),
	`customerEmail` varchar(320),
	`customerCompany` varchar(256),
	`status` enum('draft','analyzing','pending_info','submitted','more_info_requested','sample_requested','costing','completed') NOT NULL DEFAULT 'draft',
	`internalNotes` text,
	`assignedTo` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prototype_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `salesRepProfile` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `salesRepProfileGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `searches` ADD `isArchived` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `prototype_requests` ADD CONSTRAINT `prototype_requests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;