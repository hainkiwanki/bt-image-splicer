import type { DetectionResult } from './detectionResult.mts';

export interface DetectionData {
    data: ImageDataArray;
    width: number;
    height: number;
}

export type DetectionMethod = (imgData: DetectionData) => Promise<DetectionResult>;
