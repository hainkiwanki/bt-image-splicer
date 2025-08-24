import type { DetectionMethod } from '@/utils/detection/detectionMethod.mjs';
import type { DetectionResult } from '@/utils/detection/detectionResult.mjs';

export const basicEmptySpaceDetection: DetectionMethod = async (imgData): Promise<DetectionResult> => {
    const { width, height, data } = imgData;

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
        rows: Math.max(1, Math.floor(rowStarts.length || 1)),
        cols: Math.max(1, Math.floor(colStarts.length || 1)),
    };
};
