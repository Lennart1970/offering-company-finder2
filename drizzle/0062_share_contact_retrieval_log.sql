CREATE TABLE `share_contact_retrieval_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorEmail` varchar(320) NOT NULL,
	`domain` varchar(128) NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`companyName` varchar(300),
	`actionType` enum('decision_makers','all_personnel') NOT NULL,
	`contactsReturned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_contact_retrieval_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `share_contact_retrieval_log` ADD CONSTRAINT `share_contact_retrieval_log_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;
