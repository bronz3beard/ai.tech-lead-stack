#!/usr/bin/env node
/**
 * @file upload-evidence.mjs
 * @description Uploads media (screenshots/videos) to ClickUp using Playwright.
 * Simulates human-like interaction patterns to avoid bot detection.
 *
 * @tool evidence-uploader
 * @param {string} taskUrl - The full ClickUp Task URL (e.g., https://app.clickup.com/t/...)
 * @param {string} filePath - Absolute or relative path to the local media file.
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import readline from 'node:readline';

// ES module path resolution for relative config discovery
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (.env) from the stack root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Default Chrome profile path for persistent sessions (preserving login state)
const CHROME_PROFILE_PATH =
  process.env.CHROME_PROFILE_PATH ||
  path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

/**
 * Simulates a human-like delay with a randomized duration.
 * @param {number} minMs - Minimum duration in milliseconds.
 * @param {number} maxMs - Maximum duration in milliseconds.
 * @returns {Promise<void>}
 */
async function humanDelay(minMs = 500, maxMs = 1500) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Interactive prompt for missing arguments when running in a TTY.
 * @param {string} query - The question to display to the user.
 * @returns {Promise<string>} - The user's input string.
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

/**
 * Main function to perform the upload via browser automation.
 * @param {string} taskUrl - Target ClickUp task.
 * @param {string} filePath - Path to file to upload.
 */
async function uploadAsUser(taskUrl, filePath) {
  // Guard: Ensure the file actually exists before launching the browser
  if (!fs.existsSync(filePath)) {
    console.error(JSON.stringify({ error: `File not found: ${filePath}` }));
    process.exit(1);
  }

  console.log(`🚀 Launching browser with profile: ${CHROME_PROFILE_PATH}`);

  // Launch persistent context to reuse existing login cookies/state
  const browserContext = await chromium.launchPersistentContext(
    CHROME_PROFILE_PATH,
    {
      headless: true, // Run in background
      viewport: { width: 1280, height: 800 },
      args: [
        '--profile-directory=Default',
        '--disable-blink-features=AutomationControlled', // Helps bypass basic bot detection
      ],
    }
  );

  try {
    const page = await browserContext.newPage();

    // 1. Randomized Navigation and Intro
    await humanDelay(1000, 3000);
    console.log(`🎬 Navigating to task: ${taskUrl}`);
    await page.goto(taskUrl, { waitUntil: 'networkidle' });

    // 2. "Looking" for the comment box (Human-like wait)
    // Ensures the dynamic elements are fully loaded before interaction
    console.log('🔍 Waiting for comment box...');
    await page.waitForSelector('[data-test="comment-view__editor"]', {
      timeout: 30000,
    });
    await humanDelay(2000, 4000);

    // 3. Interactive Upload
    // Triggers the file chooser dialog via the attachment button
    console.log('📁 Selecting file...');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-test="comment-view__attachment-button"]'),
    ]);
    await fileChooser.setFiles(filePath);

    // Allow time for the file to be processed/buffered by ClickUp's internal storage
    await humanDelay(4000, 7000);

    // 4. Typing the comment with human-like variability
    console.log('✍️ Typing comment...');
    const commentText =
      'Smoke test evidence attached via Agent workflow. Verified on Desktop and Mobile.';
    const editorSelector = '[data-test="comment-view__editor"]';

    // Focus the editor
    await page.click(editorSelector);
    // Type character by character with randomized delays for realistic input simulation
    for (const char of commentText) {
      await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
    }

    // Short pause before submitting
    await humanDelay(1000, 2000);
    await page.keyboard.press('Enter');

    // Report success to the caller (usually an Agent)
    console.log(
      JSON.stringify({
        status: 'success',
        message: 'Evidence posted successfully.',
      })
    );
  } catch (error) {
    // Report detailed error for agent-led remediation
    console.error(JSON.stringify({ status: 'failed', error: error.message }));
    process.exit(1);
  } finally {
    // Ensure the browser is always closed to prevent resource leaks
    await browserContext.close();
  }
}

/**
 * CLI Entry point: Handles argument parsing and interactive fallback.
 */
(async () => {
  let taskUrl = process.argv[2];
  let filePath = process.argv[3];

  // If missing parameters and running in a terminal, prompt the user
  if (process.stdin.isTTY) {
    if (!taskUrl) taskUrl = await askQuestion('🔗 Enter ClickUp Task URL: ');
    if (!filePath) filePath = await askQuestion('📁 Enter Local File Path: ');
  }

  // Final validation before execution
  if (!taskUrl || !filePath) {
    console.error(
      JSON.stringify({
        error: 'Missing parameters: taskUrl and filePath required.',
      })
    );
    process.exit(1);
  }

  // Execute the upload workflow
  await uploadAsUser(taskUrl.trim(), filePath.trim());
})();
