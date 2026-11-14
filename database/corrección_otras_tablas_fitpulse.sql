-- Ejecutar el archivo completo en una sola conexion de MySQL Workbench.
-- Conserva los registros y sus identificadores, incluido un posible ID 0.
USE db_proyecto;

SET @fitpulse_previous_sql_mode = @@SESSION.sql_mode;
SET @fitpulse_previous_foreign_key_checks = @@SESSION.foreign_key_checks;
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'NO_AUTO_VALUE_ON_ZERO');
SET SESSION foreign_key_checks = 0;

-- Solo las llaves primarias; purchases.idpackages sigue siendo llave foranea.
ALTER TABLE scheduled_classes
    MODIFY COLUMN idscheduled_classes INT NOT NULL AUTO_INCREMENT;
ALTER TABLE packages
    MODIFY COLUMN idpackages INT NOT NULL AUTO_INCREMENT;
ALTER TABLE purchases
    MODIFY COLUMN idpurchase INT NOT NULL AUTO_INCREMENT;
ALTER TABLE reviews
    MODIFY COLUMN idreview INT NOT NULL AUTO_INCREMENT;

SET SESSION foreign_key_checks = @fitpulse_previous_foreign_key_checks;
SET SESSION sql_mode = @fitpulse_previous_sql_mode;

-- Cambiar los valores predeterminados sin reescribir las fechas existentes.
ALTER TABLE purchases
    ALTER COLUMN purchased_at SET DEFAULT (CURRENT_TIMESTAMP);
ALTER TABLE reviews
    ALTER COLUMN created_at SET DEFAULT (CURRENT_TIMESTAMP);

-- Mantener el tipo y la admision de NULL que ya tenga updated_at.
-- Agregar la fecha inicial y su actualizacion automatica al editar una resena.
SELECT CONCAT(
    'ALTER TABLE `reviews` MODIFY COLUMN `updated_at` ', COLUMN_TYPE,
    IF(IS_NULLABLE = 'YES', ' NULL', ' NOT NULL'),
    ' DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
) INTO @fitpulse_ddl
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'updated_at';
PREPARE fitpulse_stmt FROM @fitpulse_ddl;
EXECUTE fitpulse_stmt;
DEALLOCATE PREPARE fitpulse_stmt;

SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
       COLUMN_DEFAULT AS default_value, EXTRA AS extra
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('scheduled_classes', 'packages', 'purchases', 'reviews')
  AND COLUMN_NAME IN ('idscheduled_classes', 'idpackages', 'idpurchase', 'idreview',
                      'purchased_at', 'created_at', 'updated_at')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
