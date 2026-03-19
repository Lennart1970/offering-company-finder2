CREATE TABLE `bom_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prototypeRequestId` int NOT NULL,
	`component` varchar(256) NOT NULL,
	`qty` int NOT NULL DEFAULT 1,
	`unitCost` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'EUR',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bom_items_id` PRIMARY KEY(`id`)
);
