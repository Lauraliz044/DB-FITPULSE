const requiredColumns = {
  users: ['idusers', 'name', 'email', 'password', 'role', 'status', 'registered_at',
    'failed_login_attempts', 'locked_until'],
  scheduled_classes: ['idscheduled_classes', 'name', 'instructor_name', 'category',
    'price', 'capacity', 'starts_at', 'ends_at', 'description'],
  packages: ['idpackages', 'name', 'price', 'class_quantity', 'description'],
  purchases: ['idpurchase', 'paid_price', 'purchased_at', 'idusers', 'idpackages'],
  reviews: ['idreview', 'rating', 'comment', 'tags', 'created_at', 'updated_at',
    'iduser', 'idclass', 'intensity']
};
const requiredTables = Object.keys(requiredColumns);

async function checkSchema(connection) {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  const existingTables = rows.map((row) => row.name);
  const missingTables = requiredTables.filter((name) => !existingTables.includes(name));
  if (missingTables.length) {
    throw new Error(`Missing tables: ${missingTables.join(', ')}. Run npm run db:setup`);
  }
  const [columns] = await connection.query(
    'SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name ' +
    'FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()'
  );
  const existingColumns = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = requiredTables.flatMap((table) =>
    requiredColumns[table].filter((column) => !existingColumns.has(`${table}.${column}`))
      .map((column) => `${table}.${column}`));
  if (missingColumns.length) {
    throw new Error(`Incompatible schema. Missing columns: ${missingColumns.join(', ')}. ` +
      'Compare your tables with database/schema.sql; existing tables are not changed automatically.');
  }
}

module.exports = { checkSchema };
