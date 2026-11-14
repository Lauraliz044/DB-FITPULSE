require('dotenv').config({ quiet: true });
process.env.DB_NAME = process.env.TEST_DB_NAME;
if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  throw new Error('TEST_DB_NAME must end with _test');
}

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');
const values = { admin: 'admin', client: 'client', active: 'active' };
const { checkSchema } = require('../src/config/schema');
const { pool, query } = require('../src/config/database');
const { businessDate, utcDate } = require('../src/utils/time');
const { hashPassword, verifyPassword, isPasswordHash } = require('../src/utils/passwords');
const { migratePasswords } = require('../src/services/password-migration-service');

const evidence = [];
const runId = Date.now();
let baseUrl;
let server;
let assertions = 0;

function verify(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

async function call(method, route, body, token, expected, label) {
  const start = performance.now();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/api/v1${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const responseText = await response.text();
  const json = responseText ? JSON.parse(responseText) : null;
  const safeBody = body ? { ...body } : null;
  if (safeBody && safeBody.password) safeBody.password = '[redacted]';
  const safeJson = json ? JSON.parse(JSON.stringify(json)) : null;
  if (safeJson && safeJson.data && safeJson.data.accessToken) {
    safeJson.data.accessToken = '[redacted]';
  }
  evidence.push({ label, method, route, requestBody: safeBody,
    authenticated: Boolean(token), expectedStatus: expected, status: response.status,
    passed: Array.isArray(expected) ? expected.includes(response.status) : response.status === expected,
    milliseconds: performance.now() - start,
    responseBody: safeJson });
  if (Array.isArray(expected)) {
    assert.ok(expected.includes(response.status), `${label}: ${responseText}`);
  } else {
    assert.equal(response.status, expected,
      `${label}: ${method} ${route}: ${responseText}`);
  }
  assertions += 1;
  return json ? json.data : undefined;
}

function futureClass(name, capacity = 3) {
  return { name, category: 'yoga', instructorName: 'Demo Coach',
    startsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString(),
    capacity, price: 25000, description: 'Mobility and breathing' };
}

async function loadTest(route, token) {
  const times = [];
  await Promise.all(Array.from({ length: 50 }, async () => {
    const start = performance.now();
    const response = await fetch(`${baseUrl}/api/v1${route}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    verify(response.status === 200, 'Concurrent query must succeed');
    await response.text();
    times.push(performance.now() - start);
  }));
  times.sort((first, second) => first - second);
  return { concurrentRequests: 50, p95Milliseconds: times[47],
    passed: times[47] <= 1000 };
}

async function run() {
  const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8');
  for (const statement of schema.split(';').filter((value) => value.trim())) {
    await query(statement);
  }
  await checkSchema(pool);
  await query('ALTER TABLE users RENAME COLUMN failed_login_attempts TO legacy_attempts');
  try {
    await assert.rejects(checkSchema(pool), /Missing columns: users.failed_login_attempts/);
    assertions += 1;
  } finally {
    await query('ALTER TABLE users RENAME COLUMN legacy_attempts TO failed_login_attempts');
  }
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminEmail = `admin${runId}@fitpulse.example`;
  const password = process.env.ADMIN_PASSWORD;
  const administratorHash = await hashPassword(password);
  await query('INSERT INTO users (name, email, `password`, role, status) VALUES (?, ?, ?, ?, ?)',
    ['Demo Admin', adminEmail, administratorHash, values.admin, values.active]);
  const legacyEmail = `legacy${runId}@fitpulse.example`;
  const legacyUser = await query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    ['Legacy Client', legacyEmail, password]);
  await call('POST', '/sessions', { email: legacyEmail, password }, null,
    401, 'Plain-text storage cannot authenticate before migration');
  const [beforeMigration] = await query('SELECT * FROM users WHERE idusers = ?',
    [legacyUser.insertId]);
  const migration = await migratePasswords();
  verify(migration.migrated >= 1, 'Existing plain-text credentials must be migrated');
  const [afterMigration] = await query('SELECT * FROM users WHERE idusers = ?',
    [legacyUser.insertId]);
  verify(isPasswordHash(afterMigration.password), 'Migration must persist an Argon2id hash');
  verify(await verifyPassword(password, afterMigration.password),
    'Migration must preserve the original password');
  const { password: oldPassword, ...originalMetadata } = beforeMigration;
  const { password: newPassword, ...migratedMetadata } = afterMigration;
  verify(oldPassword !== newPassword, 'The database must no longer store the original password');
  assert.deepEqual(migratedMetadata, originalMetadata);
  assertions += 1;
  const [unchangedAdministrator] = await query('SELECT password FROM users WHERE email = ?',
    [adminEmail]);
  verify(unchangedAdministrator.password === administratorHash,
    'Migration must not hash existing Argon2id values again');
  verify((await migratePasswords()).migrated === 0, 'Repeated migration must be idempotent');
  await call('POST', '/sessions', { email: legacyEmail, password }, null,
    201, 'Migrated client can log in with the original password');
  const session = await call('POST', '/sessions', { email: adminEmail, password }, null,
    201, 'Administrator session');
  const admin = session.accessToken;
  await call('POST', '/sessions', { email: adminEmail, password: 'WrongPassword' }, null,
    401, 'Wrong credentials');
  const client = await call('POST', '/users', {
    name: 'Demo Client', email: `client${runId}@fitpulse.example`, password
  }, null, 201, 'Registration');
  const [storedClient] = await query('SELECT password FROM users WHERE idusers = ?', [client.id]);
  verify(isPasswordHash(storedClient.password) && storedClient.password !== password,
    'Registration must persist a hash instead of plain text');
  verify(await verifyPassword(password, storedClient.password),
    'The registration hash must verify against the complete input');
  verify(storedClient.password.split('$')[4] !== administratorHash.split('$')[4],
    'Accounts sharing a password must receive independent salts');
  verify(!('password' in client), 'Registration must not return the password or its hash');
  await call('POST', '/users', { name: 'Demo', email: 'bad', password: 'short' }, null,
    400, 'Invalid registration');
  await call('POST', '/users', { name: 'x'.repeat(46),
    email: `long${runId}@fitpulse.example`, password }, null, 400, 'User name exceeds database length');
  await call('POST', '/users', { name: 'Demo', email: client.email, password }, null,
    409, 'Duplicate email');
  await call('POST', '/users', { name: 'Demo', email: 'other@example.com', password,
    role: 'admin' }, null, 400, 'Public role escalation rejected');
  const clientSession = await call('POST', '/sessions', { email: client.email, password },
    null, 201, 'Client session');
  const token = clientSession.accessToken;
  verify(!('password' in clientSession.user), 'Password must not be returned');
  await call('GET', '/users', undefined, admin, 200, 'User list');
  await call('GET', '/users', undefined, token, 403, 'Client cannot list users');
  await call('GET', `/users/${client.id}`, undefined, token, 200, 'Own profile');
  await call('GET', '/users/0', undefined, token, 400, 'Invalid identifier');
  await call('PATCH', `/users/${client.id}/status`, { status: 'inactive' }, admin,
    200, 'Deactivate client');
  await call('GET', '/classes', undefined, token, 403, 'Existing token rejected after deactivation');
  await call('PATCH', `/users/${client.id}/status`, { status: 'active' }, token,
    403, 'Client cannot reactivate itself');
  await call('PATCH', `/users/${client.id}/status`, { status: 'active' }, admin,
    200, 'Reactivate client');
  const item = await call('POST', '/classes', futureClass('Future Yoga'), admin,
    201, 'Create class');
  await call('POST', '/classes', futureClass('Forbidden'), token, 403, 'Client cannot create class');
  await call('POST', '/classes', { ...futureClass('Invalid'), capacity: '3' }, admin,
    400, 'Wrong capacity type');
  await call('POST', '/classes', { ...futureClass('Long instructor'), instructorName: 'x'.repeat(46) },
    admin, 400, 'instructor_name name exceeds database length');
  await call('POST', '/classes', { ...futureClass('Invalid time'),
    startsAt: '2030-01-01T24:00:00Z' }, admin, 400, 'Invalid hour');
  const catalog = await call('GET', '/classes', undefined, token, 200, 'Class catalog');
  verify(catalog.every((entry) => !('available_spots' in entry)),
    'The catalog must not claim to calculate available spots');
  await call('GET', '/classes?limit=1001', undefined, token, 400, 'Invalid pagination');
  await call('GET', `/classes/${item.id}`, undefined, token, 200, 'Class details');
  await call('GET', '/classes/2147483647', undefined, token, 404, 'Missing class');
  await call('PATCH', `/classes/${item.id}`, { capacity: 4 }, admin, 200, 'Update class');
  await call('PATCH', `/classes/${item.id}`, { capacity: 0 }, admin, 400, 'Invalid class update');
  const disposable = await call('POST', '/classes', futureClass('Disposable'), admin,
    201, 'Create disposable class');
  await call('DELETE', `/classes/${disposable.id}`, undefined, admin, 204, 'Delete class');
  await call('DELETE', `/classes/${disposable.id}`, undefined, admin, 404, 'Delete missing class');
  const bundle = await call('POST', '/packages', { name: 'Starter', classQuantity: 5,
    price: 120000, description: 'Five classes' }, admin, 201, 'Create package');
  await call('POST', '/packages', { name: 'Invalid' }, admin, 400, 'Invalid package');
  await call('POST', '/packages', { name: 'x'.repeat(46), classQuantity: 1,
    price: 1, description: 'Test fixture' }, admin, 400, 'Package name exceeds database length');
  await call('GET', '/packages', undefined, token, 200, 'Package catalog');
  await call('GET', '/packages?limit=0', undefined, token, 400, 'Invalid package pagination');
  await call('GET', `/packages/${bundle.id}`, undefined, token, 200, 'Package details');
  await call('GET', '/packages/2147483647', undefined, token, 404, 'Missing package');
  await call('PATCH', `/packages/${bundle.id}`, { price: 125000 }, admin,
    200, 'Update package');
  await call('PATCH', `/packages/${bundle.id}`, { price: -1 }, admin,
    400, 'Invalid package price');
  const spare = await call('POST', '/packages', { name: 'Disposable', classQuantity: 1,
    price: 1, description: 'Test fixture' }, admin, 201, 'Create disposable package');
  await call('DELETE', `/packages/${spare.id}`, undefined, admin, 204, 'Delete package');
  await call('DELETE', `/packages/${spare.id}`, undefined, admin, 404, 'Delete missing package');
  const purchase = await call('POST', '/purchases', { packageId: bundle.id }, token,
    201, 'Buy package');
  verify(purchase.paid_price === '125000.00', 'Server must choose paid price');
  await call('POST', '/purchases', { packageId: bundle.id, paidPrice: 1 }, token,
    400, 'Buyer cannot forge price');
  await call('GET', '/purchases', undefined, admin, 200, 'Admin purchase details');
  await call('GET', '/purchases', undefined, token, 403, 'Client cannot list all purchases');
  await call('GET', `/purchases/${purchase.id}`, undefined, token, 200, 'Own purchase');
  await call('GET', '/purchases/2147483647', undefined, token, 404, 'Missing purchase');
  await call('GET', `/users/${client.id}/purchases`, undefined, token, 200, 'Own purchases');
  await call('GET', `/users/${session.user.id}/purchases`, undefined, token, 403,
    'Different user purchases rejected');
  await call('PATCH', `/packages/${bundle.id}`, { price: 1 }, admin, 409,
    'Purchased package history protected');
  const review = await call('POST', '/reviews', { classId: item.id, rating: 5,
    comment: 'Clear instructions', intensity: 'moderate', tags: ['Friendly','organized'] },
    token, 201, 'Create review without attendance tracking');
  verify(review.user_id === client.id && review.class_id === item.id,
    'Review must reference the authenticated user and an existing class');
  verify(JSON.stringify(review.tags) === '["friendly","organized"]', 'Review tags are normalized');
  await call('POST', '/reviews', { classId: item.id, rating: 5 }, token,
    409, 'Duplicate review');
  await call('POST', '/reviews', { classId: 2147483647, rating: 5 }, token,
    404, 'Review of missing class');
  await call('POST', '/reviews', { classId: item.id, rating: 6 }, token,
    400, 'Invalid review rating');
  await call('POST', '/reviews', { classId: item.id, rating: 5 }, admin,
    403, 'Administrator cannot create a client review');
  await call('GET', `/reviews/${review.id}`, undefined, token, 200, 'Review details');
  await call('GET', '/reviews/2147483647', undefined, token, 404, 'Missing review');
  await call('GET', `/classes/${item.id}/reviews`, undefined, token, 200, 'Class reviews');
  await call('GET', '/classes/2147483647/reviews', undefined, token, 404, 'Reviews of missing class');
  const changed = await call('PATCH', `/reviews/${review.id}`, { tags: [] }, token,
    200, 'Clear review tags');
  verify(changed.comment === 'Clear instructions' && changed.intensity === 'moderate',
    'PATCH must preserve omitted fields');
  await call('PATCH', `/reviews/${review.id}`, { tags: ['good','GOOD'] }, token,
    400, 'Duplicate tags rejected');
  await call('PATCH', `/reviews/${review.id}`, { classId: item.id }, token,
    400, 'Reviewed class cannot be replaced');
  await call('DELETE', `/classes/${item.id}`, undefined, admin,
    409, 'A class referenced by a review cannot be deleted');
  await call('DELETE', `/reviews/${review.id}`, undefined, token, 204, 'Delete review');
  const keptClass = await call('GET', `/classes/${item.id}`, undefined, token,
    200, 'Deleting a review preserves its class');
  verify(keptClass.id === item.id, 'Deleting a review must not delete a class');
  await call('DELETE', `/reviews/${review.id}`, undefined, token, 404, 'Delete missing review');
  const replacementReview = await call('POST', '/reviews', { classId: item.id, rating: 4 }, token,
    201, 'Optional review fields can be omitted');
  verify(replacementReview.comment === null && replacementReview.intensity === null &&
    replacementReview.tags.length === 0, 'Optional review defaults must be preserved');
  const summary = await call('GET', `/reports/sales?date=${businessDate()}`,
    undefined, admin, 200, 'Daily sales report');
  verify(Number(summary.totalPaid) >= 125000, 'Daily report must include the purchase');
  await call('GET', '/reports/sales', undefined, token, 403, 'Client cannot read sales');
  await call('GET', '/reports/sales?date=2026-02-30', undefined, admin,
    400, 'Invalid sales date');
  await call('GET', '/classes', undefined, undefined, 401, 'Missing token');
  await call('GET', '/classes', undefined, 'invalid-token', 401, 'Invalid token');
  await call('GET', '/classes?offset=-1', undefined, token, 400, 'Negative offset');
  await call('GET', '/classes?unexpected=1', undefined, token, 400, 'Unknown query');
  const other = await call('POST', '/users', { name: 'Other Client',
    email: `other${runId}@fitpulse.example`, password }, null, 201, 'Second client');
  const otherSession = await call('POST', '/sessions', { email: other.email, password },
    null, 201, 'Second client session');
  await call('PATCH', `/reviews/${replacementReview.id}`, { rating: 1 }, otherSession.accessToken,
    403, 'Review ownership');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await call('POST', '/sessions', { email: other.email, password: 'WrongPassword' }, null,
      attempt === 5 ? 423 : 401, `Failed login attempt ${attempt}`);
  }
  await call('POST', '/sessions', { email: other.email, password }, null,
    423, 'Correct password rejected during lock');
  const locked = await query('SELECT failed_login_attempts, locked_until FROM users WHERE idusers = ?',
    [other.id]);
  verify(locked[0].failed_login_attempts === 5, 'Failed attempt counter must persist');
  const lockSeconds = (utcDate(locked[0].locked_until) - new Date()) / 1000;
  verify(lockSeconds > 890 && lockSeconds <= 900, 'Lock must last approximately 15 minutes');
  await query('UPDATE users SET locked_until = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE idusers = ?',
    [other.id]);
  await call('POST', '/sessions', { email: other.email, password }, null,
    201, 'Login after simulated lock expiry');
  const concurrentClass = await call('POST', '/classes', futureClass('Concurrent review'), admin,
    201, 'Create class for concurrent review test');
  const beforeConcurrent = evidence.length;
  await Promise.all([
    call('POST', '/reviews', { classId: concurrentClass.id, rating: 5 }, token,
      [201,409], 'Concurrent review A'),
    call('POST', '/reviews', { classId: concurrentClass.id, rating: 4 }, token,
      [201,409], 'Concurrent review B')
  ]);
  verify(JSON.stringify(evidence.slice(beforeConcurrent).map(testCase => testCase.status).sort()) === '[201,409]',
    'Concurrent duplicate reviews must have one success and one conflict');
  const count = await query('SELECT COUNT(*) AS total FROM reviews WHERE iduser = ? AND idclass = ?',
    [client.id, concurrentClass.id]);
  verify(Number(count[0].total) === 1, 'A user must not create duplicate reviews concurrently');
  const oldEndpoints = [
    ['POST', '/reservations'], ['GET', '/reservations/1'], ['PATCH', '/reservations/1/attendance'],
    ['GET', `/users/${client.id}/reservations`], ['GET', `/users/${client.id}/progress`],
    ['GET', `/users/${client.id}/personal-records`], ['POST', `/users/${client.id}/personal-records`],
    ['GET', '/personal-records/1'], ['PATCH', '/personal-records/1'], ['DELETE', '/personal-records/1']
  ];
  for (const [method, route] of oldEndpoints) {
    await call(method, route, undefined, token, 404, 'Removed endpoint is unavailable');
  }
  await assert.rejects(query(
    'INSERT INTO purchases (idusers, idpackages, paid_price) VALUES (?, ?, ?)',
    [2147483647, bundle.id, '1.00']
  ), { code: 'ER_NO_REFERENCED_ROW_2' });
  assertions += 1;
  await assert.rejects(query(
    'INSERT INTO reviews (iduser, idclass, rating, tags) VALUES (?, ?, ?, ?)',
    [client.id, item.id, 6, '[]']
  ), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  assertions += 1;
  await assert.rejects(query(
    'INSERT INTO reviews (iduser, idclass, rating, tags) VALUES (?, ?, ?, ?)',
    [client.id, item.id, 5, '[]']
  ), { code: 'ER_DUP_ENTRY' });
  assertions += 1;
  await assert.rejects(query(
    'INSERT INTO reviews (iduser, idclass, rating, tags) VALUES (?, ?, ?, ?)',
    [client.id, 2147483647, 5, '[]']
  ), { code: 'ER_NO_REFERENCED_ROW_2' });
  assertions += 1;
  verify(businessDate(new Date('2026-10-14T04:59:59Z')) === '2026-10-13',
    'Business day must use Bogota time');
  const boundaryPurchase = await query(`INSERT INTO purchases
    (idusers, idpackages, purchased_at, paid_price) VALUES (?, ?, ?, ?)`,
    [client.id, bundle.id, '2020-01-02 04:59:59', '0.01']);
  const boundaryReport = await call('GET', '/reports/sales?date=2020-01-01',
    undefined, admin, 200, 'Sales across the UTC day boundary');
  verify(Number(boundaryReport.totalPaid) >= 0.01, 'Sales must use the business day');
  await query('DELETE FROM purchases WHERE idpurchase = ?', [boundaryPurchase.insertId]);
  const specification = await fetch(`${baseUrl}/openapi.json`);
  const spec = await specification.json();
  verify(Object.values(spec.paths).reduce((sum, item) => sum + Object.keys(item).length,0) === 25,
    'Swagger must document all operations');
  const docs = await fetch(`${baseUrl}/docs/`);
  verify(docs.status === 200 && (await docs.text()).includes('swagger-ui'),
    'Interactive Swagger must be served');
  const coverage = [];
  for (const [route, methods] of Object.entries(spec.paths)) {
    const pattern = new RegExp(`^${route.replace(/\{\w+\}/g, '[0-9]+')}$`);
    for (const method of Object.keys(methods)) {
      const cases = evidence.filter((item) => item.method.toLowerCase() === method &&
        pattern.test(item.route.split('?')[0]));
      const success = cases.some((item) => item.status < 300);
      const error = cases.some((item) => item.status >= 400);
      verify(success && error, `Success and error coverage missing for ${method} ${route}`);
      coverage.push({ method, route, success, error });
    }
  }
  const catalogLoad = await loadTest('/classes', token);
  const [tables] = await query('SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  const [columns] = await query('SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  const [foreignKeys] = await query('SELECT COUNT(*) AS total FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()');
  verify(Number(tables.total) === 5 && Number(columns.total) === 37 && Number(foreignKeys.total) === 4,
    'Reduced model must have five tables, 37 columns and four foreign keys');
  return { passed: true, assertions, httpCases: evidence.length, coverage,
    mysqlVersion: (await query('SELECT VERSION() AS version'))[0].version,
    catalogLoad, model: { tables: 5, columns: 37, foreignKeys: 4, endpoints: 25 }, executedAt: new Date().toISOString(),
    fixtureNote: 'Disposable synthetic data in TEST_DB_NAME; no production database is reset.' };
}

async function main() {
  let summary;
  try {
    summary = await run();
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    summary = { passed: false, assertions, httpCases: evidence.length,
      message: error.message, executedAt: new Date().toISOString() };
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await fs.mkdir(path.join(__dirname, '../evidence'), { recursive: true });
    await fs.writeFile(path.join(__dirname, '../evidence/test-results.json'),
      JSON.stringify({ summary, cases: evidence }, null, 2));
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
}

main();
