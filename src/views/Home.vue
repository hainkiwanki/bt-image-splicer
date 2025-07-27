<template>
    <v-app>
        <v-main>
            <v-container>
                <h1 class="text-h4 mb-4">Image Splicer</h1>

                <v-file-input label="Upload Image" accept="image/*" chips @change="handleFileUpload" counter v-model="refFiles">
                    <template v-slot:selection="{ fileNames }">
                        <template v-for="(fileName, index) in fileNames" :key="fileName">
                            <v-chip v-if="index < 2" class="me-2" color="primary" size="small" label>
                                {{ fileName }}
                            </v-chip>

                            <span v-else-if="index === 2" class="text-overline text-grey-darken-3 mx-2"> +{{ refFiles.length - 2 }} File(s) </span>
                        </template>
                    </template>
                </v-file-input>

                <v-row dense class="mb-2" align="center">
                    <v-col cols="6" md="3">
                        <v-text-field label="Columns" type="number" v-model.number="cols" />
                    </v-col>
                    <v-col cols="6" md="3">
                        <v-text-field label="Rows" type="number" v-model.number="rows" />
                    </v-col>
                    <v-col cols="12" md="3">
                        <v-select v-model="exportFormat" :items="['png', 'jpeg']" label="Export Format" />
                    </v-col>
                    <v-col cols="12" md="3">
                        <v-text-field label="Filename Prefix" v-model="filenamePrefix" />
                    </v-col>
                </v-row>

                <v-row dense class="mb-4">
                    <v-col cols="12" md="6">
                        <v-btn block color="primary" :disabled="!canvasRef" @click="sliceImage"> Export Slices </v-btn>
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-btn block color="secondary" @click="resetView()"> Reset </v-btn>
                    </v-col>
                </v-row>

                <v-progress-linear v-if="loading" :model-value="progressValue" :value="progressValue" :buffer-value="progressBufferValue" color="primary" height="6" class="mb-4" />

                <div class="canvas-wrapper">
                    <canvas ref="canvasRef" class="preview-canvas" @wheel.passive="onWheel" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp" />
                    <div
                        v-if="!isPanning"
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
const cols = ref<number>(parseInt(localStorage.getItem('splicer-cols') || '3'));
const rows = ref<number>(parseInt(localStorage.getItem('splicer-rows') || '3'));
const exportFormat = ref<'png' | 'jpeg'>(localStorage.getItem('splicer-format') === 'jpeg' ? 'jpeg' : 'png');
const loading = ref(false);
const skippedTiles = ref<number[]>([]);
const skippedTilesPositions = ref<{ x: number; y: number; h: number; w: number }[]>([]);
const progressValue = ref(0);
const progressBufferValue = ref(0);
const filenamePrefix = ref<string>(localStorage.getItem('splicer-prefix') || 'slice-');
const refFiles = ref([]);

const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
let isPanning = ref(false);
let panStart = { x: 0, y: 0 };

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
    skippedTilesPositions.value = [];
    skippedTiles.value = [];
    drawGrid();
}

watch([cols, rows], drawGrid);
watch(cols, (val) => localStorage.setItem('splicer-cols', val.toString()));
watch(rows, (val) => localStorage.setItem('splicer-rows', val.toString()));
watch(exportFormat, (val) => localStorage.setItem('splicer-format', val));
watch(filenamePrefix, (val) => localStorage.setItem('splicer-prefix', val));

function drawGrid(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image.value) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.setTransform(zoom.value, 0, 0, zoom.value, offsetX.value, offsetY.value);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.value, offsetX.value, offsetY.value, image.value.width * zoom.value, image.value.height * zoom.value);

    const scaledW = (image.value.width * zoom.value) / cols.value;
    const scaledH = (image.value.height * zoom.value) / rows.value;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    for (let x = 1; x < cols.value; x++) {
        const lineX = offsetX.value + x * scaledW;
        ctx.beginPath();
        ctx.moveTo(lineX, offsetY.value);
        ctx.lineTo(lineX, offsetY.value + image.value.height * zoom.value);
        ctx.stroke();
    }

    for (let y = 1; y < rows.value; y++) {
        const lineY = offsetY.value + y * scaledH;
        ctx.beginPath();
        ctx.moveTo(offsetX.value, lineY);
        ctx.lineTo(offsetX.value + image.value.width * zoom.value, lineY);
        ctx.stroke();
    }
    skippedTilesPositions.value = [];
    skippedTiles.value.forEach((index) => {
        const col = index % cols.value;
        const row = Math.floor(index / cols.value);

        const ctxTransform = ctx.getTransform();

        const x = offsetX.value * ctxTransform.a + col * scaledW * ctxTransform.a + ctxTransform.e;
        const x2 = offsetX.value + col * scaledW;
        const y = offsetY.value * ctxTransform.a + row * scaledH * ctxTransform.a + ctxTransform.f;
        const y2 = offsetY.value + row * scaledH;

        skippedTilesPositions.value.push({
            x: x,
            y: y,
            w: scaledW * ctxTransform.a,
            h: scaledH * ctxTransform.a,
        });

        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(x2, y2, scaledW, scaledH);
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
        }

        if (e.data.type === 'done') {
            skippedTiles.value = e.data.emptyIndices;
            const zip = new JSZip();
            const { slices, emptyIndices } = e.data;
            let sliceIndex = 0;

            for (let i = 0; i < cols.value * rows.value; i++) {
                if (emptyIndices.includes(i)) continue;
                zip.file(`${filenamePrefix.value}-${i + 1}.${exportFormat.value}`, slices[sliceIndex]);
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

function resetView(): void {
    zoom.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    drawGrid();
}

function onWheel(e: WheelEvent): void {
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoom.value = Math.min(Math.max(0.1, zoom.value + delta), 5);
    drawGrid();
}

function onCanvasMouseDown(e: MouseEvent): void {
    isPanning.value = true;
    panStart = { x: e.clientX - offsetX.value, y: e.clientY - offsetY.value };
}

function onCanvasMouseMove(e: MouseEvent): void {
    if (!isPanning.value) {
        return;
    }
    offsetX.value = e.clientX - panStart.x;
    offsetY.value = e.clientY - panStart.y;
    drawGrid();
}

function onCanvasMouseUp(): void {
    isPanning.value = false;
}
</script>

<style scoped lang="scss">
.canvas-wrapper {
    position: relative;
    max-width: 100%;
    max-height: 80vh;
    margin-top: 1rem;
    border: 2px dashed #ccc;
    border-radius: 8px;
    overflow: auto;
    transition: border-color 0.3s ease;

    &:hover {
        border-color: #1976d2;
    }
}

.preview-canvas {
    display: block;
    width: 100%;
    height: auto;
    max-width: 100%;
    transition: transform 0.3s ease;
}

.skipped-overlay {
    position: absolute;
    border: 1px solid orange;
    background: rgb(255 255 0 / 30%);
    pointer-events: auto;
}

.v-btn {
    transition: background-color 0.2s ease;

    &:hover {
        background-color: #1976d2 !important;
        color: white;
    }
}

/* stylelint-disable-next-line selector-class-pattern */
.v-progress-linear__bar {
    transition: width 0.4s ease-in-out;
}
</style>
