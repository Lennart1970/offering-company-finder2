ALTER TABLE `companies` ADD `urgencyScoreGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreSynth` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreSynthGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreNews` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreNewsGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreLLM` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreLLMGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreHITL` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreHITLUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `urgencyScoreHITLNote` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `fitScoreSource` varchar(10);--> statement-breakpoint
ALTER TABLE `companies` ADD `fitScoreHITL` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `fitScoreHITLUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `fitScoreHITLNote` text;