<template>
    <v-app>
        <v-main>
            <v-container>
                <h1 class="text-h4 mb-4">Image Splicer</h1>

                <image-uploader @images-loaded="onImagesLoadedEvent" />
                <image-settings v-if="selectedImage" :settings="currentSettings" @update-setting="onUpdateSetting"></image-settings>

                <v-row dense v-if="loadedImages.length > 1">
                    <v-col cols="6" md="6">
                        <v-select label="Select Image" :items="loadedImages" item-title="name" :item-value="(item) => item" v-model="selectedImage" />
                    </v-col>
                    <v-col cols="6" md="6">
                        <v-switch v-model="exportOnlySelected" :label="`Export only ${selectedImage?.name} - ${selectedImage?.width}×${selectedImage?.height}`" />
                    </v-col>
                </v-row>

                <v-progress-linear v-if="loading" :model-value="progressValue" :value="progressValue" :buffer-value="progressBufferValue" color="primary" height="6" />
                <v-row v-if="exportedZipBlob">
                    <v-col cols="12">
                        <v-btn v-if="exportedZipBlob" color="primary" style="width: 100%" variant="elevated" size="large" prepend-icon="mdi-download" @click="downloadZip">Download ZIP</v-btn>
                    </v-col>
                </v-row>

                <v-row dense class="mb-4">
                    <v-col cols="6" md="6">
                        <v-btn block color="primary" :disabled="!canvasRef" @click="sliceImage"> Export Slices </v-btn>
                    </v-col>
                    <v-col cols="6" md="6">
                        <v-btn block color="secondary" @click="resetView()">Reset</v-btn>
                    </v-col>
                </v-row>
                <v-snackbar v-model="showSnackbar" color="green" elevation="8" location="bottom right" transition="scale-transition">
                    {{ exportSummary }}
                    <template #actions>
                        <v-btn icon @click="showSnackbar = false">
                            <v-icon>mdi-close</v-icon>
                        </v-btn>
                    </template>
                </v-snackbar>
                <div class="canvas-wrapper">
                    <canvas ref="canvasRef" class="preview-canvas" @wheel="onWheel" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp" />
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
import { type ComputedRef, computed, ref, watch } from 'vue';

import JSZip from 'jszip';

import ImageSettings from '@/components/ImageSettings.vue';
import ImageUploader from '@/components/ImageUploader.vue';
import { type ImageSettingKeyType, type ImageSettingsTyped, getDefaultSettings } from '@/types/imageSettingsTyped.mjs';
import type { LoadedImageTyped } from '@/types/loadedImageTyped.mjs';
import SlicerWorker from '@/worker/slicer.worker?worker';

const imageSettings = ref<Record<string, ImageSettingsTyped>>({});
const loadedImages = ref<LoadedImageTyped[]>([]);
const selectedImage = ref<LoadedImageTyped | null>(null);

const currentSettings: ComputedRef<ImageSettingsTyped> = computed(() => {
    if (!selectedImage.value) {
        return getDefaultSettings();
    }

    const name = selectedImage.value.name;
    return imageSettings.value[name] ?? getDefaultSettings();
});

function onImagesLoadedEvent(images: LoadedImageTyped[]): void {
    loadedImages.value.push(...images);
    selectedImage.value = loadedImages.value[0];
    drawGrid();
}

