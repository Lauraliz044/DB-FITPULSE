-- Conserva los registros, identificadores y columnas existentes.
USE db_proyecto;

-- Conservar tambien un posible identificador 0 al agregar AUTO_INCREMENT.
SET @fitpulse_previous_sql_mode = @@SESSION.sql_mode;
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'NO_AUTO_VALUE_ON_ZERO');

-- Las otras tablas ya referencian idusers. Desactivar las comprobaciones
-- solo en esta conexion mientras se agrega AUTO_INCREMENT, sin cambiar IDs.
SET @fitpulse_previous_foreign_key_checks = @@SESSION.foreign_key_checks;
SET SESSION foreign_key_checks = 0;
ALTER TABLE users
    MODIFY COLUMN idusers INT NOT NULL AUTO_INCREMENT;
SET SESSION foreign_key_checks = @fitpulse_previous_foreign_key_checks;
SET SESSION sql_mode = @fitpulse_previous_sql_mode;

ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'client',
    ALTER COLUMN status SET DEFAULT 'active',
    MODIFY COLUMN registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Los contadores heredados se conservan y reciben un valor predeterminado.
-- Su nombre puede variar entre instalaciones anteriores.
SELECT GROUP_CONCAT(
    CONCAT('ALTER COLUMN `', REPLACE(COLUMN_NAME, '`', '``'), '` SET DEFAULT 0')
    SEPARATOR ', '
) INTO @fitpulse_legacy_counters
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND LEFT(COLUMN_NAME, CHAR_LENGTH('failed_login_att')) = 'failed_login_att'
  AND COLUMN_NAME <> 'failed_login_attempts'
  AND DATA_TYPE IN ('tinyint', 'smallint', 'mediumint', 'int', 'bigint');

SET @fitpulse_ddl = IF(
    @fitpulse_legacy_counters IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE `users` ', @fitpulse_legacy_counters)
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

SELECT COLUMN_NAME AS column_name, COLUMN_DEFAULT AS default_value, EXTRA AS extra
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;
