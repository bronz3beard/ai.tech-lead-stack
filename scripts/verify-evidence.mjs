#!/usr/bin/env node
/**
 * @file verify-evidence.mjs
 * @description Verifies SHA-pinned image URLs anonymously, mimicking Camo's behaviour.
 *              Falls back to local file path (Path B) if images are unreachable.
 */

import fs from 'fs';
import https from 'https';
import http from 'http';

const originalLog = console.log;
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchAnonymous(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    // We intentionally do NOT include an Authorization header
    const options = {
      method: 'HEAD',
      headers: {
        'User-Agent': 'visual-verifier/1.0 (anonymous)',
      },
    };

    const req = protocol.request(url, options, (res) => {
      // Fallback to GET with Range if HEAD is rejected
      if (res.statusCode === 405) {
        options.method = 'GET';
        options.headers['Range'] = 'bytes=0-1024';
        const getReq = protocol.request(url, options, (getRes) => {
          resolve({
            status: getRes.statusCode,
            contentType: getRes.headers['content-type'],
          });
        });
        getReq.on('error', reject);
        getReq.end();
      } else {
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'],
        });
      }
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyWithBackoff(url) {
  const delays = [1000, 2000, 4000, 8000, 16000];

  for (let i = 0; i < delays.length; i++) {
    try {
      const response = await fetchAnonymous(url);
      if (
        response.status >= 200 &&
        response.status < 300 &&
        response.contentType?.startsWith('image/')
      ) {
        console.log(`✅ Verified ${url}`);
        return true;
      }
    } catch (err) {
      console.warn(`Attempt ${i + 1} failed for ${url}: ${err.message}`);
    }

    if (i < delays.length - 1) {
      console.log(`Waiting ${delays[i]}ms before retrying...`);
      await delay(delays[i]);
    }
  }
  return false;
}

async function main() {
  const publishPayloadPath = process.argv[2];
  if (!publishPayloadPath || !fs.existsSync(publishPayloadPath)) {
    console.error('Missing or invalid publish payload path argument.');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(publishPayloadPath, 'utf8'));

  if (payload.path === 'B') {
    // Pass-through
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(0);
  }

  console.log('Verifying embedded image URLs...');
  const verifiedUrls = [];
  const failedUrls = [];

  for (const item of payload.urls) {
    const isVerified = await verifyWithBackoff(item.url);
    if (isVerified) {
      verifiedUrls.push(item);
    } else {
      console.error(`❌ Failed to verify ${item.url}`);
      failedUrls.push(item);
    }
  }

  if (verifiedUrls.length === 0) {
    console.error(
      'No viewports could be verified. Falling back to Path B entirely.'
    );
    process.stdout.write(
      JSON.stringify(
        {
          path: 'B',
          reason: 'verification_failed',
          // We assume the caller will reconstruct local fallback logic from the original manifest
        },
        null,
        2
      ) + '\n'
    );
    process.exit(0);
  }

  process.stdout.write(
    JSON.stringify(
      {
        path: 'A',
        commitSha: payload.commitSha,
        urls: verifiedUrls,
        failedUrls,
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  console.error('Unexpected error during verification:', err.message);
  process.stdout.write(
    JSON.stringify({ path: 'B', reason: 'verification_error' }, null, 2) + '\n'
  );
});
