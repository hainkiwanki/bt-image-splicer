<template>
    <v-app>
        <v-main>
            <v-container>
                <h1 class="text-h4 mb-4">Image Splicer</h1>

                <v-file-input label="Upload image(s)" accept="image/*" chips @change="handleFileUpload" v-model="refFiles" multiple>
                    <template v-slot:selection="{ fileNames }">
                        <template v-for="(fileName, index) in fileNames" :key="fileName">
                            <v-chip v-if="index < 3" color="primary" size="small" label>
                                {{ fileName }}
                            </v-chip>
                        </template>
                    </template>
                </v-file-input>
                <div
                    class="drop-area mb-4"
                    :class="{ dragging: isDragging }"
                    @dragover.prevent="isDragging = true"
                    @dragleave="isDragging = false"
                    @drop="
                        (e) => {
                            isDragging = false;
                            handleDrop(e);
                        }
                    "
                >
                    <p class="text-subtitle-2">Drag & drop images or folders here</p>
                </div>

                <v-row v-if="selectedImage" dense align="center">
                    <v-col cols="6" md="3">
                        <v-text-field label="Columns" type="number" :model-value="imageSettings[selectedImage.name]?.cols ?? cols" @update:model-value="updateImageSetting('cols', $event as unknown as number)" />
                    </v-col>
                    <v-col cols="6" md="3">
                        <v-text-field label="Rows" type="number" :model-value="imageSettings[selectedImage.name]?.rows ?? rows" @update:model-value="updateImageSetting('rows', $event as unknown as number)" />
                    </v-col>
                    <v-col cols="12" md="3">
                        <v-select label="Export Format" :items="['png', 'jpeg']" :model-value="imageSettings[selectedImage.name]?.format ?? exportFormat" @update:model-value="updateImageSetting('format', $event)" />
                    </v-col>
                    <v-col cols="12" md="3">
                        <v-text-field label="Filename Prefix" v-model="filenamePrefix" />
                    </v-col>
                </v-row>

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
import { computed, ref, watch } from 'vue';

import JSZip from 'jszip';

import SlicerWorker from '@/worker/slicer.worker?worker';

interface LoadedImage {
    file: File;
    image: HTMLImageElement;
    name: string;
    width: number;
    height: number;
    folder?: string;
}

interface ImageSettings {
    cols: number;
    rows: number;
    format: 'png' | 'jpeg';
    zoom: number;
    offsetX: number;
    offsetY: number;
}

function getDefaultSettings(): ImageSettings {
    return {
        cols: cols.value,
        rows: rows.value,
        format: exportFormat.value,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
    };
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
const refFiles = ref([]);
const loadedImages = ref<LoadedImage[]>([]);
const selectedImage = ref<LoadedImage | null>(null);
const currentImage = computed(() => selectedImage.value?.image || null);
const exportOnlySelected = ref<boolean>(false);
const imageSettings = ref<Record<string, ImageSettings>>({});
const exportedZipBlob = ref<Blob | null>(null);
const exportSummary = ref('');
const showSnackbar = ref(false);
const isDragging = ref(false);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
let isPanning = ref(false);
let panStart = { x: 0, y: 0 };

function updateImageSetting(key: 'cols' | 'rows' | 'format', value: number | 'png' | 'jpeg'): void {
    if (!selectedImage.value) return;
    const name = selectedImage.value.name;
    imageSettings.value[name] = {
        ...imageSettings.value[name],
        [key]: value,
    };
    drawGrid();
}

async function handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    loadedImages.value = [];

    for (const file of Array.from(files)) {
        const img = new Image();
        img.src = URL.createObjectURL(file);

        await new Promise<void>((resolve) => {
            img.onload = () => resolve();
        });

        loadedImages.value.push({
            file,
            image: img,
            name: file.name,
            width: img.width,
            height: img.height,
        });
    }

    if (loadedImages.value.length > 0) {
        selectedImage.value = loadedImages.value[0];
    }
    drawGrid();
}

watch(filenamePrefix, (val) => localStorage.setItem('splicer-prefix', val));
watch(selectedImage, resetView);
watch(selectedImage, (img) => {
    if (!img) return;

    const settings = imageSettings.value[img.name];
    if (settings) {
        cols.value = settings.cols;
        rows.value = settings.rows;
        exportFormat.value = settings.format;
    } else {
        imageSettings.value[img.name] = getDefaultSettings();
    }
});

function drawGrid(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !currentImage.value) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const settings = imageSettings.value[selectedImage.value!.name] ?? getDefaultSettings();
    ctx.setTransform(settings.zoom, 0, 0, settings.zoom, settings.offsetX, settings.offsetY);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImage.value, offsetX.value, offsetY.value, currentImage.value.width * zoom.value, currentImage.value.height * zoom.value);

    const colCount = imageSettings.value[selectedImage.value!.name]?.cols ?? cols.value;
    const rowCount = imageSettings.value[selectedImage.value!.name]?.rows ?? rows.value;

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

        const colCount = imageSettings.value[name]?.cols ?? cols.value;
        const rowCount = imageSettings.value[name]?.rows ?? rows.value;
        const format = imageSettings.value[name]?.format ?? exportFormat.value;
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
    if (!selectedImage.value || !imageSettings.value) {
        return;
    }
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const settings = imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
    settings.zoom = Math.min(Math.max(0.1, settings.zoom + delta), 5);
    imageSettings.value[selectedImage.value.name] = settings;
    drawGrid();
}

function onCanvasMouseDown(e: MouseEvent): void {
    if (!selectedImage.value || !imageSettings.value) {
        return;
    }
    isPanning.value = true;
    const settings = imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
    panStart = { x: e.clientX - settings.offsetX, y: e.clientY - settings.offsetY };
}

function onCanvasMouseMove(e: MouseEvent): void {
    if (!isPanning.value || !selectedImage.value || !imageSettings.value) {
        return;
    }
    const settings = imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
    settings.offsetX = e.clientX - panStart.x;
    settings.offsetY = e.clientY - panStart.y;
    imageSettings.value[selectedImage.value.name] = settings;
    drawGrid();
}

function onCanvasMouseUp(): void {
    isPanning.value = false;
}

function handleDrop(e: DragEvent): void {
    e.preventDefault();
    const items = e.dataTransfer?.items;
    if (!items) return;

    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
            traverseEntry(entry);
        }
    }
}

function traverseEntry(entry: any, path = ''): void {
    if (entry.isFile) {
        entry.file((file: File) => {
            if (!file.type.startsWith('image/')) return;
            const img = new Image();
            img.src = URL.createObjectURL(file);

            img.onload = () => {
                loadedImages.value.push({
                    file,
                    image: img,
                    name: file.name,
                    width: img.width,
                    height: img.height,
                    folder: path,
                });

                if (!selectedImage.value) {
                    selectedImage.value = loadedImages.value[0];
                }

                drawGrid();
            };
        });
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries((entries: any[]) => {
            for (const subEntry of entries) {
                traverseEntry(subEntry, `${path}${entry.name}/`);
            }
        });
    }
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

.drop-area {
    padding: 1rem;
    border: 2px dashed #aaa;
    border-radius: 8px;
    background: #f9f9f9;
    text-align: center;
    transition: border-color 0.3s ease;

    &:hover {
        border-color: #1976d2;
    }

    &.dragging {
        background-color: #e3f2fd;
        border-color: #1976d2;
    }
}
</style>
