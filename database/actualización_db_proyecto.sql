-- Completa las siete columnas ausentes sin borrar ni reemplazar registros.
-- Los cupos, horarios y descripciones antiguos quedan NULL hasta completar sus datos reales.
-- Puede ejecutarse nuevamente: solo agrega columnas que todavía no existen.
USE db_proyecto;

-- users.failed_login_attempts
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'failed_login_attempts'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `failed_login_attempts` INT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

-- scheduled_classes.capacity
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduled_classes' AND COLUMN_NAME = 'capacity'),
  'SELECT 1',
  'ALTER TABLE `scheduled_classes` ADD COLUMN `capacity` INT NULL'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

-- scheduled_classes.starts_at
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduled_classes' AND COLUMN_NAME = 'starts_at'),
  'SELECT 1',
  'ALTER TABLE `scheduled_classes` ADD COLUMN `starts_at` DATETIME NULL'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

-- scheduled_classes.ends_at
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduled_classes' AND COLUMN_NAME = 'ends_at'),
  'SELECT 1',
  'ALTER TABLE `scheduled_classes` ADD COLUMN `ends_at` DATETIME NULL'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

-- scheduled_classes.description
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduled_classes' AND COLUMN_NAME = 'description'),
  'SELECT 1',
  'ALTER TABLE `scheduled_classes` ADD COLUMN `description` TEXT NULL'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

-- packages.description
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'description'),
  'SELECT 1',
  'ALTER TABLE `packages` ADD COLUMN `description` TEXT NULL'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

-- reviews.intensity
SET @fitpulse_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'intensity'),
  'SELECT 1',
  'ALTER TABLE `reviews` ADD COLUMN `intensity` VARCHAR(10) NULL'
);
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

SELECT 'Columnas actualizadas. Completa los cupos, horarios y descripciones pendientes.' AS resultado;
