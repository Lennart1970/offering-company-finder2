-- Add table for caching SIC/NAICS code descriptions
CREATE TABLE IF NOT EXISTS code_descriptions (
  code VARCHAR(10) PRIMARY KEY,
  code_type ENUM('SIC', 'NAICS') NOT NULL,
  description TEXT,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code_type (code_type),
  INDEX idx_fetched_at (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
