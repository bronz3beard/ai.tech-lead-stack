import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { TransformStream } from 'stream/web';

Object.assign(global, { TextDecoder, TextEncoder, TransformStream });
