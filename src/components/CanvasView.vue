<template>
    <div class="canvas-wrapper">
        <canvas ref="canvasRef" class="preview-canvas" @wheel="onWheel" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp" />
        <div v-if="!isPanning" v-for="(tile, index) in skippedTiles" :key="index" class="skipped-overlay">
            <v-tooltip activator="parent" location="top">Skipped tile: empty</v-tooltip>
        </div>
    </div>
</template>

<script setup lang="ts">
/*
            :style="{
                left: `${tile.x}px`,
                top: `${tile.y}px`,
                width: `${tile.w}px`,
                height: `${tile.h}px`,
            }"
*/
import { ref, watch } from 'vue';

import { type ImageSettingsTyped } from '@/types/imageSettingsTyped.mjs';

const props = defineProps<{
    currentSettings: ImageSettingsTyped;
    image?: HTMLImageElement;
}>();

const emit = defineEmits<{
    (e: 'on-zoom-changed', zoom: number): void;
}>();

defineExpose({
    draw,
});

let isPanning = ref(false);
let panStart = { x: 0, y: 0 };
const skippedTiles = ref<number[]>([]);
const canvasRef = ref<HTMLCanvasElement | null>(null);

watch(
    () => props.currentSettings,
    () => draw
);
watch(
    () => props.image,
    () => {
        console.error('image changed');
        draw();
    }
);

function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    props.currentSettings.zoom = Math.min(Math.max(0.1, props.currentSettings.zoom + delta), 5);
    emit('on-zoom-changed', props.currentSettings.zoom);
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
    // isPanning.value = false;
}

function draw(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !props.image) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(props.image, 0, 0, props.image.width, props.image.height);
}

// function drawGrid(): void {

//     const settings = imageSettings.value[selectedImage.value!.name] ?? getDefaultSettings();
//     ctx.setTransform(settings.zoom, 0, 0, settings.zoom, settings.offsetX, settings.offsetY);
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     ctx.drawImage(currentImage.value, offsetX.value, offsetY.value, currentImage.value.width * zoom.value, currentImage.value.height * zoom.value);

//     const colCount = imageSettings.value[selectedImage.value!.name]?.cols ?? cols.value;
//     const rowCount = imageSettings.value[selectedImage.value!.name]?.rows ?? rows.value;

//     if (colCount <= 0 || rowCount <= 0) {
//         return;
//     }

//     const scaledW = (currentImage.value.width * zoom.value) / colCount;
//     const scaledH = (currentImage.value.height * zoom.value) / rowCount;
//     ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
//     ctx.lineWidth = 1;

//     if (!selectedImage.value) {
//         return;
//     }

//     for (let x = 1; x < colCount; x++) {
//         const lineX = offsetX.value + x * scaledW;
//         ctx.beginPath();
//         ctx.moveTo(lineX, offsetY.value);
//         ctx.lineTo(lineX, offsetY.value + currentImage.value.height * zoom.value);
//         ctx.stroke();
//     }

//     for (let y = 1; y < rowCount; y++) {
//         const lineY = offsetY.value + y * scaledH;
//         ctx.beginPath();
//         ctx.moveTo(offsetX.value, lineY);
//         ctx.lineTo(offsetX.value + currentImage.value.width * zoom.value, lineY);
//         ctx.stroke();
//     }
//     skippedTilesPositions.value = [];
//     skippedTiles.value.forEach((index) => {
//         const col = index % colCount;
//         const row = Math.floor(index / colCount);

//         const ctxTransform = ctx.getTransform();

//         const x = offsetX.value * ctxTransform.a + col * scaledW * ctxTransform.a + ctxTransform.e;
//         const x2 = offsetX.value + col * scaledW;
//         const y = offsetY.value * ctxTransform.a + row * scaledH * ctxTransform.a + ctxTransform.f;
//         const y2 = offsetY.value + row * scaledH;

//         skippedTilesPositions.value.push({
//             x: x,
//             y: y,
//             w: scaledW * ctxTransform.a,
//             h: scaledH * ctxTransform.a,
//         });

//         ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
//         ctx.fillRect(x2, y2, scaledW, scaledH);
//     });
// }
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
</style>
