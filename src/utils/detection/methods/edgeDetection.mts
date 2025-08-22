import type { DetectionMethod } from '@/utils/detection/detectionMethod.mjs';
import type { DetectionResult } from '@/utils/detection/detectionResult.mjs';

export const edgeDetection: DetectionMethod = async (imgData): Promise<DetectionResult> => {
    const { width, height, data } = imgData;

    const grayscale = new Uint8ClampedArray(width * height);
    for (let i = 0; i < grayscale.length; i++) {
        const idx = i * 4;
        grayscale[i] = 0.3 * data[idx] + 0.59 * data[idx + 1] + 0.11 * data[idx + 2];
    }

    const horizontalEdges = new Uint8Array(height);
    const verticalEdges = new Uint8Array(width);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const gx = grayscale[i - 1] - grayscale[i + 1];
            const gy = grayscale[i - width] - grayscale[i + width];
            const magnitude = Math.sqrt(gx * gx + gy * gy);

            if (magnitude > 50) {
                horizontalEdges[y]++;
                verticalEdges[x]++;
            }
        }
    }

    const rows = horizontalEdges.filter((v) => v > width * 0.05).length;
    const cols = verticalEdges.filter((v) => v > height * 0.05).length;

    return {
        rows: Math.max(1, rows),
        cols: Math.max(1, cols),
    };
};
