import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack/apps/dashboard/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replaceMap = [
    [/@\/lib\/ai\//g, '@zenithfoundry/tech-lead-stack/ai/'],
    [/@\/lib\/skills\//g, '@zenithfoundry/tech-lead-stack/skills/'],
    [/@\/lib\/skills/g, '@zenithfoundry/tech-lead-stack/skills'],
    [/@\/lib\/ki\//g, '@zenithfoundry/tech-lead-stack/ki/'],
    [/@\/lib\/prisma/g, '@zenithfoundry/tech-lead-stack/db'],
    [/@\/lib\/crypto/g, '@zenithfoundry/tech-lead-stack/crypto'],
    [/@\/lib\/telemetry-service/g, '@zenithfoundry/tech-lead-stack/telemetry-service'],
    [/@\/lib\/trace-utils/g, '@zenithfoundry/tech-lead-stack/trace-utils'],
    [/@\/mcp-server\/telemetry/g, '@zenithfoundry/tech-lead-stack/mcp-server/telemetry']
  ];

  for (const [regex, replacement] of replaceMap) {
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
  }
});
