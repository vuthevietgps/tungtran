/* eslint-disable no-console */
const path = require('path');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const LOAD_TEST_EMAIL = process.env.LOAD_TEST_EMAIL || 'director.demo@school.local';
const LOAD_TEST_PASSWORD = process.env.LOAD_TEST_PASSWORD || process.env.DEMO_PASSWORD || 'ChangeThisDemoPass2024!';
const DURATION_SEC = Number(process.env.LOAD_DURATION_SEC || 60);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 1);
const THINK_TIME_MS = Number(process.env.LOAD_THINK_TIME_MS || 900);
const REQUEST_TIMEOUT_MS = Number(process.env.LOAD_REQUEST_TIMEOUT_MS || 10000);
const ENDPOINTS = String(process.env.LOAD_ENDPOINTS || '/users/me,/classes,/dashboard/director')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FAIL_ON_ERROR = String(process.env.LOAD_FAIL_ON_ERROR || 'false').toLowerCase() === 'true';

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function buildCookieHeader(cookieJar) {
  return Object.entries(cookieJar)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function loginAndGetCookie() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: LOAD_TEST_EMAIL, password: LOAD_TEST_PASSWORD }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Login failed: ${res.status} ${text.slice(0, 500)}`);
    }

    const cookieJar = {};
    const setCookies = getSetCookieHeaders(res);
    setCookies.forEach((entry) => {
      const parsed = parseCookiePairFromSetCookie(entry);
      if (parsed) cookieJar[parsed.name] = parsed.value;
    });

    const cookieHeader = buildCookieHeader(cookieJar);
    ensure(cookieHeader, 'Could not extract auth cookie from login response');
    return cookieHeader;
  } finally {
    clearTimeout(timeout);
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.max(0, Math.min(sorted.length - 1, pos));
  return sorted[idx];
}

function summarizeLatencies(latencies) {
  if (!latencies.length) {
    return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sum = latencies.reduce((acc, ms) => acc + ms, 0);
  return {
    avg: sum / latencies.length,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    min: Math.min(...latencies),
    max: Math.max(...latencies),
  };
}

function formatMs(ms) {
  return `${ms.toFixed(2)}ms`;
}

async function requestWithTimeout(endpointPath, cookieHeader) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${endpointPath}`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    return { ok: true, status: res.status, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runLoad() {
  ensure(DURATION_SEC > 0, 'LOAD_DURATION_SEC must be > 0');
  ensure(CONCURRENCY > 0, 'LOAD_CONCURRENCY must be > 0');
  ensure(ENDPOINTS.length > 0, 'LOAD_ENDPOINTS must contain at least one endpoint');

  console.log('=== API Load Test ===');
  console.log(`API_BASE           : ${API_BASE}`);
  console.log(`User               : ${LOAD_TEST_EMAIL}`);
  console.log(`Duration           : ${DURATION_SEC}s`);
  console.log(`Concurrency        : ${CONCURRENCY}`);
  console.log(`Think time         : ${THINK_TIME_MS}ms`);
  console.log(`Request timeout    : ${REQUEST_TIMEOUT_MS}ms`);
  console.log(`Endpoints          : ${ENDPOINTS.join(', ')}`);

  const cookieHeader = await loginAndGetCookie();
  console.log('Login              : OK');

  const statusCounts = new Map();
  const endpointStats = new Map();
  ENDPOINTS.forEach((ep) => {
    endpointStats.set(ep, { total: 0, ok2xx: 0, latencies: [] });
  });

  const allLatencies = [];
  const startedAt = Date.now();
  const stopAt = startedAt + DURATION_SEC * 1000;

  let cursor = 0;
  function nextEndpoint() {
    const idx = cursor % ENDPOINTS.length;
    cursor += 1;
    return ENDPOINTS[idx];
  }

  async function worker(workerId) {
    while (Date.now() < stopAt) {
      const endpoint = nextEndpoint();
      const result = await requestWithTimeout(endpoint, cookieHeader);
      const statusKey = String(result.status);

      statusCounts.set(statusKey, (statusCounts.get(statusKey) || 0) + 1);
      allLatencies.push(result.latencyMs);

      const stat = endpointStats.get(endpoint);
      if (stat) {
        stat.total += 1;
        stat.latencies.push(result.latencyMs);
        if (result.ok && Number(result.status) >= 200 && Number(result.status) < 300) {
          stat.ok2xx += 1;
        }
      }

      if (THINK_TIME_MS > 0) {
        const jitter = (workerId % 3) * 5;
        await sleep(THINK_TIME_MS + jitter);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  const elapsedSec = (Date.now() - startedAt) / 1000;
  const totalRequests = Array.from(statusCounts.values()).reduce((acc, v) => acc + v, 0);
  const ok2xx =
    (statusCounts.get('200') || 0) +
    (statusCounts.get('201') || 0) +
    (statusCounts.get('202') || 0) +
    (statusCounts.get('204') || 0);
  const non2xx = totalRequests - ok2xx;

  const latency = summarizeLatencies(allLatencies);
  const statusRows = Array.from(statusCounts.entries()).sort((a, b) => {
    const aNum = Number(a[0]);
    const bNum = Number(b[0]);
    if (Number.isNaN(aNum) && Number.isNaN(bNum)) return String(a[0]).localeCompare(String(b[0]));
    if (Number.isNaN(aNum)) return 1;
    if (Number.isNaN(bNum)) return -1;
    return aNum - bNum;
  });

  console.log('\n=== Summary ===');
  console.log(`Elapsed            : ${elapsedSec.toFixed(2)}s`);
  console.log(`Total requests     : ${totalRequests}`);
  console.log(`Throughput         : ${(totalRequests / elapsedSec).toFixed(2)} req/s`);
  console.log(`2xx success        : ${ok2xx} (${totalRequests ? ((ok2xx / totalRequests) * 100).toFixed(2) : '0.00'}%)`);
  console.log(`Non-2xx / errors   : ${non2xx} (${totalRequests ? ((non2xx / totalRequests) * 100).toFixed(2) : '0.00'}%)`);
  console.log(`Latency avg        : ${formatMs(latency.avg)}`);
  console.log(`Latency p50/p95/p99: ${formatMs(latency.p50)} / ${formatMs(latency.p95)} / ${formatMs(latency.p99)}`);
  console.log(`Latency min/max    : ${formatMs(latency.min)} / ${formatMs(latency.max)}`);

  console.log('\nStatus breakdown:');
  statusRows.forEach(([status, count]) => {
    const ratio = totalRequests ? ((count / totalRequests) * 100).toFixed(2) : '0.00';
    console.log(`- ${status}: ${count} (${ratio}%)`);
  });

  console.log('\nPer-endpoint:');
  ENDPOINTS.forEach((endpoint) => {
    const stat = endpointStats.get(endpoint);
    if (!stat) return;
    const perLatency = summarizeLatencies(stat.latencies);
    const successRatio = stat.total ? ((stat.ok2xx / stat.total) * 100).toFixed(2) : '0.00';
    console.log(
      `- ${endpoint} | total=${stat.total} | 2xx=${stat.ok2xx} (${successRatio}%) | p95=${formatMs(perLatency.p95)}`,
    );
  });

  if (FAIL_ON_ERROR && non2xx > 0) {
    process.exitCode = 1;
  }
}

runLoad().catch((err) => {
  console.error('\nLoad test failed to execute:');
  console.error(err);
  process.exit(1);
});
