import type { DetectionMethod } from '@/types/detectionMethod.mjs';
import type { DetectionResult } from '@/types/detectionResult.mjs';

import { basicEmptySpaceDetection } from './basicEmptySpace.mts';
import { edgeDetection } from './edgeDetection.mts';
import { metadataHeuristic } from './metadataHeuristic.mts';

export const hybridDetection: DetectionMethod = async (image, ctx): Promise<DetectionResult> => {
    const [basic, edge, meta] = await Promise.all([basicEmptySpaceDetection(image, ctx), edgeDetection(image, ctx), metadataHeuristic(image, ctx)]);

    const approxEqual = (a: number, b: number): boolean => Math.abs(a - b) <= 1;

    const rows = (approxEqual(edge.rows, basic.rows) && edge.rows) || (approxEqual(edge.rows, meta.rows) && edge.rows) || basic.rows || meta.rows;

    const cols = (approxEqual(edge.cols, basic.cols) && edge.cols) || (approxEqual(edge.cols, meta.cols) && edge.cols) || basic.cols || meta.cols;

    return {
        rows: Math.max(1, rows),
        cols: Math.max(1, cols),
    };
};
