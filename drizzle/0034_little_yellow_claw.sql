CREATE TABLE `bom_calculations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` varchar(256) NOT NULL,
	`imageUrls` text NOT NULL,
	`productSummary` text NOT NULL,
	`componentsJson` text NOT NULL,
	`totalEur` decimal(14,2) NOT NULL DEFAULT '0',
	`isEnriched` tinyint NOT NULL DEFAULT 0,
	`brainId` int,
	`label` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bom_calculations_id` PRIMARY KEY(`id`)
);
