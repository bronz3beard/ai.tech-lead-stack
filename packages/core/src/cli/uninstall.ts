/**
 * `tech-lead-stack uninstall`: undoes what `init` did. It previews by default;
 * `--apply` makes the changes. Only what init added is touched: npx server
 * entries, the gateway settings init set, and copied files nobody changed.
 * Your settings file (it may hold keys) and RTK (a separate tool) stay.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  MANIFEST_FILE,
  readManifest,
  removeOwned,
} from '../install/copies.mjs';
import { readEditors } from './editor-config.js';
import { removeServer, serverIn, setServer } from './editor-write.js';
import {
  type UninstallChange,
  describeUninstall,
  planUninstall,
  withoutToolbox,
} from './uninstall-plan.js';

const SETTINGS_FILE = path.join(os.homedir(), '.tech-lead-stack', '.env');

async function applyChange(change: UninstallChange): Promise<void> {
  const { target } = change;
  if (change.action === 'remove-server') {
    await removeServer({ target, name: change.name });
  } else if (change.action === 'detach-gateway') {
    const gateway = serverIn(target, change.gateway);
    await setServer({
      target,
      name: change.gateway,
      server: {
        ...gateway,
        env: withoutToolbox(gateway.env as Record<string, unknown>),
      },
    });
  }
}

export async function runUninstall({
  args,
}: {
  args: string[];
}): Promise<number> {
  const apply = args.includes('--apply');
  const changes = planUninstall(readEditors());
  const manifest = readManifest();
  const files = removeOwned({ manifest, apply: false });
  const toApply = changes.filter((c) => c.action !== 'leave-clone');

  console.log(apply ? 'Removing Tech-Lead Stack:\n' : 'This would remove:\n');
  for (const change of changes) console.log(`  • ${describeUninstall(change)}`);
  if (files.removed.length > 0) {
    console.log(
      `  • ${files.removed.length} copied commands, skills and workflows`
    );
  }
  for (const file of files.kept)
    console.log(`  · kept, you changed it: ${file}`);
  if (toApply.length === 0 && files.removed.length === 0) {
    console.log('  Nothing that init installed was found.');
  }
  console.log(
    `  · kept: your settings file ${SETTINGS_FILE} (delete it yourself if you no longer need the keys in it)`
  );
  console.log('  · kept: RTK, a separate tool other things may use');

  if (!apply) {
    console.log('\nNothing was changed. Run again with --apply to do it.');
    return 0;
  }

  let failed = 0;
  for (const change of toApply) {
    try {
      await applyChange(change);
    } catch (err) {
      failed += 1;
      console.log(`  ✗ ${change.target.label}: ${(err as Error).message}`);
    }
  }
  removeOwned({ manifest, apply: true });
  fs.rmSync(MANIFEST_FILE, { force: true });
  console.log(
    failed > 0
      ? `\nDone, with ${failed} problem(s) above.`
      : '\nDone. Restart your editors to finish.'
  );
  return failed > 0 ? 1 : 0;
}
