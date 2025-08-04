import type { DetectionResult } from './detectionResult.mts';
import type { HTMLImageElementWithData } from './htmlImageElementWithData.mts';

export type DetectionMethod = (image: HTMLImageElementWithData, ctx: CanvasRenderingContext2D) => Promise<DetectionResult>;
