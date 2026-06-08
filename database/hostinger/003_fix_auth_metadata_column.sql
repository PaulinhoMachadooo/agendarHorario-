-- REQUIRED: replace with your real Hostinger DB name to avoid #1046
USE `u278136558_AgendaFran`;

-- Fix legacy auth_users column name (metadata -> user_metadata)
-- Run this only if signup/login reports unknown column 'metadata' or 'user_metadata'.

SET @has_user_metadata := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_users'
    AND COLUMN_NAME = 'user_metadata'
);

SET @has_metadata := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_users'
    AND COLUMN_NAME = 'metadata'
);

-- Add user_metadata if it does not exist
SET @sql_add := IF(@has_user_metadata = 0,
  'ALTER TABLE auth_users ADD COLUMN user_metadata LONGTEXT NULL AFTER password_hash',
  'SELECT 1'
);
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

-- Copy legacy metadata data into new column
SET @sql_copy := IF(@has_metadata = 1,
  'UPDATE auth_users SET user_metadata = metadata WHERE user_metadata IS NULL',
  'SELECT 1'
);
PREPARE stmt_copy FROM @sql_copy;
EXECUTE stmt_copy;
DEALLOCATE PREPARE stmt_copy;
