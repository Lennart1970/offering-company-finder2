CREATE TABLE `brain_share_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`brainId` int NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brain_share_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `brain_share_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `share_access_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`domain` varchar(128) NOT NULL,
	`tokenType` enum('company','list','brain') NOT NULL,
	`tokenValue` varchar(64) NOT NULL,
	`accessGranted` tinyint NOT NULL DEFAULT 0,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `share_allowed_domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domain` varchar(128) NOT NULL,
	`addedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_allowed_domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_allowed_domains_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
ALTER TABLE `brain_share_tokens` ADD CONSTRAINT `brain_share_tokens_brainId_offering_brain_id_fk` FOREIGN KEY (`brainId`) REFERENCES `offering_brain`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `brain_share_tokens` ADD CONSTRAINT `brain_share_tokens_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_allowed_domains` ADD CONSTRAINT `share_allowed_domains_addedBy_users_id_fk` FOREIGN KEY (`addedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;