CREATE TABLE `lt_mns_cg_leads` (
	`id` int NOT NULL,
	`company_name` text NOT NULL,
	`website` text,
	`domain` text,
	`sharepoint_url` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `lt_mns_cg_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `share_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareToken` varchar(200) NOT NULL,
	`companyId` int,
	`companyName` varchar(300),
	`rating` enum('thumbs_up','thumbs_down','neutral'),
	`comment` text,
	`submitterName` varchar(200),
	`submitterEmail` varchar(200),
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `share_feedback` ADD CONSTRAINT `share_feedback_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;