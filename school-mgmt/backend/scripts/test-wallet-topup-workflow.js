/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const REQUEST_TIMEOUT_MS = 30000;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeId(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (typeof v._id === 'string') return v._id;
    if (v._id && typeof v._id.toString === 'function') return v._id.toString();
    if (typeof v.toString === 'function') return v.toString();
  }
  return String(v);
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

function getSetCookieHeaders(res) {
  if (res && res.headers && typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }
  const single = res && res.headers ? res.headers.get('set-cookie') : null;
  return single ? [single] : [];
}

function parseCookiePairFromSetCookie(setCookieValue) {
  const firstPart = String(setCookieValue || '').split(';')[0];
  const idx = firstPart.indexOf('=');
  if (idx <= 0) return null;
  const name = firstPart.slice(0, idx).trim();
  const value = firstPart.slice(idx + 1).trim();
  if (!name) return null;
  return { name, value };
}

function extractCookiesFromResponse(res) {
  const jar = {};
  const setCookies = getSetCookieHeaders(res);
  setCookies.forEach((entry) => {
    const parsed = parseCookiePairFromSetCookie(entry);
    if (parsed) jar[parsed.name] = parsed.value;
  });
  return jar;
}

function buildCookieHeader(cookieJar) {
  if (!cookieJar || typeof cookieJar !== 'object') return '';
  return Object.entries(cookieJar)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function extractXsrfFromCookieHeader(cookieHeader) {
  const m = String(cookieHeader || '').match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m && m[1] ? m[1] : null;
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return { text: '', json: null };
  try {
    return { text, json: JSON.parse(text) };
  } catch (_) {
    return { text, json: null };
  }
}

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request({
  method = 'GET',
  reqPath,
  token,
  body,
  expectedStatus = [200],
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Cookie = token;
    if (!isSafeMethod(method)) {
      const xsrf = extractXsrfFromCookieHeader(token);
      if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    }

    const res = await fetch(`${API_BASE}${reqPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed = await parseResponse(res);
    const ok = Array.isArray(expectedStatus)
      ? expectedStatus.includes(res.status)
      : res.status === expectedStatus;

    if (!ok) {
      throw new Error(
        `${method} ${reqPath} expected ${JSON.stringify(expectedStatus)} but got ${res.status}. ` +
          `Response: ${parsed.text.slice(0, 600)}`,
      );
    }

    return { status: res.status, data: parsed.json, raw: parsed.text };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const parsed = await parseResponse(res);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${parsed.text}`);
  }

  const cookieJar = extractCookiesFromResponse(res);
  ensure(cookieJar.access_token, `No access_token cookie returned for ${email}`);

  if (!cookieJar['XSRF-TOKEN']) {
    const meRes = await fetch(`${API_BASE}/users/me`, {
      headers: { Cookie: `access_token=${cookieJar.access_token}` },
    });
    Object.assign(cookieJar, extractCookiesFromResponse(meRes));
  }

  ensure(cookieJar['XSRF-TOKEN'], `No XSRF-TOKEN cookie returned for ${email}`);
  return {
    token: buildCookieHeader({
      access_token: cookieJar.access_token,
      'XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
    }),
    user: parsed.json && parsed.json.user ? parsed.json.user : null,
  };
}

class TestRunner {
  constructor() {
    this.results = [];
  }

  async test(name, fn) {
    const start = Date.now();
    try {
      await fn();
      const ms = Date.now() - start;
      this.results.push({ name, status: 'PASS', ms });
      console.log(`PASS | ${name} (${ms}ms)`);
    } catch (err) {
      const ms = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      this.results.push({ name, status: 'FAIL', ms, error });
      console.log(`FAIL | ${name} (${ms}ms)`);
      console.log(`      ${error}`);
    }
  }

  summary() {
    const pass = this.results.filter((r) => r.status === 'PASS').length;
    const fail = this.results.filter((r) => r.status === 'FAIL').length;
    console.log('\n=== Wallet Top-up Workflow Summary ===');
    console.log(`API Base : ${API_BASE}`);
    console.log(`PASS     : ${pass}`);
    console.log(`FAIL     : ${fail}`);
    if (fail > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.log(`- ${r.name}: ${r.error}`));
    }
    return { pass, fail };
  }
}

