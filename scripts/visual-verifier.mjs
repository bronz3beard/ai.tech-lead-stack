/**
 * @file visual-verifier.mjs
 * @description Captures multi-viewport screenshots of target URLs using Playwright.
 * Designed for visual regression testing and evidence gathering in AI-led workflows.
 * Supports automatic Playwright installation, auth-redirect detection, and
 * OPTIONAL per-project authentication so it can screenshot pages behind a login.
 *
 * @tool visual-verifier
 * @usage node scripts/visual-verifier.mjs [url1 url2 ...] [--no-check]
 * @params
 *   urls       - List of URLs to screenshot (defaults to E2E_BASE_URL or http://localhost:3000)
 *   --no-check - Skips the initial HTTP availability check
 *
 * @env  (PER-PROJECT, supplied at invocation — NEVER hardcoded here or in any skill)
 *   E2E_BASE_URL        - default target URL (overrides http://localhost:3000)
 *   E2E_STORAGE_STATE   - path to a pre-authenticated Playwright storageState JSON (PREFERRED:
 *                         no password ever reaches this script)
 *   E2E_LOGIN_URL       - login page URL for programmatic login (fallback path)
 *   E2E_USER            - test-account username/email (env only; never logged/committed)
 *   E2E_PASS            - test-account password    (env only; never logged/committed)
 *   E2E_USER_SELECTOR   - CSS for the username/email field (default: input[type="email"])
 *   E2E_PASS_SELECTOR   - CSS for the password field        (default: input[type="password"])
 *   E2E_SUBMIT_SELECTOR - CSS for the submit button         (default: button[type="submit"])
 *   E2E_SUCCESS_SELECTOR- optional CSS that confirms login succeeded (waited on if set)
 *
 * SECURITY: credentials are read ONLY from the environment, never from argv, and are
 * never printed, returned, or written to a tracked file. The generated storageState is
 * a session secret — write it to a gitignored path (default: auth/.e2e.storageState.json).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { chromium, devices } from 'playwright';

/**
 * Performs a lightweight HTTP(S) GET request to verify URL availability.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>} - True if status is 2xx or 3xx.
 */
async function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * Launch Chromium, auto-installing the browser binary on first run if missing.
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    console.warn(
      `\n⚠️  Playwright browser not found. Attempting to install automatically...`
    );
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    return await chromium.launch({ headless: true });
  }
}

/**
 * Resolve per-project auth configuration from the environment only.
 * @returns {{mode: 'storageState'|'login'|'none', [k:string]: any}}
 */
function resolveAuth() {
  const env = process.env;
  const stateExists = Boolean(
    env.E2E_STORAGE_STATE && fs.existsSync(env.E2E_STORAGE_STATE)
  );
  const hasLogin = Boolean(env.E2E_LOGIN_URL && env.E2E_USER && env.E2E_PASS);
  // Prefer an existing session file (no password needed). Otherwise log in if we
  // can, caching to E2E_STORAGE_STATE when that path was supplied. A storage path
  // that does not exist yet AND no creds = a misconfigured state that will warn.
  let mode;
  if (stateExists) mode = 'storageState';
  else if (hasLogin) mode = 'login';
  else if (env.E2E_STORAGE_STATE) mode = 'storageState';
  else mode = 'none';
  return {
    mode,
    storageStatePath: env.E2E_STORAGE_STATE || null,
    loginUrl: env.E2E_LOGIN_URL || null,
    // Held only in local scope; never logged or returned.
    user: env.E2E_USER || null,
    pass: env.E2E_PASS || null,
    userSel: env.E2E_USER_SELECTOR || 'input[type="email"]',
    passSel: env.E2E_PASS_SELECTOR || 'input[type="password"]',
    submitSel: env.E2E_SUBMIT_SELECTOR || 'button[type="submit"]',
    successSel: env.E2E_SUCCESS_SELECTOR || null,
  };
}

/**
 * Ensure we have a usable Playwright storageState file for authenticated capture.
 * - storageState mode: validates the provided file exists.
 * - login mode: performs a ONE-TIME programmatic login for the test account and
 *   saves the session to a gitignored path for reuse.
 * Returns the path to a storageState JSON, or null if unauthenticated.
 * @param {import('playwright').Browser} browser
 * @param {ReturnType<typeof resolveAuth>} auth
 * @returns {Promise<string|null>}
 */
async function ensureStorageState(browser, auth) {
  if (auth.mode === 'storageState') {
    if (auth.storageStatePath && fs.existsSync(auth.storageStatePath)) {
      console.log('🔐 Using pre-authenticated storage state.');
      return auth.storageStatePath;
    }
    console.warn(
      `⚠️  E2E_STORAGE_STATE set but file not found. Proceeding UNAUTHENTICATED.`
    );
    return null;
  }

  if (auth.mode === 'login') {
    const outPath =
      auth.storageStatePath || path.join('auth', '.e2e.storageState.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    console.log(
      '🔐 No storage state provided — performing one-time programmatic login for the test account...'
    );
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(auth.loginUrl, { waitUntil: 'load', timeout: 60000 });
      // Values come from env and are never logged.
      await page.fill(auth.userSel, auth.user);
      await page.fill(auth.passSel, auth.pass);
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        page.click(auth.submitSel),
      ]);
      if (auth.successSel) {
        await page.waitForSelector(auth.successSel, { timeout: 30000 });
      } else {
        await page.waitForTimeout(3000);
      }
      await ctx.storageState({ path: outPath });
      console.log(
        `🔐 Auth state captured → ${outPath}  (this is a session secret — keep it gitignored).`
      );
      return outPath;
    } catch (error) {
      // Never include credentials in error output.
      console.error(`❌ Programmatic login failed: ${error.message}`);
      return null;
    } finally {
      await ctx.close();
    }
  }

  return null;
}

