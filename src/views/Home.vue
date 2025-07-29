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
                        <v-btn block color="primary" @click="sliceImage"> Export Slices </v-btn>
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
                <canvas-view ref="canvasViewRef" :current-settings="currentSettings" :image="selectedImage?.image" :skipped-tiles="skippedTiles" @update-setting="onUpdateSetting" />
            </v-container>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { type ComputedRef, type Ref, computed, ref } from 'vue';

import JSZip from 'jszip';

import CanvasView from '@/components/CanvasView.vue';
import ImageSettings from '@/components/ImageSettings.vue';
import ImageUploader from '@/components/ImageUploader.vue';
import { type ImageSettingKeyType, type ImageSettingsTyped, getDefaultSettings } from '@/types/imageSettingsTyped.mjs';
import type { LoadedImageTyped } from '@/types/loadedImageTyped.mjs';
import SlicerWorker from '@/worker/slicer.worker?worker';

const imageSettings = ref<Record<string, ImageSettingsTyped>>({});
const loadedImages = ref<LoadedImageTyped[]>([]);
const selectedImage = ref<LoadedImageTyped | null>(null);
const canvasViewRef: Ref<InstanceType<typeof CanvasView> | null> = ref(null);
const currentSettings: ComputedRef<ImageSettingsTyped> = computed(() => {
    if (!selectedImage.value) {
        return getDefaultSettings();
    }

    return imageSettings.value[selectedImage.value.name] ?? getDefaultSettings();
});

function onImagesLoadedEvent(images: LoadedImageTyped[]): void {
    loadedImages.value.push(...images);
    selectedImage.value = loadedImages.value[0];
}

function onUpdateSetting(keyOrObj: ImageSettingKeyType | Partial<ImageSettingsTyped>, value?: any): void {
    const img = selectedImage.value;
    if (!img) return;

    const current = currentSettings.value;
    const newSettings = typeof keyOrObj === 'string' ? { ...current, [keyOrObj]: value } : { ...current, ...keyOrObj };
    imageSettings.value[img.name] = newSettings;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const cols = ref<number>(-1);
const rows = ref<number>(-1);
const exportFormat = ref<'png' | 'jpeg'>(localStorage.getItem('splicer-format') === 'jpeg' ? 'jpeg' : 'png');
const loading = ref(false);
const skippedTiles = ref<number[]>([]);
const progressValue = ref(0);
const progressBufferValue = ref(0);
const filenamePrefix = ref<string>('slice');
const exportOnlySelected = ref<boolean>(false);
const exportedZipBlob = ref<Blob | null>(null);
const exportSummary = ref('');
const showSnackbar = ref(false);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);

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
    // TODO
    // drawGrid();
}

function resetView(): void {
    zoom.value = 1;
    offsetX.value = 0;
    offsetY.value = 0;
    // TODO
    // drawGrid();
}

function downloadZip(): void {
    if (!exportedZipBlob.value) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(exportedZipBlob.value);
    link.download = 'slices.zip';
    link.click();
}
</script>

<style scoped lang="scss">
/* stylelint-disable-next-line selector-class-pattern */
.v-progress-linear__bar {
    transition: width 0.4s ease-in-out;
}
</style>
