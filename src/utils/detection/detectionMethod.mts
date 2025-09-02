import type { DetectionResult } from './detectionResult.mts';

export interface DetectionData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

export type DetectionMethod = (imgData: DetectionData) => Promise<DetectionResult>;
