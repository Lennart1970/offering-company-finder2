ALTER TABLE `searches` MODIFY COLUMN `status` enum('pending','extracting','code_targeting','searching','completed','failed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `searches` ADD `expandedNaicsCodes` text;--> statement-breakpoint
ALTER TABLE `searches` ADD `codesSearched` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `searches` ADD `codesTotal` int DEFAULT 0;