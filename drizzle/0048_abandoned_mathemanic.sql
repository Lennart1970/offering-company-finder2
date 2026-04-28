CREATE TABLE `share_visitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`firstSeen` timestamp NOT NULL DEFAULT (now()),
	`lastSeen` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`accessCount` int NOT NULL DEFAULT 1,
	CONSTRAINT `share_visitors_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_visitors_email_unique` UNIQUE(`email`)
);
