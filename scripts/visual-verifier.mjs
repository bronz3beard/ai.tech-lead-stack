import { chromium, devices } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

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

async function captureScreenshots(url, options = {}) {
  const { outputDir = '.github/evidence', skipCheck = false } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!skipCheck) {
    const isAlive = await checkUrl(url);
    if (!isAlive) {
      console.warn(`⚠️  Warning: URL ${url} might not be reachable. Proceeding anyway with Playwright.`);
    }
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.warn(`\n⚠️  Playwright browser not found. Attempting to install automatically...`);
    try {
      execSync('npx playwright install chromium', { stdio: 'inherit' });
      browser = await chromium.launch({ headless: true });
    } catch (installError) {
      console.error(`❌ Error: Could not launch or install Playwright: ${installError.message}`);
      console.error(`👉 Potential Fix: 'npm run setup-browsers' manually on your host machine.`);
      return;
    }
  }

  const configs = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'mobile', ...devices['iPhone 14'] }
  ];

  console.log(`📸 Starting screenshot capture for: ${url}`);

  for (const config of configs) {
    const context = await browser.newContext({
      viewport: config.width ? { width: config.width, height: config.height } : config.viewport,
      userAgent: config.userAgent
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      // Wait for network to be idle
      await page.waitForLoadState('networkidle').catch(() => console.log('  Wait for networkidle timed out, proceeding anyway...'));
      
      // Wait a bit for animations
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      const isAuthRedirect = (urlPath, finalUrlPath) => {
        const authKeywords = ['login', 'signin', 'auth', 'authorize', 'session'];
        return authKeywords.some(kw => !urlPath.toLowerCase().includes(kw) && finalUrlPath.toLowerCase().includes(kw));
      };

      if (isAuthRedirect(url, finalUrl)) {
        console.warn(`\n⚠️  WARNING: Requested ${url} but ended up at ${finalUrl}. Auth Required.`);
      }

      // Sanitize URL for filename
      const urlPath = url.replace(/^https?:\/\//, '').replace(/[\/:]/g, '-');
      const fileName = `${urlPath || 'index'}-${config.name}.png`;
      const filePath = path.join(outputDir, fileName);

      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`✅ Captured ${config.name} screenshot: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to capture ${config.name} screenshot: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log('🏁 Screenshot capture complete.');
}

// Parse args
const args = process.argv.slice(2);
const skipCheck = args.includes('--no-check');
const targetUrls = args.filter(a => !a.startsWith('--'));

if (targetUrls.length === 0) {
  targetUrls.push('http://localhost:3000');
}

(async () => {
  for (const url of targetUrls) {
    await captureScreenshots(url, { skipCheck }).catch(console.error);
  }
})();

