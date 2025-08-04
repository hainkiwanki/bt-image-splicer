import type { DetectionMethod } from '@/types/detectionMethod.mjs';
import type { DetectionResult } from '@/types/detectionResult.mjs';
import type { HTMLImageElementWithData } from '@/types/htmlImageElementWithData.mjs';

export const metadataHeuristic: DetectionMethod = async (image: HTMLImageElementWithData, _): Promise<DetectionResult> => {
    const name = image.dataset.filename?.toLowerCase() || '';
    const match = name.match(/(\d+)x(\d+)/);
    if (match) {
        const cols = parseInt(match[1]);
        const rows = parseInt(match[2]);
        if (!isNaN(cols) && !isNaN(rows)) {
            return { cols, rows };
        }
    }
    return { cols: 1, rows: 1 };
};
