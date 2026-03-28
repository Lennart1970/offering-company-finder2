ALTER TABLE `companies` ADD `signalOpeners` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `signalOpenersGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `generatedWithBrainId` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `generatedWithBrainName` varchar(255);