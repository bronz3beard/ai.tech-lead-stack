import { FileSystemService } from '../packages/core/src/lib/skills/fs-service.ts';
import { Handlers } from '../packages/core/src/mcp-server/handlers.ts';

async function testSkill(name) {
  const fsService = new FileSystemService(process.cwd());
  const telemetry = {
    withAnalytics: async (n, p, m, a, c, fn, o) => await fn(),
  };
  const handlers = new Handlers(fsService, telemetry, null, null);
  try {
    const response = await handlers.handleGetSkill('get_skill', {
      skillName: name,
    });
    const text = response.content[0].text;
    const injectedIdx = text.indexOf('## Injected policies');
    if (injectedIdx === -1) {
      console.log(`[${name}] FAILED: No injected policies section found.`);
    } else {
      console.log(
        `\n==================\n[${name}] INJECTED POLICIES:\n` +
          text.slice(injectedIdx, injectedIdx + 300) +
          '...\n=================='
      );
    }
  } catch (e) {
    console.error(`[${name}] ERROR:`, e);
  }
}

async function run() {
  await testSkill('mission-architect');
  await testSkill('pr-automator');
  await testSkill('pm-action-item-mapper');
  await testSkill('hr-ad-distributor');
}

run();
