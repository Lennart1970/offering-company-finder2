CREATE TABLE `share_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareListId` int NOT NULL,
	`shareTokenId` int NOT NULL,
	CONSTRAINT `share_list_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `share_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listToken` varchar(64) NOT NULL,
	`shareListName` varchar(256),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_lists_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_lists_listToken_unique` UNIQUE(`listToken`)
);
--> statement-breakpoint
ALTER TABLE `share_list_items` ADD CONSTRAINT `share_list_items_shareListId_share_lists_id_fk` FOREIGN KEY (`shareListId`) REFERENCES `share_lists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_list_items` ADD CONSTRAINT `share_list_items_shareTokenId_share_tokens_id_fk` FOREIGN KEY (`shareTokenId`) REFERENCES `share_tokens`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_lists` ADD CONSTRAINT `share_lists_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;