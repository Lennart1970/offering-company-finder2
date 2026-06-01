ALTER TABLE `companies` ADD `cgBusinessUnit` varchar(128);--> statement-breakpoint
ALTER TABLE `companies` ADD `cgSalesManager` varchar(256);--> statement-breakpoint
ALTER TABLE `companies` ADD `cgLeadClass` varchar(64);--> statement-breakpoint
ALTER TABLE `companies` ADD `cgLeadOrigin` varchar(256);--> statement-breakpoint
ALTER TABLE `companies` ADD `cgMarket` varchar(256);--> statement-breakpoint
ALTER TABLE `companies` ADD `cgComment` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `cgRemarks` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `cgSharepointId` varchar(64);--> statement-breakpoint
ALTER TABLE `companies` ADD `cgImportedAt` timestamp;