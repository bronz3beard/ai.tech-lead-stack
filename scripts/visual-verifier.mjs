#!/usr/bin/env node
/**
 * @file visual-verifier.mjs
 * @description Captures multi-viewport screenshots of target URLs using Playwright.
 * Outputs a structured JSON manifest detailing status, auth details, and screenshots
 * on stdout. Human-readable logs are directed to stderr.
 */

import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { chromium, devices } from 'playwright';

// Redirect console.log and console.warn to stderr
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

function getFeatureBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    return branch.replace(/[^a-zA-Z0-9-]/g, '-');
  } catch {
    return 'unknown-branch';
  }
}

/**
 * Detects if a page represents an authentication wall, is unreachable, or is blank.
 * @param {Object} options
 * @param {string} options.requestedUrl
 * @param {string} options.finalUrl
 * @param {import('playwright').Page} options.page
 * @param {number} options.httpStatus
 * @returns {Promise<string|null>} null if clear, or reason string ('auth_wall', 'target_unreachable', 'rejected_blank')
 */
export async function detectAuthWall({
  requestedUrl,
  finalUrl,
  page,
  httpStatus,
}) {
  if (httpStatus >= 500 || httpStatus === 404) {
    return 'target_unreachable';
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return 'auth_wall';
  }

  let reqUrlObj, finUrlObj;
  try {
    reqUrlObj = new URL(requestedUrl);
    finUrlObj = new URL(finalUrl);
  } catch {
    return null; // fallback
  }

  const authSegments = new Set([
    'login',
    'signin',
    'sign-in',
    'signup',
    'auth',
    'oauth',
    'authorize',
    'session',
    'sso',
  ]);

  const getSegments = (u) =>
    u.pathname
      .split('/')
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  const reqSegments = getSegments(reqUrlObj);
  const finSegments = getSegments(finUrlObj);

  const hasPathChanged = reqUrlObj.pathname !== finUrlObj.pathname;
  const pathSignal =
    hasPathChanged && finSegments.some((seg) => authSegments.has(seg));

  let domSignal = false;
  try {
    const pwdCount = await page.locator('input[type="password"]').count();
    if (pwdCount > 0) {
      domSignal = true;
    } else {
      const formHasAuthName = await page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
          const ariaLabel = form.getAttribute('aria-label') || '';
          if (/sign[- ]?in|log[- ]?in/i.test(ariaLabel)) return true;
        }
        return false;
      });
      domSignal = formHasAuthName;
    }
  } catch (e) {
    // Ignore
  }

  if (domSignal || pathSignal) {
    return 'auth_wall';
  }

  try {
    const isBlank = await page.evaluate(() => {
      const text = document.body.innerText.trim();
      const hasMedia =
        document.querySelectorAll('img, svg, canvas, table').length > 0;
      return text.length < 20 && !hasMedia;
    });
    if (isBlank) return 'rejected_blank';
  } catch (e) {
    // Ignore
  }

  return null;
}

function resolveAuth() {
  const env = process.env;
  const stateExists = Boolean(
    env.E2E_STORAGE_STATE && fs.existsSync(env.E2E_STORAGE_STATE)
  );
  const hasLogin = Boolean(env.E2E_LOGIN_URL && env.E2E_USER && env.E2E_PASS);
  let mode;
  if (stateExists) mode = 'storageState';
  else if (hasLogin) mode = 'login';
  else if (env.E2E_STORAGE_STATE) mode = 'storageState';
  else mode = 'none';
  return {
    mode,
    storageStatePath: env.E2E_STORAGE_STATE || null,
    loginUrl: env.E2E_LOGIN_URL || null,
    user: env.E2E_USER || null,
    pass: env.E2E_PASS || null,
    userSel: env.E2E_USER_SELECTOR || 'input[type="email"]',
    passSel: env.E2E_PASS_SELECTOR || 'input[type="password"]',
    submitSel: env.E2E_SUBMIT_SELECTOR || 'button[type="submit"]',
    successSel: env.E2E_SUCCESS_SELECTOR || null,
  };
}

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
    // Guard: Git ignored check
    try {
      execSync(`git check-ignore -q "${outPath}"`);
    } catch {
      console.warn(
        `⚠️  Refusing to write session state to unignored path: ${outPath}`
      );
      return null;
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    console.log('🔐 Performing one-time programmatic login...');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(auth.loginUrl, { waitUntil: 'load', timeout: 60000 });
      await page.fill(auth.userSel, auth.user);
      await page.fill(auth.passSel, auth.pass);

      await page.click(auth.submitSel);
      await page.waitForLoadState('networkidle').catch(() => {});

      if (auth.successSel) {
        await page.waitForSelector(auth.successSel, { timeout: 30000 });
      } else {
        await page.waitForTimeout(3000);
      }
      await ctx.storageState({ path: outPath });
      console.log(`🔐 Auth state captured -> ${outPath}`);
      return outPath;
    } catch (error) {
      console.error(`❌ Programmatic login failed.`);
      return null;
    } finally {
      await ctx.close();
    }
  }

  return null;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    console.warn(
      `\n⚠️  Playwright browser not found. Attempting to install automatically...`
    );
    try {
      execFileSync(
        'npx',
        ['playwright', 'install', 'chromium', '--with-deps'],
        {
          timeout: 180000,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      return await chromium.launch({ headless: true });
    } catch (e) {
      throw new Error('Browser install failed or unavailable');
    }
  }
}

function hashFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// -----------------------------------------------------------------------------
// Main execution
// -----------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  let outDirIdx = args.indexOf('--out-dir');
  let outputDir = `.ai/evidence/${getFeatureBranch()}`;

  if (outDirIdx !== -1 && args[outDirIdx + 1]) {
    outputDir = args[outDirIdx + 1];
    args.splice(outDirIdx, 2);
  }

  const targetUrls = args.filter((a) => !a.startsWith('--'));
  if (targetUrls.length === 0) {
    targetUrls.push(process.env.E2E_BASE_URL || 'http://localhost:3000');
  }

  const manifest = {
    schemaVersion: 1,
    status: 'ok',
    reason: null,
    featureBranch: getFeatureBranch(),
    capturedAt: new Date().toISOString(),
    outputDir,
    targets: [],
    shots: [],
  };

  const auth = resolveAuth();
  let storageStatePath = null;
  let browser;

  try {
    browser = await launchBrowser();
  } catch (err) {
    manifest.status = 'blocked';
    manifest.reason = 'browser_unavailable';
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
    process.exit(30); // 30: blocked - browser unavailable
  }

  if (auth.mode !== 'none') {
    try {
      storageStatePath = await ensureStorageState(browser, auth);
    } catch (e) {
      console.warn(
        `⚠️  Auth setup skipped (${e.message}). Proceeding unauthenticated.`
      );
    }
  }

  let totalViewports = 0;
  let successShots = 0;
  let anyAuthWall = false;
  let anyUnreachable = false;

  for (let i = 0; i < targetUrls.length; i++) {
    const url = targetUrls[i];
    const urlSlug = targetUrls.length > 1 ? `target-${i + 1}` : '';
    const targetDir = urlSlug ? path.join(outputDir, urlSlug) : outputDir;

    fs.mkdirSync(targetDir, { recursive: true });

    const configs = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', ...devices['iPhone 14'] },
    ];

    let targetHttpStatus = null;
    let targetFinalUrl = url;
    let targetAuthWall = false;

    for (const config of configs) {
      totalViewports++;
      let shotStatus = 'failed';
      let shotPath = '';
      let bytes = 0;
      let sha256 = '';

      const context = await browser.newContext({
        viewport: config.width
          ? { width: config.width, height: config.height }
          : config.viewport,
        userAgent: config.userAgent,
        ...(storageStatePath ? { storageState: storageStatePath } : {}),
      });
      const page = await context.newPage();

      try {
        const response = await page.goto(url, {
          waitUntil: 'load',
          timeout: 60000,
        });
        targetHttpStatus = response ? response.status() : 0;
        targetFinalUrl = page.url();

        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(2000);

        const rejectionReason = await detectAuthWall({
          requestedUrl: url,
          finalUrl: targetFinalUrl,
          page,
          httpStatus: targetHttpStatus,
        });

        if (rejectionReason === 'auth_wall') {
          shotStatus = 'rejected_auth_wall';
          targetAuthWall = true;
          anyAuthWall = true;
        } else if (rejectionReason === 'target_unreachable') {
          shotStatus = 'rejected_http_error';
          anyUnreachable = true;
        } else if (rejectionReason === 'rejected_blank') {
          shotStatus = 'rejected_blank';
        } else {
          // Capture
          const fileName = `${config.name}.png`;
          const filePath = path.join(targetDir, fileName);
          await page.screenshot({ path: filePath, fullPage: true });
          shotPath = filePath;
          shotStatus = 'captured';

          const stats = fs.statSync(filePath);
          bytes = stats.size;
          sha256 = hashFile(filePath);
          successShots++;
        }
      } catch (e) {
        console.error(`Failed to capture ${url} on ${config.name}:`, e.message);
      } finally {
        await context.close();
      }

      manifest.shots.push({
        viewport: config.name,
        width: config.width || config.viewport.width,
        height: config.height || config.viewport.height,
        path: shotStatus === 'captured' ? shotPath : undefined,
        bytes: shotStatus === 'captured' ? bytes : undefined,
        sha256: shotStatus === 'captured' ? sha256 : undefined,
        status: shotStatus,
      });
    }

    manifest.targets.push({
      requestedUrl: url,
      finalUrl: targetFinalUrl,
      httpStatus: targetHttpStatus,
      authWall: targetAuthWall,
    });
  }

  await browser.close();

  if (totalViewports > 0 && successShots === totalViewports) {
    manifest.status = 'ok';
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
    process.exit(0);
  } else if (successShots > 0) {
    manifest.status = 'partial';
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
    process.exit(10);
  } else {
    manifest.status = 'blocked';
    if (anyAuthWall) {
      manifest.reason = auth.mode !== 'none' ? 'auth_wall' : 'no_auth_supplied';
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      process.exit(20);
    } else if (anyUnreachable) {
      manifest.reason = 'target_unreachable';
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      process.exit(40);
    } else {
      manifest.status = 'failed';
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
      process.exit(1);
    }
  }
}

// Ensure this file runs when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
