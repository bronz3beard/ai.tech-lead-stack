#!/usr/bin/env node
/**
 * @file clickup-sprint-fetcher.mjs
 * @description Scrapes task data from a ClickUp Sprint or List view using Playwright.
 *
 * @tool clickup-sprint-fetcher
 * @param {string} sprintUrl - The full ClickUp Sprint/List URL.
 */

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (.env) from the stack root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CHROME_PROFILE_PATH =
  process.env.CHROME_PROFILE_PATH ||
  path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

async function fetchSprintData(sprintUrl) {
  console.log(`🚀 Launching browser with profile: ${CHROME_PROFILE_PATH}`);

  const browserContext = await chromium.launchPersistentContext(
    CHROME_PROFILE_PATH,
    {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      args: [
        '--profile-directory=Default',
        '--disable-blink-features=AutomationControlled',
      ],
    }
  );

  try {
    const page = await browserContext.newPage();
    console.log(`🎬 Navigating to: ${sprintUrl}`);

    // Set a longer timeout for ClickUp's heavy UI
    await page.goto(sprintUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for the task list to appear. ClickUp uses 'cu-task-row' or similar.
    // We'll wait for a generic container if possible, or a delay.
    console.log('🔍 Waiting for task list...');
    await page.waitForTimeout(5000); // ClickUp is notoriously slow to hydrate

    // Extracting data
    const tasks = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll('.cu-task-row, [data-test="task-row"]')
      );

      return rows.map((row) => {
        const nameEl = row.querySelector(
          '.cu-task-row-main__link_title, [data-test="task-row-name"]'
        );
        const statusEl = row.querySelector(
          '.cu-task-row-status__label, [data-test="task-row-status"]'
        );
        const assigneeEls = Array.from(
          row.querySelectorAll(
            '.cu-user-settings-menu__avatar, [data-test="task-row-assignee"]'
          )
        );

        // Custom columns (ClickUp often puts these in data-test or specific classes)
        // We'll try to find any element that looks like a version (vX.X.X) or common environment names
        const allText = row.innerText;
        const versionMatch = allText.match(/v\d+\.\d+\.\d+/);
        const envMatch = allText.match(/(Staging|Development|Production|Dev)/i);

        // Try to find the group/status from the parent if not in the row
        let groupName = 'Unknown';
        const groupEl = row.closest('.cu-task-group');
        if (groupEl) {
          const groupHeader = groupEl.querySelector(
            '.cu-task-group__header-title'
          );
          if (groupHeader) groupName = groupHeader.innerText.trim();
        }

        return {
          name: nameEl?.innerText?.trim() || 'Unknown Task',
          status: statusEl?.innerText?.trim() || groupName || 'Unknown Status',
          assignees: assigneeEls
            .map((el) => el.getAttribute('title') || el.innerText || 'Unknown')
            .filter(Boolean),
          targetVersion: versionMatch ? versionMatch[0] : null,
          environment: envMatch ? envMatch[0] : null,
          rawText: allText.replace(/\n/g, ' ').substring(0, 200), // Helper for LLM
        };
      });
    });

    console.log(JSON.stringify({ status: 'success', data: tasks }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', error: error.message }));
    process.exit(1);
  } finally {
    await browserContext.close();
  }
}

const url = process.argv[2];
if (!url) {
  console.error(JSON.stringify({ error: 'Missing sprintUrl parameter' }));
  process.exit(1);
}

fetchSprintData(url);
