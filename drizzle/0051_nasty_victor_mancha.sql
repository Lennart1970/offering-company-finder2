ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','super_admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `share_lists` ADD `brainId` int;--> statement-breakpoint
ALTER TABLE `share_lists` ADD CONSTRAINT `share_lists_brainId_offering_brain_id_fk` FOREIGN KEY (`brainId`) REFERENCES `offering_brain`(`id`) ON DELETE set null ON UPDATE no action;