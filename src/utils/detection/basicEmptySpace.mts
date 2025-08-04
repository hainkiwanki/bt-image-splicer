import type { DetectionMethod } from '@/types/detectionMethod.mjs';
import type { DetectionResult } from '@/types/detectionResult.mjs';

export const basicEmptySpaceDetection: DetectionMethod = async (image, ctx): Promise<DetectionResult> => {
    const { width, height } = image;
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    const isRowEmpty = (y: number): boolean => {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] > 10) return false;
        }
        return true;
    };

    const isColEmpty = (x: number): boolean => {
        for (let y = 0; y < height; y++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] > 10) return false;
        }
        return true;
    };

    const rowStarts: number[] = [];
    let prevRowEmpty = true;
    for (let y = 0; y < height; y++) {
        const empty = isRowEmpty(y);
        if (prevRowEmpty && !empty) rowStarts.push(y);
        prevRowEmpty = empty;
    }

    const colStarts: number[] = [];
    let prevColEmpty = true;
    for (let x = 0; x < width; x++) {
        const empty = isColEmpty(x);
        if (prevColEmpty && !empty) colStarts.push(x);
        prevColEmpty = empty;
    }

    return {
        rows: rowStarts.length || 1,
        cols: colStarts.length || 1,
    };
};
