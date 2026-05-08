import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
import { TransformStream } from 'stream/web';
Object.assign(global, { TransformStream });