function onUpdateSetting(key: ImageSettingKeyType, value: any): void {
    const img = selectedImage.value;
    if (!img) return;

    imageSettings.value[img.name] = {
        ...currentSettings.value,
        [key]: value,
    };

    drawGrid();
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const cols = ref<number>(-1);
const rows = ref<number>(-1);
const exportFormat = ref<'png' | 'jpeg'>(localStorage.getItem('splicer-format') === 'jpeg' ? 'jpeg' : 'png');
const loading = ref(false);
const skippedTiles = ref<number[]>([]);
const skippedTilesPositions = ref<{ x: number; y: number; h: number; w: number }[]>([]);
const progressValue = ref(0);
const progressBufferValue = ref(0);
const filenamePrefix = ref<string>(localStorage.getItem('splicer-prefix') || 'slice');

const currentImage = computed(() => selectedImage.value?.image || null);
const exportOnlySelected = ref<boolean>(false);
const exportedZipBlob = ref<Blob | null>(null);
const exportSummary = ref('');
const showSnackbar = ref(false);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
let isPanning = ref(false);
let panStart = { x: 0, y: 0 };

watch(filenamePrefix, (val) => localStorage.setItem('splicer-prefix', val));
watch(selectedImage, resetView);

function drawGrid(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !currentImage.value) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    // const settings = imageSettings.value[selectedImage.value!.name] ?? getDefaultSettings();
    // ctx.setTransform(settings.zoom, 0, 0, settings.zoom, settings.offsetX, settings.offsetY);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImage.value, offsetX.value, offsetY.value, currentImage.value.width * zoom.value, currentImage.value.height * zoom.value);

    // const colCount = imageSettings.value[selectedImage.value!.name]?.cols ?? cols.value;
    const colCount = cols.value;
    // const rowCount = imageSettings.value[selectedImage.value!.name]?.rows ?? rows.value;
    const rowCount = rows.value;

    if (colCount <= 0 || rowCount <= 0) {
        return;
    }

    const scaledW = (currentImage.value.width * zoom.value) / colCount;
    const scaledH = (currentImage.value.height * zoom.value) / rowCount;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    if (!selectedImage.value) {
        return;
    }

    for (let x = 1; x < colCount; x++) {
        const lineX = offsetX.value + x * scaledW;
        ctx.beginPath();
        ctx.moveTo(lineX, offsetY.value);
        ctx.lineTo(lineX, offsetY.value + currentImage.value.height * zoom.value);
        ctx.stroke();
    }

    for (let y = 1; y < rowCount; y++) {
        const lineY = offsetY.value + y * scaledH;
        ctx.beginPath();
        ctx.moveTo(offsetX.value, lineY);
        ctx.lineTo(offsetX.value + currentImage.value.width * zoom.value, lineY);
        ctx.stroke();
    }
    skippedTilesPositions.value = [];
    skippedTiles.value.forEach((index) => {
        const col = index % colCount;
        const row = Math.floor(index / colCount);

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

async function sliceImage(): Promise<void> {
    if (!loadedImages.value.length) return;

    loading.value = true;
    const zip = new JSZip();

    const imagesToExport = exportOnlySelected.value && selectedImage.value ? [selectedImage.value] : loadedImages.value;
    let totalSlices = 0;
    for (const imgObj of imagesToExport) {
        const { image: img, name } = imgObj;
        progressValue.value = 0;
        progressBufferValue.value = 0;

        // const colCount = imageSettings.value[name]?.cols ?? cols.value;
        // const rowCount = imageSettings.value[name]?.rows ?? rows.value;
        // const format = imageSettings.value[name]?.format ?? exportFormat.value;

        const colCount = cols.value;
        const rowCount = rows.value;
        const format = exportFormat.value;
        if (colCount <= 0 || rowCount <= 0) {
            continue;
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = img.width;
        offscreen.height = img.height;
        const ctx = offscreen.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const fullImageData = ctx.getImageData(0, 0, img.width, img.height);

        const worker = new SlicerWorker();
        const payload = {
            imageData: fullImageData,
            cols: colCount,
            rows: rowCount,
            format,
        };

        const workerResult = await new Promise<{ slices: Blob[]; emptyIndices: number[] }>((resolve) => {
            worker.onmessage = (e: MessageEvent<any>) => {
                if (e.data.type === 'progress') {
                    progressValue.value = (e.data.done / e.data.total) * 100;
                    progressBufferValue.value = progressValue.value + 100 / e.data.total;
                }
                if (e.data.type === 'done') {
                    resolve({
                        slices: e.data.slices,
                        emptyIndices: e.data.emptyIndices,
                    });
                }
            };
            worker.postMessage(payload);
        });

        const { slices, emptyIndices } = workerResult;
        totalSlices += slices.length;
        let sliceIndex = 0;

        skippedTiles.value = workerResult.emptyIndices;

        for (let t = 0; t < colCount * rowCount; t++) {
            if (emptyIndices.includes(t)) {
                continue;
            }
            const baseName = name.replace(/\.[^/.]+$/, ''); // e.g. "Gemss"
            const folderPath = imgObj.folder ?? '';
            const fullPath = `${folderPath}/${baseName}/${filenamePrefix.value}-${t + 1}.${format}`.replace(/^\/+/, '');
            zip.file(fullPath, slices[sliceIndex]);

            sliceIndex++;
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    exportedZipBlob.value = zipBlob;
    exportSummary.value = `Exported ${totalSlices} slices from ${loadedImages.value.length} image${loadedImages.value.length > 1 ? 's' : ''}.`;
    showSnackbar.value = true;
    loading.value = false;
    drawGrid();
}

function resetView(): void {
    zoom.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    drawGrid();
}

function downloadZip(): void {
    if (!exportedZipBlob.value) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(exportedZipBlob.value);
    link.download = 'slices.zip';
    link.click();
}

function onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!selectedImage.value) {
        return;
    }
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    // const settings = imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
    // settings.zoom = Math.min(Math.max(0.1, settings.zoom + delta), 5);
    // imageSettings.value[selectedImage.value.name] = settings;
    drawGrid();
}

function onCanvasMouseDown(e: MouseEvent): void {
    // if (!selectedImage.value || !imageSettings.value) {
    //     return;
    // }
    // isPanning.value = true;
    // const settings = imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
    // panStart = { x: e.clientX - settings.offsetX, y: e.clientY - settings.offsetY };
}

function onCanvasMouseMove(e: MouseEvent): void {
    // if (!isPanning.value || !selectedImage.value || !imageSettings.value) {
    //     return;
    // }
    // const settings = imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
    // settings.offsetX = e.clientX - panStart.x;
    // settings.offsetY = e.clientY - panStart.y;
    // imageSettings.value[selectedImage.value.name] = settings;
    // drawGrid();
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

/* stylelint-disable-next-line selector-class-pattern */
.v-progress-linear__bar {
    transition: width 0.4s ease-in-out;
}
</style>
