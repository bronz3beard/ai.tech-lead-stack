import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
  }
}

const baseDir = '/Users/bz3b/Desktop/repos/ai-dev/agent-toolbox/tech-lead-stack/packages/core';

replaceInFile(path.join(baseDir, 'src/index.ts'), [
  ["export * from './lib/ai/index';", "// no ai/index"]
]);
replaceInFile(path.join(baseDir, 'src/index.ts'), [
  ["export * from './lib/ki/index';", "// no ki/index"]
]);

replaceInFile(path.join(baseDir, 'src/lib/ai/model-resolver.ts'), [
  ["import { MODELS } from '../../app/api/chat/constants';", "import { MODELS } from './constants';"]
]);
replaceInFile(path.join(baseDir, 'src/lib/ai/reflexion/providers-env.ts'), [
  ["import { MODELS } from '../../../app/api/chat/constants';", "import { MODELS } from '../constants';"]
]);
replaceInFile(path.join(baseDir, 'src/lib/ai/reflexion/providers-user.ts'), [
  ["import { decrypt } from '@/lib/crypto';", "import { decrypt } from '../../crypto';"]
]);
replaceInFile(path.join(baseDir, 'src/mcp-server/handlers.ts'), [
  ["../lib/trace-utils.js", "../lib/trace-utils"],
  ["../lib/crypto.js", "../lib/crypto"],
  ["../lib/telemetry-service.js", "../lib/telemetry-service"]
]);
