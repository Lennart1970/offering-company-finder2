-- Backfill companies.sector from sliceMetadata.industry for Apollo/Excel imports
-- that stored industry in JSON but never populated the dedicated sector column.
UPDATE `companies`
SET `sector` = JSON_UNQUOTE(JSON_EXTRACT(`sliceMetadata`, '$.industry'))
WHERE `sector` IS NULL
  AND `sliceMetadata` IS NOT NULL
  AND JSON_EXTRACT(`sliceMetadata`, '$.industry') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`sliceMetadata`, '$.industry')) NOT IN ('', 'null');
