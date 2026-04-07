#!/usr/bin/env node
/**
 * @file upload-to-github.mjs
 * @description Uploads images (screenshots) to GitHub's internal asset storage.
 * Works by simulating a file upload in a new issue/comment textarea and extracting 
 * the generated 'github.com/.../assets/...' URL.
 * 
 * @tool github-uploader
 * @param {string} repoUrl - The target repository URL (e.g., https://github.com/user/repo)
 * @param {string} filePath - Path to the local screenshot file.
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

// ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the stack root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Use existing Chrome profile to leverage authenticated GitHub sessions
const CHROME_PROFILE_PATH = process.env.CHROME_PROFILE_PATH || 
  path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

/**
 * Simulates a human-like delay with randomized duration.
 * @param {number} minMs - Minimum delay in ms.
 * @param {number} maxMs - Maximum delay in ms.
 * @returns {Promise<void>}
 */
async function humanDelay(minMs = 500, maxMs = 1500) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (maxMs - minMs) + minMs));
}

/**
 * Main function to upload a file to GitHub assets.
 * @param {string} repoUrl - Target repository.
 * @param {string} filePath - File to upload.
 */
async function uploadToGitHub(repoUrl, filePath) {
  // Guard: Ensure file exists locally
  if (!fs.existsSync(filePath)) {
    console.error(JSON.stringify({ error: `File not found: ${filePath}` }));
    process.exit(1);
  }

  // Target the 'new issue' page as a temporary scratchpad for file uploading
  const cleanRepoUrl = repoUrl.replace(/\/$/, '');
  const uploadPage = `${cleanRepoUrl}/issues/new`; 

  console.log(`🚀 Launching browser to upload ${path.basename(filePath)}...`);

  // Launch persistent context to preserve login state
  const browserContext = await chromium.launchPersistentContext(CHROME_PROFILE_PATH, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [
      '--profile-directory=Default',
      '--disable-blink-features=AutomationControlled'
    ],
  });

  try {
    const page = await browserContext.newPage();
    
    console.log(`🎬 Navigating to: ${uploadPage}`);
    await page.goto(uploadPage, { waitUntil: 'networkidle' });

    // Step 1: Detect if we are logged in by searching for the issue body textarea
    const textareaSelector = 'textarea[name="issue[body]"], textarea[name="comment[body]"], #issue_body';
    try {
      await page.waitForSelector(textareaSelector, { timeout: 15000 });
    } catch {
      console.error(JSON.stringify({ 
        status: 'failed', 
        error: 'Could not find GitHub comment box. Are you logged in?',
        currentUrl: page.url()
      }));
      process.exit(1);
    }

    // Step 2: Trigger the file upload
    console.log('📁 Selecting file...');
    const textarea = await page.locator(textareaSelector);
    
    // Focus the textarea to ensure the upload listener is active
    await textarea.click();
    
    // Select the hidden file input that GitHub uses for drag-and-drop/browsing
    const fileInputSelector = 'input[type="file"][accept*="image"]';
    await page.setInputFiles(fileInputSelector, filePath);

    // Step 3: Wait for GitHub to process the file and generate a markdown asset URL
    console.log('⏳ Waiting for GitHub storage URL...');
    
    let uploadedUrl = null;
    const startTime = Date.now();
    // Poll the textarea value until the asset markdown pattern appears
    while (Date.now() - startTime < 30000) {
      const content = await textarea.inputValue();
      const match = content.match(/!\[.*?\]\((https:\/\/github\.com\/.*?\/assets\/.*?)\)/);
      if (match && match[1]) {
        uploadedUrl = match[1];
        break;
      }
      await humanDelay(1000, 2000);
    }

    if (!uploadedUrl) {
      throw new Error('Upload timed out or URL not found in textarea.');
    }

    // Report success for Agent consumption
    console.log(JSON.stringify({ 
      status: 'success', 
      url: uploadedUrl,
      filename: path.basename(filePath)
    }));

  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', error: error.message }));
    process.exit(1);
  } finally {
    // Cleanup: Close the browser session
    await browserContext.close();
  }
}

// --- CLI Execution ---
const repoUrl = process.argv[2];
const filePath = process.argv[3];

// Basic CLI usage verification
if (!repoUrl || !filePath) {
  console.error(JSON.stringify({ error: 'Usage: node upload-to-github.mjs <REPO_URL> <FILE_PATH>' }));
  process.exit(1);
}

// Initiate the upload process
uploadToGitHub(repoUrl.trim(), filePath.trim());
