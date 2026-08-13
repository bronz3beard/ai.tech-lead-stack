const fs = require('fs');

const content = fs.readFileSync('README.md', 'utf8');
const lines = content.split('\n');

const headings = new Set();
const tocLinks = [];

for (const line of lines) {
  if (line.startsWith('#')) {
    const text = line.replace(/^#+\s*/, '').toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
    headings.add(text);
  } else {
    const match = line.match(/\[([^\]]+)\]\(#([a-z0-9-]+)\)/);
    if (match) {
      tocLinks.push(match[2]);
    }
  }
}

let missing = false;
for (const link of tocLinks) {
  if (!headings.has(link)) {
    console.error(`TOC link not found: #${link}`);
    missing = true;
  }
}

if (!missing) {
  console.log('All TOC links resolve properly.');
} else {
  console.log('Available headings:', Array.from(headings).join(', '));
}
