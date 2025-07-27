<template>
    <v-app>
        <v-main>
            <v-container>
                <h1 class="text-h4 mb-4">Image Splicer</h1>

                <v-file-input label="Upload Image" accept="image/*" chips multiple @change="handleFileUpload" />

                <v-row class="mt-4">
                    <v-col cols="6" md="3">
                        <v-text-field label="Columns" type="number" v-model.number="cols" />
                    </v-col>
                    <v-col cols="6" md="3">
                        <v-text-field label="Rows" type="number" v-model.number="rows" />
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-btn :disabled="!canvasRef?.width || !canvasRef?.height" @click="sliceImage" color="primary"> Export Slices </v-btn>
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-select v-model="exportFormat" :items="['png', 'jpeg']" label="Export Format" />
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-text-field v-model="filenamePrefix" label="Filename Prefix" />
                    </v-col>
                </v-row>

                <v-progress-linear v-if="loading" :model-value="progressValue" :value="progressValue" :buffer-value="progressBufferValue" color="primary" height="6" class="mb-4" />
                <div class="canvas-wrapper">
                    <canvas ref="canvasRef" class="preview-canvas" />
                    <div
                        v-for="(tile, index) in skippedTilesPositions"
                        :key="index"
                        class="skipped-overlay"
                        :style="{
                            left: `${tile.x}px`,
                            top: `${tile.y}px`,
                            width: `${tile.w}px`,
                            height: `${tile.h}px`,
                        }"
                    >
                        <v-tooltip activator="parent" location="top"> Skipped tile: empty </v-tooltip>
                    </div>
                </div>
            </v-container>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import JSZip from 'jszip';

import SlicerWorker from '@/worker/slicer.worker?worker';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const image = ref<HTMLImageElement | null>(null);
const cols = ref(3);
const rows = ref(3);
const exportFormat = ref<'png' | 'jpeg'>('png');
const loading = ref(false);
const skippedTiles = ref<number[]>([]);
const skippedTilesPositions = ref<{ x: number; y: number; h: number; w: number }[]>([]);
const progressValue = ref(0);
const progressBufferValue = ref(0);
const filenamePrefix = ref('slice');

async function handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
        return;
    }
    const file = files[0];
    const img = new Image();

    img.src = URL.createObjectURL(file);

    await new Promise<void>((resolve) => {
        img.onload = () => resolve();
    });
    image.value = img;
    drawGrid();
}

watch([cols, rows], drawGrid);

function drawGrid(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image.value) return;

    canvas.width = image.value.width;
    canvas.height = image.value.height;
    ctx.drawImage(image.value, 0, 0);

    const w = canvas.width / cols.value;
    const h = canvas.height / rows.value;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    for (let x = 1; x < cols.value; x++) {
        ctx.beginPath();
        ctx.moveTo(x * w, 0);
        ctx.lineTo(x * w, canvas.height);
        ctx.stroke();
    }

    for (let y = 1; y < rows.value; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * h);
        ctx.lineTo(canvas.width, y * h);
        ctx.stroke();
    }
    skippedTilesPositions.value = [];
    skippedTiles.value.forEach((index) => {
        const col = index % cols.value;
        const row = Math.floor(index / cols.value);
        const x = col * w;
        const y = row * h;

        skippedTilesPositions.value.push({
            x,
            y,
            h,
            w,
        });
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(x, y, w, h);
    });
}

async function sliceImage() {
    if (!canvasRef.value || !image.value) return;
    loading.value = true;
    const offscreen = document.createElement('canvas');
    offscreen.width = image.value.width;
    offscreen.height = image.value.height;
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(image.value, 0, 0);
    const fullImageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);

    const worker = new SlicerWorker();
    const payload = {
        imageData: fullImageData,
        cols: cols.value,
        rows: rows.value,
        format: exportFormat.value,
    };

    worker.postMessage(payload);

    worker.onmessage = async (e: MessageEvent<any>) => {
        await nextTick();

        if (e.data.type === 'progress') {
            progressValue.value = (e.data.done / e.data.total) * 100;
            progressBufferValue.value = (e.data.done / e.data.total) * 100 + 100 / e.data.total;
            console.error(progressValue.value, progressBufferValue.value);
        }

        if (e.data.type === 'done') {
            skippedTiles.value = e.data.emptyIndices;
            const zip = new JSZip();
            const { slices, emptyIndices } = e.data;
            let sliceIndex = 0;

            for (let i = 0; i < cols.value * rows.value; i++) {
                if (emptyIndices.includes(i)) continue;
                zip.file(`${filenamePrefix.value}-${i + 1}.${exportFormat.value}`, slices[sliceIndex]);
                zip.file(`slice-${i + 1}.${exportFormat.value}`, slices[sliceIndex]);
                sliceIndex++;
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = 'slices.zip';
            link.click();
            loading.value = false;
            drawGrid();
        }
    };
}
</script>

<style scoped lang="scss">
.canvas-wrapper {
    position: relative;
    max-width: 100%;
    max-height: 80vh;
    margin-top: 2rem;
    border: 1px solid #ddd;
    overflow: auto;
}

.preview-canvas {
    display: block;
    height: auto;
    max-width: 100%;
}

.skipped-overlay {
    position: absolute;
    border: 1px solid orange;
    background: rgb(255 255 0 / 30%);
    pointer-events: auto;
}
</style>
