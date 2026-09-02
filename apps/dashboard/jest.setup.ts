import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { TransformStream } from 'stream/web';

Object.assign(global, { TextDecoder, TextEncoder, TransformStream });

afterAll(async () => {
  try {
    const { disconnectPrisma } = await import('@zenithfoundry/tech-lead-stack/db');
    await disconnectPrisma();
  } catch {
    // ignore
  }
});
