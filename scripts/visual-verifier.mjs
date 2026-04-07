/**
 * @file visual-verifier.mjs
 * @description Captures multi-viewport screenshots of target URLs using Playwright.
 * Designed for visual regression testing and evidence gathering in AI-led workflows.
 * Supports automatic Playwright installation and auth-redirect detection.
 *
 * @tool visual-verifier
 * @usage node scripts/visual-verifier.mjs [url1 url2 ...] [--no-check]
 * @params
 *   urls - List of URLs to screenshot (defaults to http://localhost:3000)
 *   --no-check - Skips the initial HTTP availability check
 */

import { chromium, devices } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

/**
 * Performs a lightweight HTTP(S) GET request to verify URL availability.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>} - True if status is 2xx or 3xx.
 */
async function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      // Consider 2xx and 3xx as "alive" for the sake of screenshotting
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * Main logic for capturing screenshots across multiple device configurations.
 * @param {string} url - The target URL to screenshot.
 * @param {Object} options - Configuration options.
 * @param {string} options.outputDir - Directory to save screenshots.
 * @param {boolean} options.skipCheck - Whether to skip the pre-flight alive check.
 */
async function captureScreenshots(url, options = {}) {
  const { outputDir = '.github/evidence', skipCheck = false } = options;

  // Ensure the output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Pre-flight check: Warn if the URL seems down
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
    // Attempt to launch the system-installed Chromium
    browser = await chromium.launch({ headless: true });
  } catch {
    // Auto-recovery: If Playwright binaries are missing, attempt installation
    console.warn(
      `\n⚠️  Playwright browser not found. Attempting to install automatically...`
    );
    try {
      execSync('npx playwright install chromium', { stdio: 'inherit' });
      browser = await chromium.launch({ headless: true });
    } catch (installError) {
      console.error(
        `❌ Error: Could not launch or install Playwright: ${installError.message}`
      );
      console.error(
        `👉 Potential Fix: 'npm run setup-browsers' manually on your host machine.`
      );
      return;
    }
  }

  // Define viewport configurations for responsive testing
  const configs = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', ...devices['iPhone 14'] },
  ];

  console.log(`📸 Starting screenshot capture for: ${url}`);

  for (const config of configs) {
    // Create an isolated browser context for each viewport
    const context = await browser.newContext({
      viewport: config.width
        ? { width: config.width, height: config.height }
        : config.viewport,
      userAgent: config.userAgent,
    });
    const page = await context.newPage();

    try {
      // Navigate to the target page and wait for initial load
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });

      // Wait for network activity to settle (best effort)
      await page
        .waitForLoadState('networkidle')
        .catch(() =>
          console.log('  Wait for networkidle timed out, proceeding anyway...')
        );

      // Allow additional time for dynamic animations or client-side hydration to finish
      await page.waitForTimeout(2000);

      // Detection: Check if the final URL differs significantly from the target (Auth wall)
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
        console.warn(
          `\n⚠️  WARNING: Requested ${url} but ended up at ${finalUrl}. Auth Wall likely detected.`
        );
      }

      // Generate a descriptive filename based on the URL and viewport type
      const urlPath = url.replace(/^https?:\/\//, '').replace(/[\/:]/g, '-');
      const fileName = `${urlPath || 'index'}-${config.name}.png`;
      const filePath = path.join(outputDir, fileName);

      // Capture a full-page screenshot
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`✅ Captured ${config.name} screenshot: ${filePath}`);
    } catch (error) {
      console.error(
        `❌ Failed to capture ${config.name} screenshot: ${error.message}`
      );
    } finally {
      // Always cleanup the context
      await context.close();
    }
  }

  // Final cleanup
  await browser.close();
  console.log('🏁 Screenshot capture complete.');
}

// -----------------------------------------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
const skipCheck = args.includes('--no-check');
const targetUrls = args.filter((a) => !a.startsWith('--'));

// Default to localhost if no URLs are provided
if (targetUrls.length === 0) {
  targetUrls.push('http://localhost:3000');
}

// Sequential execution for each target URL
(async () => {
  for (const url of targetUrls) {
    await captureScreenshots(url, { skipCheck }).catch(console.error);
  }
})();
