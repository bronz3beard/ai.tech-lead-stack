import { chromium, devices } from 'playwright';
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

async function captureScreenshots(url, outputDir = '.github/evidence') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const isAlive = await checkUrl(url);
  if (!isAlive) {
    console.error(`❌ Error: URL ${url} is not reachable. Is your dev server running?`);
    return;
  }

  const browser = await chromium.launch();

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
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      // Wait a bit for any dynamic content/animations
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      const isAuthRedirect = (urlPath, finalUrlPath) => {
        const authKeywords = ['login', 'signin', 'auth', 'authorize', 'session'];
        return authKeywords.some(kw => !urlPath.toLowerCase().includes(kw) && finalUrlPath.toLowerCase().includes(kw));
      };

      if (isAuthRedirect(url, finalUrl)) {
        console.warn(`\n⚠️  WARNING: Requested ${url} but ended up at ${finalUrl}.`);
        console.warn(`   This usually means authentication is required.`);
        console.warn(`   👉 Please ensure your app is running AND you are logged in.\n`);
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

const targetUrls = process.argv.slice(2);
if (targetUrls.length === 0) {
  targetUrls.push('http://localhost:3000');
}

(async () => {
  for (const url of targetUrls) {
    await captureScreenshots(url).catch(console.error);
  }
})();
