CREATE TABLE `code_descriptions` (
	`code` varchar(10) NOT NULL,
	`code_type` enum('SIC','NAICS') NOT NULL,
	`description` text,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `code_descriptions_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
ALTER TABLE `searches` ADD `selectedSicCodes` text;--> statement-breakpoint
ALTER TABLE `searches` ADD `selectedNaicsCodes` text;--> statement-breakpoint
ALTER TABLE `searches` ADD `codeSelectionReasoning` text;