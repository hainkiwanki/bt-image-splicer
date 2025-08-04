import type { DetectionMethod } from '@/types/detectionMethod.mjs';
import type { DetectionResult } from '@/types/detectionResult.mjs';

import { basicEmptySpaceDetection } from './basicEmptySpace.mts';
import { edgeDetection } from './edgeDetection.mts';

export const hybridDetection: DetectionMethod = async (imgData): Promise<DetectionResult> => {
    const [basic, edge] = await Promise.all([basicEmptySpaceDetection(imgData), edgeDetection(imgData)]);

    const approxEqual = (a: number, b: number): boolean => Math.abs(a - b) <= 1;

    const rows = (approxEqual(edge.rows, basic.rows) && edge.rows) || basic.rows;

    const cols = (approxEqual(edge.cols, basic.cols) && edge.cols) || basic.cols;

    return {
        rows: Math.max(1, rows),
        cols: Math.max(1, cols),
    };
};
