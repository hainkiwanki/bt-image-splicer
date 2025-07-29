<template>
    <div class="canvas-wrapper">
        <canvas ref="canvasRef" class="preview-canvas" @wheel="onWheel" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp" />
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
import { onMounted, ref, watch } from 'vue';

export interface TilePosition {
    x: number;
    y: number;
    w: number;
    h: number;
}

const props = defineProps<{
    image: HTMLImageElement | null;
    settings: {
        cols: number;
        rows: number;
        zoom: number;
        offsetX: number;
        offsetY: number;
    };
    skippedTiles: TilePosition[];
}>();

const emit = defineEmits<{
    (e: 'update-offsets', offsetX: number, offsetY: number): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isPanning = ref(false);
let panStart = { x: 0, y: 0 };

function draw(): void {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !props.image) return;

    const { cols, rows, zoom, offsetX, offsetY } = props.settings;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(props.image, 0, 0, props.image.width, props.image.height);

    const scaledW = (props.image.width * zoom) / cols;
    const scaledH = (props.image.height * zoom) / rows;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 1;

    for (let x = 1; x < cols; x++) {
        const lineX = offsetX + x * scaledW;
        ctx.beginPath();
        ctx.moveTo(lineX, offsetY);
        ctx.lineTo(lineX, offsetY + props.image.height * zoom);
        ctx.stroke();
    }

    for (let y = 1; y < rows; y++) {
        const lineY = offsetY + y * scaledH;
        ctx.beginPath();
        ctx.moveTo(offsetX, lineY);
        ctx.lineTo(offsetX + props.image.width * zoom, lineY);
        ctx.stroke();
    }
}

function onWheel(e: WheelEvent): void {
    e.preventDefault();
    // Zoom is handled externally
}

function onCanvasMouseDown(e: MouseEvent): void {
    isPanning.value = true;
    panStart = {
        x: e.clientX - props.settings.offsetX,
        y: e.clientY - props.settings.offsetY,
    };
}

function onCanvasMouseMove(e: MouseEvent): void {
    if (!isPanning.value) return;
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;
    emit('update-offsets', newX, newY);
}

function onCanvasMouseUp(): void {
    isPanning.value = false;
}

watch(() => props.image, draw);
watch(() => props.settings, draw, { deep: true });

onMounted(draw);
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
}

.skipped-overlay {
    position: absolute;
    border: 1px solid orange;
    background: rgb(255 255 0 / 30%);
    pointer-events: auto;
}
</style>
