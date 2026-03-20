import { chromium, devices } from 'playwright';
import path from 'path';
import fs from 'fs';

async function captureScreenshots(url, outputDir = '.github/evidence') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
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

      const fileName = `${url.split('/').pop() || 'page'}-${config.name}.png`;
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
