import type { DetectionMethod } from './detectionMethod.mts';
import type { DetectionMethodName } from './detectionMethodName.mts';
import { basicEmptySpaceDetection } from './methods/basicEmptySpace.mts';
import { edgeDetection } from './methods/edgeDetection.mts';
import { hybridDetection } from './methods/hybridDetection.mts';

export const detectionMethods: Record<DetectionMethodName, DetectionMethod> = {
    emptySpace: basicEmptySpaceDetection,
    edgeDetection,
    hybrid: hybridDetection,
};
