import type { DetectionMethod } from '@/types/detectionMethod.mjs';
import type { DetectionMethodName } from '@/types/detectionMethodName.mjs';

import { basicEmptySpaceDetection } from './basicEmptySpace.mts';
import { edgeDetection } from './edgeDetection.mts';
import { hybridDetection } from './hybridDetection.mts';
import { metadataHeuristic } from './metadataHeuristic.mts';

export const detectionMethods: Record<DetectionMethodName, DetectionMethod> = {
    emptySpace: basicEmptySpaceDetection,
    edgeDetection,
    metadataHeuristic,
    hybrid: hybridDetection,
};