/**
 * Capture screenshots across multiple device configurations.
 * @param {string} url
 * @param {Object} options
 * @param {boolean} [options.skipCheck]
 * @param {string|null} [options.storageStatePath] - Playwright storageState to authenticate the context.
 * @param {boolean} [options.authExpected] - Whether auth was supplied (controls auth-wall failure).
 * @param {string} [options.outputDir]
 * @returns {Promise<{authWall: boolean}>}
 */
async function captureScreenshots(url, options = {}) {
  const {
    outputDir = '.github/evidence',
    skipCheck = false,
    storageStatePath = null,
    authExpected = false,
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!skipCheck) {
    const isAlive = await checkUrl(url);
    if (!isAlive) {
      console.warn(
        `⚠️  Warning: URL ${url} might not be reachable. Proceeding anyway with Playwright.`
      );
    }
  }

  let browser;
  try {
    browser = await launchBrowser();
  } catch (installError) {
    console.error(
      `❌ Error: Could not launch or install Playwright: ${installError.message}`
    );
    console.error(
      `👉 Potential Fix: 'npm run setup-browsers' manually on your host machine.`
    );
    return { authWall: false };
  }

  const configs = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', ...devices['iPhone 14'] },
  ];

  console.log(`📸 Starting screenshot capture for: ${url}`);
  let authWall = false;

  for (const config of configs) {
    const context = await browser.newContext({
      viewport: config.width
        ? { width: config.width, height: config.height }
        : config.viewport,
      userAgent: config.userAgent,
      // Authenticate the context if we have a session state.
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page
        .waitForLoadState('networkidle')
        .catch(() =>
          console.log('  Wait for networkidle timed out, proceeding anyway...')
        );
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      const isAuthRedirect = (urlPath, finalUrlPath) => {
        const authKeywords = [
          'login',
          'signin',
          'auth',
          'authorize',
          'session',
        ];
        return authKeywords.some(
          (kw) =>
            !urlPath.toLowerCase().includes(kw) &&
            finalUrlPath.toLowerCase().includes(kw)
        );
      };

      if (isAuthRedirect(url, finalUrl)) {
        authWall = true;
        console.warn(
          `\n⚠️  WARNING: Requested ${url} but ended up at ${finalUrl}. Auth wall likely detected.`
        );
        if (authExpected) {
          console.warn(
            '   Auth was supplied but the session did not stick (expired state or failed login).'
          );
        } else {
          console.warn(
            '   No auth supplied. Provide E2E_STORAGE_STATE (or E2E_LOGIN_URL + E2E_USER/E2E_PASS) to capture authenticated pages.'
          );
        }
      }

      const urlPath = url.replace(/^https?:\/\//, '').replace(/[\/:]/g, '-');
      const fileName = `${urlPath || 'index'}-${config.name}.png`;
      const filePath = path.join(outputDir, fileName);

      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`✅ Captured ${config.name} screenshot: ${filePath}`);
    } catch (error) {
      console.error(
        `❌ Failed to capture ${config.name} screenshot: ${error.message}`
      );
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log('🏁 Screenshot capture complete.');
  return { authWall };
}

// -----------------------------------------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const skipCheck = args.includes('--no-check');
const targetUrls = args.filter((a) => !a.startsWith('--'));

if (targetUrls.length === 0) {
  targetUrls.push(process.env.E2E_BASE_URL || 'http://localhost:3000');
}

(async () => {
  const auth = resolveAuth();
  let storageStatePath = null;

  // Establish (or validate) an authenticated session ONCE, before any capture.
  if (auth.mode !== 'none') {
    try {
      const setupBrowser = await launchBrowser();
      storageStatePath = await ensureStorageState(setupBrowser, auth);
      await setupBrowser.close();
    } catch (e) {
      console.warn(
        `⚠️  Auth setup skipped (${e.message}). Proceeding unauthenticated.`
      );
    }
  }

  let authWallHit = false;
  for (const url of targetUrls) {
    const result = await captureScreenshots(url, {
      skipCheck,
      storageStatePath,
      authExpected: auth.mode !== 'none',
    }).catch((err) => {
      console.error(err);
      return { authWall: false };
    });
    if (result?.authWall) authWallHit = true;
  }

  // If auth was expected but we still hit a login wall, fail loudly so the
  // calling agent (pr-automator) STOPS instead of attaching login-page shots.
  if (auth.mode !== 'none' && authWallHit) {
    console.error(
      JSON.stringify({
        status: 'failed',
        error:
          'Auth wall hit despite supplied auth (expired session or failed login). Refusing to treat login-page screenshots as evidence.',
      })
    );
    process.exit(2);
  }
})();
