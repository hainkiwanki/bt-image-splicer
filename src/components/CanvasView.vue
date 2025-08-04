<template>
    <div class="canvas-wrapper">
        <canvas
            ref="canvasRef"
            class="preview-canvas"
            @mousedown="onCanvasMouseDown"
            @mousemove="onCanvasMouseMove"
            @mouseup="onCanvasMouseUp"
        />
        <div
            v-if="!isPanning"
            v-for="(tile, index) in skippedTiles"
            :key="index"
            class="skipped-overlay"
            :style="{
                left: `${tile.x}px`,
                top: `${tile.y}px`,
                width: `${tile.w}px`,
                height: `${tile.h}px`,
            }"
        >
            <v-tooltip activator="parent" location="top">Skipped tile: empty</v-tooltip>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { type ImageSettingKeyType, type ImageSettingsTyped } from '@/types/imageSettingsTyped.mjs';

const props = defineProps<{
    currentSettings: ImageSettingsTyped;
    skippedTiles: number[];
    image?: HTMLImageElement;
}>();

const emit = defineEmits<{
    (e: 'update-setting', keyOrObj: ImageSettingKeyType | Partial<ImageSettingsTyped>, value?: any): void;
}>();

defineExpose({
    draw,
    getCanvas: () => canvasRef.value,
});

let isPanning = ref(false);
let panStart = { x: 0, y: 0 };
const skippedTiles = ref<{ x: number; y: number; h: number; w: number }[]>([]);
const canvasRef = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
    const canvas = canvasRef.value;
    if (canvas) {
        canvas.addEventListener('wheel', onWheel, { passive: false });
    }
});

onBeforeUnmount(() => {
    const canvas = canvasRef.value;
    if (canvas) {
        canvas.removeEventListener('wheel', onWheel);
    }
});

watch(
    () => props.currentSettings,
    () => {
        draw();
        drawSkippedTile();
    }
);

watch(
    () => props.skippedTiles,
    () => {
        drawSkippedTile();
    }
);

onMounted(() => {
    draw();
});

function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    props.currentSettings.zoom = Math.min(Math.max(0.1, props.currentSettings.zoom + delta), 5);
    emit('update-setting', 'zoom', props.currentSettings.zoom);
}

function onCanvasMouseDown(e: MouseEvent): void {
    isPanning.value = true;
    panStart = { x: e.clientX - props.currentSettings.offsetX, y: e.clientY - props.currentSettings.offsetY };
}

function onCanvasMouseMove(e: MouseEvent): void {
    if (!isPanning.value) {
        return;
    }
    props.currentSettings.offsetX = e.clientX - panStart.x;
    props.currentSettings.offsetY = e.clientY - panStart.y;
    emit('update-setting', { offsetX: props.currentSettings.offsetX, offsetY: props.currentSettings.offsetY });
}

function onCanvasMouseUp(): void {
    isPanning.value = false;
}

function draw(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    const image = props.image;
    if (!ctx || !canvas || !image) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const settings = props.currentSettings;
    ctx.setTransform(settings.zoom, 0, 0, settings.zoom, settings.offsetX, settings.offsetY);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, settings.offsetX, settings.offsetY, image.width * settings.zoom, image.height * settings.zoom);

    const colCount = settings.cols;
    const rowCount = settings.rows;
    if (colCount <= 0 || rowCount <= 0) {
        return;
    }

    const scaledW = (image.width * settings.zoom) / colCount;
    const scaledH = (image.height * settings.zoom) / rowCount;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    for (let x = 1; x < colCount; x++) {
        const lineX = settings.offsetX + x * scaledW;
        ctx.beginPath();
        ctx.moveTo(lineX, settings.offsetY);
        ctx.lineTo(lineX, settings.offsetY + image.height * settings.zoom);
        ctx.stroke();
    }

    for (let y = 1; y < rowCount; y++) {
        const lineY = settings.offsetY + y * scaledH;
        ctx.beginPath();
        ctx.moveTo(settings.offsetX, lineY);
        ctx.lineTo(settings.offsetX + image.width * settings.zoom, lineY);
        ctx.stroke();
    }
}

function drawSkippedTile(): void {
    const settings = props.currentSettings;
    const colCount = settings.cols;
    const rowCount = settings.rows;
    const image = props.image;

    if (colCount <= 0 || rowCount <= 0 || !image) {
        return;
    }
    skippedTiles.value = [];
    const scaledW = (image.width * settings.zoom) / colCount;
    const scaledH = (image.height * settings.zoom) / rowCount;
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!ctx) {
        return;
    }
    const ctxTransform = ctx.getTransform();

    props.skippedTiles.forEach((index) => {
        const col = index % colCount;
        const row = Math.floor(index / colCount);
        const x = settings.offsetX * ctxTransform.a + col * scaledW * ctxTransform.a + ctxTransform.e;
        const y = settings.offsetY * ctxTransform.a + row * scaledH * ctxTransform.a + ctxTransform.f;
        skippedTiles.value.push({
            x: x,
            y: y,
            w: scaledW * ctxTransform.a,
            h: scaledH * ctxTransform.a,
        });
        const x2 = settings.offsetX + col * scaledW;
        const y2 = settings.offsetY + row * scaledH;
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(x2, y2, scaledW, scaledH);
    });
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
</style>
