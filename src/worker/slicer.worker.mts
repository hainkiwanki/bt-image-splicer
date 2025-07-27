export interface SliceRequest {
    imageData: ImageData;
    cols: number;
    rows: number;
    format: 'png' | 'jpeg';
}

self.onmessage = async (e: MessageEvent<SliceRequest>) => {
    const { imageData, cols, rows, format } = e.data;
    const { width, height } = imageData;

    const area = {
        x: 0,
        y: 0,
        w: width,
        h: height,
    };
    const tileW = area.w / cols;
    const tileH = area.h / rows;

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    const results: Blob[] = [];
    const emptyIndices: number[] = [];
    const total = cols * rows;
    let count = 0;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const sliceCanvas = new OffscreenCanvas(tileW, tileH);
            const sliceCtx = sliceCanvas.getContext('2d')!;

            sliceCtx.drawImage(offscreen, area.x + col * tileW, area.y + row * tileH, tileW, tileH, 0, 0, tileW, tileH);

            const pixels = sliceCtx.getImageData(0, 0, tileW, tileH).data;
            if (isEmpty(pixels)) {
                emptyIndices.push(count);
                count++;
                self.postMessage({
                    type: 'progress',
                    done: count,
                    total,
                });
                // await new Promise((r) => setTimeout(r, 1000));

                continue;
            }

            const blob = await sliceCanvas.convertToBlob({
                type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
            });

            results.push(blob);

            count++;
            self.postMessage({
                type: 'progress',
                done: count,
                total,
            });
            // await new Promise((r) => setTimeout(r, 1000));
        }
    }

    self.postMessage({
        type: 'done',
        slices: results,
        emptyIndices,
    });
};

function isEmpty(data: Uint8ClampedArray): boolean {
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha !== 0) return false;
    }
    return true;
}
