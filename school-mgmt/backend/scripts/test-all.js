/* eslint-disable no-console */
const path = require('path');
const { spawn } = require('child_process');

try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

const API_BASE = process.env.TEST_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const RETRY_WAIT_MS = 70000;
const BETWEEN_TEST_WAIT_MS = 1200;
const GENERIC_RETRY_WAIT_MS = 2500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitOutput(output) {
  return /429|Too Many Requests|ThrottlerException/i.test(output || '');
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve) => {
    const mergedEnv = { ...process.env, ...env };
    const child = spawn(command, args, {
      cwd: path.join(__dirname, '..'),
      env: mergedEnv,
      shell: process.platform === 'win32',
    });

    let output = '';

    child.stdout.on('data', (buf) => {
      const chunk = String(buf);
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (buf) => {
      const chunk = String(buf);
      output += chunk;
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      resolve({ code: code || 0, output });
    });
  });
}

async function checkBackendReachable() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      method: 'GET',
      signal: controller.signal,
    });
    if ([200, 401, 403, 404].includes(res.status)) return true;
    return false;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function buildTests(withLoad) {
  const npm = getNpmCommand();
  const tests = [
    {
      name: 'Seed database',
      command: 'node',
      args: ['scripts/seed-all.js'],
      retryOnRateLimit: false,
    },
    {
      name: 'Financial control costs regression',
      command: npm,
      args: ['run', 'test:financial-control-costs'],
      retryOnRateLimit: false,
    },
    {
      name: 'Ads financial-control recalculation',
      command: npm,
      args: ['run', 'test:ads-financial-control-recalculation'],
      retryOnRateLimit: false,
    },
    {
      name: 'Expenses financial-control recalculation',
      command: npm,
      args: ['run', 'test:expenses-financial-control-recalculation'],
      retryOnRateLimit: false,
    },
    {
      name: 'Financial control loans regression',
      command: npm,
      args: ['run', 'test:financial-control-loans'],
      retryOnRateLimit: false,
    },
    {
      name: 'Financial control payroll regression',
      command: npm,
      args: ['run', 'test:financial-control-payroll'],
      retryOnRateLimit: false,
    },
    {
      name: 'Financial control payroll recalculation',
      command: npm,
      args: ['run', 'test:financial-control-payroll-recalculation'],
      retryOnRateLimit: false,
    },
    {
      name: 'Attendance-payroll-financial control regression',
      command: npm,
      args: ['run', 'test:attendance-payroll-financial-control'],
      retryOnRateLimit: false,
    },
    {
      name: 'Loans activate status',
      command: npm,
      args: ['run', 'test:loans-activate'],
      retryOnRateLimit: false,
    },
    {
      name: 'Loans partial payment',
      command: npm,
      args: ['run', 'test:loans-payment'],
      retryOnRateLimit: false,
    },
    {
      name: 'Class-attendance-pricing workflow',
      command: 'node',
      args: ['scripts/test-class-attendance-pricing-workflow.js'],
      retryOnRateLimit: true,
      maxRetries: 1,
    },
    {
      name: 'Attendance workflow',
      command: npm,
      args: ['run', 'test:attendance-workflow'],
      retryOnRateLimit: true,
      maxRetries: 1,
    },
    {
      name: 'Wallet top-up workflow',
      command: npm,
      args: ['run', 'test:wallet-topup-workflow'],
      retryOnRateLimit: true,
      maxRetries: 1,
    },
    {
      name: 'RBAC finance guards',
      command: npm,
      args: ['run', 'test:rbac-finance-guards'],
      retryOnRateLimit: true,
      maxRetries: 1,
    },
    {
      name: 'Teacher payroll ops scenarios',
      command: npm,
      args: ['run', 'test:teacher-payroll-ops-scenarios'],
      retryOnRateLimit: true,
      maxRetries: 1,
    },
    {
      name: 'Uncovered subsystems workflow',
      command: npm,
      args: ['run', 'test:uncovered-subsystems'],
      retryOnRateLimit: true,
      maxRetries: 1,
    },
  ];

  if (withLoad) {
    tests.push({
      name: 'API load baseline (30s)',
      command: npm,
      args: ['run', 'test:api-load'],
      env: {
        LOAD_CONCURRENCY: '1',
        LOAD_DURATION_SEC: '30',
        LOAD_THINK_TIME_MS: '900',
      },
      retryOnRateLimit: false,
    });
  }

  return tests;
}

async function main() {
  const withLoad = process.argv.includes('--with-load');

  console.log('=== Full Test Runner ===');
  console.log(`API base : ${API_BASE}`);
  console.log(`Include load test : ${withLoad ? 'yes' : 'no'}`);

  const backendOk = await checkBackendReachable();
  if (!backendOk) {
    console.error(
      `Backend is not reachable at ${API_BASE}. Start backend first (e.g. npm run start:dev).`,
    );
    process.exit(1);
  }

  const tests = buildTests(withLoad);
  const results = [];

  for (let i = 0; i < tests.length; i += 1) {
    const test = tests[i];
    const total = tests.length;
    const env = test.env || {};
    const maxRetries = Number(test.maxRetries || 0);

    console.log(`\n[${i + 1}/${total}] ${test.name}`);
    let attempt = 0;
    let passed = false;
    let retried = false;
    let run = null;

    while (attempt <= maxRetries) {
      attempt += 1;
      run = await runCommand(test.command, test.args, env);
      passed = run.code === 0;
      if (passed) break;

      if (attempt > maxRetries) break;
      retried = true;

      const rateLimited = test.retryOnRateLimit && isRateLimitOutput(run.output);
      if (rateLimited) {
        console.log(
          `Rate-limit detected. Waiting ${Math.round(RETRY_WAIT_MS / 1000)}s before retry ${attempt}/${maxRetries}...`,
        );
        await sleep(RETRY_WAIT_MS);
      } else {
        console.log(
          `Test failed. Waiting ${Math.round(GENERIC_RETRY_WAIT_MS / 1000)}s before retry ${attempt}/${maxRetries}...`,
        );
        await sleep(GENERIC_RETRY_WAIT_MS);
      }
    }

    results.push({
      name: test.name,
      status: passed ? 'PASS' : 'FAIL',
      retried,
    });

    if (!passed) {
      console.log(`\nFAILED at: ${test.name}`);
      break;
    }

    if (i < tests.length - 1) {
      await sleep(BETWEEN_TEST_WAIT_MS);
    }
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const retriedCount = results.filter((r) => r.retried).length;

  console.log('\n=== Final Summary ===');
  console.log(`PASS   : ${pass}`);
  console.log(`FAIL   : ${fail}`);
  console.log(`RETRY  : ${retriedCount}`);

  if (fail > 0) {
    const firstFail = results.find((r) => r.status === 'FAIL');
    console.log(`Failed test: ${firstFail ? firstFail.name : 'unknown'}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running test-all:', err);
  process.exit(1);
});
