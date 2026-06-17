-- Backfill companies.country for Apollo CSV imports where country was in the file
-- but never landed in the dedicated column (or was cleared by later enrichment).
-- Mirrors 0063 sector backfill from sliceMetadata.

-- 1) sliceMetadata.country (new imports store country here as well)
UPDATE `companies`
SET `country` = JSON_UNQUOTE(JSON_EXTRACT(`sliceMetadata`, '$.country'))
WHERE (`country` IS NULL OR `country` = '')
  AND `sliceMetadata` IS NOT NULL
  AND JSON_EXTRACT(`sliceMetadata`, '$.country') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`sliceMetadata`, '$.country')) NOT IN ('', 'null');

-- 2) searchLocation when no state (import stored country-only location here)
UPDATE `companies`
SET `country` = `searchLocation`
WHERE (`country` IS NULL OR `country` = '')
  AND (`state` IS NULL OR `state` = '')
  AND `searchLocation` IS NOT NULL
  AND `searchLocation` != '';

-- 3) last segment of Company Address (Apollo full-address column)
UPDATE `companies`
SET `country` = TRIM(SUBSTRING_INDEX(`rawAddress`, ',', -1))
WHERE (`country` IS NULL OR `country` = '')
  AND `rawAddress` IS NOT NULL
  AND `rawAddress` LIKE '%,%'
  AND LENGTH(TRIM(SUBSTRING_INDEX(`rawAddress`, ',', -1))) BETWEEN 2 AND 64;
