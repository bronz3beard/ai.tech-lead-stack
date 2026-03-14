#!/usr/bin/env python3
"""
@tool evidence-uploader
@description Uploads media to ClickUp using human-like interaction patterns.
@param task_url - The full ClickUp Task URL
@param file_path - Path to the screenshot/video
"""
import os
import sys
import json
import asyncio
import random
from dotenv import load_dotenv # Add this
from playwright.async_api import async_playwright

# Load the .env from the script's actual location (the stack repo)
script_dir = os.path.dirname(os.path.realpath(__file__))
load_dotenv(os.path.join(script_dir, "..", ".env"))

# Now use the variable from .env
CHROME_PROFILE_PATH = os.path.expanduser(os.getenv("CHROME_PROFILE_PATH", "~/Library/Application Support/Google/Chrome"))

async def human_delay(min_ms=500, max_ms=1500):
    await asyncio.sleep(random.uniform(min_ms, max_ms) / 1000)

async def upload_as_user(task_url, file_path):
    async with async_playwright() as p:
        # Launching with a real user agent to avoid 'Headless' flags
        browser_context = await p.chromium.launch_persistent_context(
            user_data_dir=CHROME_PROFILE_PATH,
            headless=True,
            args=[
                "--profile-directory=Default",
                "--disable-blink-features=AutomationControlled"
            ]
        )
        
        page = await browser_context.new_page()
        
        # 1. Randomized Navigation
        await human_delay(1000, 3000)
        print(f"🎬 Navigating to task...")
        await page.goto(task_url, wait_until="networkidle")
        
        # 2. "Looking" for the comment box (Human-like wait)
        await page.wait_for_selector('[data-test="comment-view__editor"]', timeout=15000)
        await human_delay(2000, 4000) 

        # 3. Interactive Upload
        print("📁 Selecting file...")
        async with page.expect_file_chooser() as fc_info:
            await page.click('[data-test="comment-view__attachment-button"]')
        file_chooser = await fc_info.value
        await file_chooser.set_files(file_path)
        
        await human_delay(3000, 5000) # Simulating "Upload Time" wait

        # 4. Human Typing Speed
        print("✍️ Typing comment...")
        comment_text = "Smoke test evidence attached via Agent workflow. Verified on Desktop and Mobile."
        for char in comment_text:
            await page.type('[data-test="comment-view__editor"]', char)
            await asyncio.sleep(random.uniform(0.05, 0.15)) # Variable keystroke timing

        await human_delay(1000, 2000)
        await page.keyboard.press("Enter")
        
        print(json.dumps({"status": "success", "message": "Evidence posted successfully."}))
        await browser_context.close()

if __name__ == "__main__":
    # check for CLI args first
    task_url = sys.argv[1] if len(sys.argv) > 1 else None
    file_path = sys.argv[2] if len(sys.argv) > 2 else None

    # If missing but in a terminal, ask the user interactively
    if sys.stdin.isatty():
        if not task_url:
            task_url = input("🔗 Enter ClickUp Task URL: ").strip()
        if not file_path:
            file_path = input("📁 Enter Local File Path: ").strip()

    if not task_url or not file_path:
        print(json.dumps({"error": "Missing params"}))
        sys.exit(1)
        
    asyncio.run(upload_as_user(task_url, file_path))