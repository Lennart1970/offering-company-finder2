ALTER TABLE `companies` ADD `searchLocation` varchar(256);--> statement-breakpoint
ALTER TABLE `companies` ADD `city` varchar(128);--> statement-breakpoint
ALTER TABLE `companies` ADD `state` varchar(128);--> statement-breakpoint
ALTER TABLE `companies` ADD `country` varchar(128);--> statement-breakpoint
ALTER TABLE `companies` ADD `streetAddress` varchar(512);--> statement-breakpoint
ALTER TABLE `companies` ADD `rawAddress` text;