async function main() {
  const runner = new TestRunner();

  console.log(`Testing top-up workflow against ${API_BASE}`);

  const auth = {};
  const accountEmails = {
    parent: 'parent.demo@school.local',
    accounting: 'accounting.demo@school.local',
    director: 'director.demo@school.local',
  };

  for (const [role, email] of Object.entries(accountEmails)) {
    const loginData = await login(email, DEMO_PASSWORD);
    auth[role] = loginData;
    console.log(`- ${role.toUpperCase()} logged in (${email})`);
  }

  let parentUserId = normalizeId(auth.parent.user && (auth.parent.user._id || auth.parent.user.id));
  if (!parentUserId) {
    const me = await request({
      method: 'GET',
      reqPath: '/users/me',
      token: auth.parent.token,
      expectedStatus: [200],
    });
    parentUserId = normalizeId(me.data && (me.data._id || me.data.id));
  }
  ensure(parentUserId, 'Cannot resolve parent userId');

  const directorUserId = normalizeId(auth.director.user && (auth.director.user._id || auth.director.user.id));
  ensure(directorUserId, 'Cannot resolve director userId');

  const topUpAmountApproved = 12000;
  const topUpAmountRejected = 13000;
  const txRef1 = `TOPUP-AUTO-${Date.now()}-A`;
  const txRef2 = `TOPUP-AUTO-${Date.now()}-R`;

  let walletBefore = 0;
  let walletAfterApprove = 0;
  let walletAfterReject = 0;
  let approvedTopUpId = null;
  let rejectedTopUpId = null;

  await runner.test('PARENT cannot create top-up for another user', async () => {
    await request({
      method: 'POST',
      reqPath: '/wallets/top-up',
      token: auth.parent.token,
      expectedStatus: [403],
      body: {
        userId: directorUserId,
        amount: 5000,
        paymentMethod: 'BANK_TRANSFER',
        transactionRef: `FORBIDDEN-${Date.now()}`,
        receiptImageUrl: 'https://example.com/receipt-forbidden.jpg',
      },
    });
  });

  await runner.test('Capture wallet balance before top-up', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/wallets/user/${parentUserId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    walletBefore = Number(res.data.balance || 0);
  });

  await runner.test('PARENT creates top-up request (PENDING)', async () => {
    const res = await request({
      method: 'POST',
      reqPath: '/wallets/top-up',
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {
        userId: parentUserId,
        amount: topUpAmountApproved,
        paymentMethod: 'BANK_TRANSFER',
        transactionRef: txRef1,
        receiptImageUrl: 'https://example.com/receipt-approved.jpg',
        description: 'automation top-up approve flow',
      },
    });

    approvedTopUpId = normalizeId(res.data && (res.data._id || res.data.id));
    ensure(approvedTopUpId, 'Top-up request did not return entry id');
    ensure(res.data.status === 'PENDING', `Expected PENDING, got ${res.data.status}`);
    ensure(res.data.type === 'TOP_UP', `Expected TOP_UP, got ${res.data.type}`);
  });

  await runner.test('ACCOUNTING sees top-up request in pending list', async () => {
    const res = await request({
      method: 'GET',
      reqPath: '/wallets/top-up/pending',
      token: auth.accounting.token,
      expectedStatus: [200],
    });
    ensure(Array.isArray(res.data), 'Pending top-ups should return array');
    const found = res.data.some((e) => normalizeId(e._id) === approvedTopUpId);
    ensure(found, `Pending list does not include top-up ${approvedTopUpId}`);
  });

  await runner.test('ACCOUNTING approves top-up request', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/wallets/top-up/${approvedTopUpId}/approve`,
      token: auth.accounting.token,
      expectedStatus: [200, 201],
      body: {
        bankMatched: true,
        bankStatementRef: `BANK-STMT-${Date.now()}-A`,
        accountingNotes: 'approved by automation test',
      },
    });

    ensure(res.data.status === 'APPROVED', `Expected APPROVED, got ${res.data.status}`);
    ensure(Number(res.data.amount) === topUpAmountApproved, 'Approved amount mismatch');
  });

  await runner.test('Wallet balance increases after approve', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/wallets/user/${parentUserId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    walletAfterApprove = Number(res.data.balance || 0);
    ensure(
      walletAfterApprove === walletBefore + topUpAmountApproved,
      `Balance mismatch: before=${walletBefore}, afterApprove=${walletAfterApprove}, amount=${topUpAmountApproved}`,
    );
  });

  await runner.test('Ledger records approved top-up with expected status', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/wallets/ledger${qs({ userId: parentUserId, type: 'TOP_UP', limit: 50 })}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    ensure(res.data && Array.isArray(res.data.data), 'Ledger data should be array');

    const entry = res.data.data.find((e) => normalizeId(e._id) === approvedTopUpId);
    ensure(entry, `Cannot find approved top-up ${approvedTopUpId} in ledger`);
    ensure(entry.status === 'APPROVED', `Expected ledger status APPROVED, got ${entry.status}`);
  });

  await runner.test('PARENT creates another top-up request for reject flow', async () => {
    const res = await request({
      method: 'POST',
      reqPath: '/wallets/top-up',
      token: auth.parent.token,
      expectedStatus: [200, 201],
      body: {
        userId: parentUserId,
        amount: topUpAmountRejected,
        paymentMethod: 'BANK_TRANSFER',
        transactionRef: txRef2,
        receiptImageUrl: 'https://example.com/receipt-rejected.jpg',
        description: 'automation top-up reject flow',
      },
    });

    rejectedTopUpId = normalizeId(res.data && (res.data._id || res.data.id));
    ensure(rejectedTopUpId, 'Reject flow top-up did not return entry id');
    ensure(res.data.status === 'PENDING', `Expected PENDING, got ${res.data.status}`);
  });

  await runner.test('ACCOUNTING rejects second top-up request', async () => {
    const res = await request({
      method: 'POST',
      reqPath: `/wallets/top-up/${rejectedTopUpId}/reject`,
      token: auth.accounting.token,
      expectedStatus: [200, 201],
      body: { reason: 'automation reject test' },
    });

    ensure(res.data.status === 'REJECTED', `Expected REJECTED, got ${res.data.status}`);
  });

  await runner.test('Wallet balance unchanged after reject', async () => {
    const res = await request({
      method: 'GET',
      reqPath: `/wallets/user/${parentUserId}`,
      token: auth.director.token,
      expectedStatus: [200],
    });
    walletAfterReject = Number(res.data.balance || 0);
    ensure(
      walletAfterReject === walletAfterApprove,
      `Balance changed after reject: afterApprove=${walletAfterApprove}, afterReject=${walletAfterReject}`,
    );
  });

  const result = runner.summary();
  if (result.fail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal error running wallet top-up workflow test:');
  console.error(err);
  process.exit(1);
});
