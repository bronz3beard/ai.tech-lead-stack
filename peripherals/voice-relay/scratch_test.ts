import { execFile, ExecFileOptions } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);

const opts = {
  timeout: 1000
};

pexec('ls', ['-la'], Object.assign(opts, { detached: true }));
