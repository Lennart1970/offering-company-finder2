CREATE TABLE `share_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`brainId` int NOT NULL,
	`createdBy` int NOT NULL,
	`shareListName` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `share_tokens` ADD CONSTRAINT `share_tokens_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_tokens` ADD CONSTRAINT `share_tokens_brainId_offering_brain_id_fk` FOREIGN KEY (`brainId`) REFERENCES `offering_brain`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_tokens` ADD CONSTRAINT `share_tokens_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;