const { pool, query, transaction } = require('../src/config/database');
const { checkSchema } = require('../src/config/schema');
const { hashPassword } = require('../src/utils/passwords');
const { credentials } = require('../src/services/user-service');

async function findDemoClient(email, connection) {
  const users = await query('SELECT idusers AS id, role FROM users WHERE email = ? FOR UPDATE',
    [email], connection);
  return users[0];
}

async function seedDemo() {
  try {
    await checkSchema(pool);
    const { DEMO_CLIENT_NAME, DEMO_CLIENT_EMAIL, DEMO_CLIENT_PASSWORD } = process.env;
    if (!DEMO_CLIENT_NAME || DEMO_CLIENT_NAME.length > 45 || !DEMO_CLIENT_EMAIL ||
        !DEMO_CLIENT_PASSWORD || DEMO_CLIENT_PASSWORD.length < 8) {
      throw new Error('Set DEMO_CLIENT_NAME, DEMO_CLIENT_EMAIL and DEMO_CLIENT_PASSWORD in .env');
    }
    const demoClient = credentials({ name: DEMO_CLIENT_NAME, email: DEMO_CLIENT_EMAIL,
      password: DEMO_CLIENT_PASSWORD }, true);
    await transaction(async (connection) => {
      const email = demoClient.email;
      let client = await findDemoClient(email, connection);
      if (!client) {
        const passwordHash = await hashPassword(demoClient.password);
        await query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
          [demoClient.name, email, passwordHash], connection);
        client = await findDemoClient(email, connection);
      }
      if (client.role !== 'client') {
        throw new Error('DEMO_CLIENT_EMAIL already belongs to an administrator');
      }
    });
    console.log('Demo client is ready');
  } catch (error) {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedDemo();
