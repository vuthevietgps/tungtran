/* eslint-disable no-console */
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'sale1@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '123456789';
const SERVER_CWD = path.join(__dirname, '..');
const SERVER_ENTRY = path.join(SERVER_CWD, 'dist', 'main.js');
const SERVER_READY_TOKEN = 'Nest application successfully started';
const SERVER_START_TIMEOUT_MS = Number(process.env.SERVER_START_TIMEOUT_MS || 15000);

async function startServer() {
  console.log('Starting backend server for tests');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: SERVER_CWD,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const onReady = () => {
      if (!resolved) {
        resolved = true;
        console.log('Backend server is ready');
        resolve(child);
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        reject(new Error(`Server did not start within ${SERVER_START_TIMEOUT_MS} ms`));
        child.kill();
      }
    }, SERVER_START_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[server] ${text}`);
      if (text.includes(SERVER_READY_TOKEN)) {
        clearTimeout(timer);
        onReady();
      }
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[server-err] ${chunk}`);
    });

    child.on('exit', (code) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(new Error(`Server exited early with code ${code}`));
      }
    });
  });
}

async function stopServer(child) {
  if (!child) return;
  console.log('Stopping backend server');
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(resolve, 2000);
  });
}

async function http(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('Missing access token in login response');
  return data.access_token;
}

async function run() {
  const server = await startServer();
  try {
  console.log('Logging in as', TEST_EMAIL);
  const token = await login();
  console.log('Login successful');

  const orderPayload = {
    studentName: 'Order Test Student',
    studentCode: `OTS${Date.now()}`,
    parentName: 'Order Test Parent',
    level: 'A1',
    teacherName: 'Optional Teacher',
    dataStatus: 'NEW',
  };

  console.log('Creating order');
  const created = await http('POST', '/orders', token, orderPayload);
  assert(created && created._id, 'Create response missing _id');
  console.log('Order created with id', created._id);

  console.log('Fetching all orders');
  const allOrders = await http('GET', '/orders', token);
  const found = allOrders.find((item) => item._id === created._id);
  assert(found, 'Created order not found in list');
  assert.strictEqual(found.studentCode, created.studentCode);
  console.log('Order present in list');

  console.log('Fetching order by id');
  const single = await http('GET', `/orders/${created._id}`, token);
  assert.strictEqual(single._id, created._id);
  console.log('Fetch by id succeeded');

  console.log('Updating order dataStatus -> UPDATED');
  const updated = await http('PATCH', `/orders/${created._id}`, token, { dataStatus: 'UPDATED' });
  assert.strictEqual(updated.dataStatus, 'UPDATED');
  console.log('Update succeeded');

  console.log('Deleting order');
  await http('DELETE', `/orders/${created._id}`, token);
  console.log('Delete succeeded');

  console.log('Confirming deletion');
  const ordersAfterDelete = await http('GET', '/orders', token);
  const stillExists = ordersAfterDelete.some((item) => item._id === created._id);
  assert(!stillExists, 'Order still present after deletion');
  console.log('Deletion confirmed');

  console.log('All order management tests passed');
  await stopServer(server);
  } catch (err) {
    await stopServer(server);
    throw err;
  }
}

run().catch((err) => {
  console.error('Test run failed:', err.message);
  process.exitCode = 1;
});
