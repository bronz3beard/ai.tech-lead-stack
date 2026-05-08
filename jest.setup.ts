import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
import { TransformStream } from 'stream/web'; global.TransformStream = TransformStream;
