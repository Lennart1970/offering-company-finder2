CREATE TABLE `share_research_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorEmail` varchar(320) NOT NULL,
	`domain` varchar(128) NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`companyName` varchar(300),
	`brainId` int,
	`status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_research_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `share_research_requests` ADD CONSTRAINT `share_research_requests_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `share_research_requests` ADD CONSTRAINT `share_research_requests_brainId_offering_brain_id_fk` FOREIGN KEY (`brainId`) REFERENCES `offering_brain`(`id`) ON DELETE set null ON UPDATE no action;
