import { TextDecoder, TextEncoder } from 'util';
import { TransformStream } from 'stream/web';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.TransformStream = TransformStream;
