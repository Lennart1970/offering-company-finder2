CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchId` int NOT NULL,
	`apolloId` varchar(128),
	`name` varchar(512) NOT NULL,
	`websiteUrl` varchar(512),
	`primaryDomain` varchar(256),
	`linkedinUrl` varchar(512),
	`phone` varchar(64),
	`foundedYear` int,
	`revenue` varchar(64),
	`headcountGrowth` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyWebsite` varchar(512) NOT NULL,
	`location` varchar(256) NOT NULL,
	`offeringName` text,
	`offeringDescription` text,
	`targetMarket` text,
	`valueProposition` text,
	`keywords` text,
	`crossBorderIndicators` text,
	`status` enum('pending','extracting','searching','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_searchId_searches_id_fk` FOREIGN KEY (`searchId`) REFERENCES `searches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `searches` ADD CONSTRAINT `searches_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;