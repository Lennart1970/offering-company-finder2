CREATE TABLE `apolloWebhookLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apolloStatus` varchar(64),
	`apolloPersonId` varchar(128),
	`phoneDelivered` varchar(64),
	`contactId` int,
	`contactName` varchar(256),
	`updated` tinyint NOT NULL DEFAULT 0,
	`failReason` varchar(64),
	`peopleCount` int DEFAULT 0,
	`creditsConsumed` int DEFAULT 0,
	`rawPayload` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apolloWebhookLogs_id` PRIMARY KEY(`id`)
);
