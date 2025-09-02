import type { SlicePayload } from '@/types/slicePayloadTyped.mjs';

export function sanitizePayload(input: SlicePayload): SlicePayload {
    const cols = Math.max(1, Math.floor(input.cols || 1));
    const rows = Math.max(1, Math.floor(input.rows || 1));
    const format = ['png', 'jpeg'].includes(input.format) ? input.format : 'png';

    return {
        imageData: input.imageData,
        cols,
        rows,
        format,
    };
}
