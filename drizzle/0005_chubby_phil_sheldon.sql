CREATE TABLE `salesPackages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`packageData` text NOT NULL,
	`markdownContent` text NOT NULL,
	`status` enum('generating','completed','failed') NOT NULL DEFAULT 'generating',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salesPackages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `salesPackages` ADD CONSTRAINT `salesPackages_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesPackages` ADD CONSTRAINT `salesPackages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;