-- Pre-materialise CRM-match hostname on companies for index-scannable CRM filter.
-- Backfill mirrors server/normalizeCompanyDomain.ts (primaryDomain first, else websiteUrl host).

ALTER TABLE `companies` ADD `normalizedDomain` varchar(256);
--> statement-breakpoint
CREATE INDEX `companies_normalized_domain_idx` ON `companies` (`normalizedDomain`);
--> statement-breakpoint
CREATE INDEX `lt_mns_cg_leads_domain_idx` ON `lt_mns_cg_leads` (`domain`(191));
--> statement-breakpoint
UPDATE `companies`
SET `normalizedDomain` = LOWER(REPLACE(TRIM(`primaryDomain`), 'www.', ''))
WHERE (`normalizedDomain` IS NULL OR `normalizedDomain` = '')
  AND `primaryDomain` IS NOT NULL
  AND TRIM(`primaryDomain`) != '';
--> statement-breakpoint
UPDATE `companies`
SET `normalizedDomain` = LOWER(
  SUBSTRING_INDEX(
    SUBSTRING_INDEX(
      REPLACE(REPLACE(REPLACE(TRIM(`websiteUrl`), 'https://', ''), 'http://', ''), 'www.', ''),
      '/', 1
    ),
    ':', 1
  )
)
WHERE (`normalizedDomain` IS NULL OR `normalizedDomain` = '')
  AND `websiteUrl` IS NOT NULL
  AND TRIM(`websiteUrl`) != '';
