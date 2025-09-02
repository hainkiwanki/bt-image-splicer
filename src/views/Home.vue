<template>
    <v-app>
        <app-bar></app-bar>
        <v-main>
            <v-container class="mt-5">
                <div class="text-center mb-12">
                    <h1 class="text-h5 font-weight-bold mb-6">Slice your images</h1>
                    <p class="text-body-2">
                        Upload your image and specify the number of rows and columns to slice it into.
                    </p>
                </div>

                <div v-if="!isDoneLoadingImages">
                    <image-uploader @images-loaded="onImagesLoadedEvent" />
                </div>
                <div v-else>
                    <v-row class="mt-8 gap-4" align="start" no-gutters>
                        <v-col cols="12" md="7" class="pr-md-4">
                            <canvas-view
                                ref="canvasViewRef"
                                :current-settings="currentSettings"
                                :image="selectedImage?.image"
                                :skipped-tiles="skippedTiles"
                                @update-setting="onUpdateSetting"
                            />
                        </v-col>
                        <v-col cols="12" md="5" class="pl-md-4 mt-4">
                            <div class="d-flex flex-column gap-4">
                                <image-settings
                                    v-if="selectedImage"
                                    :settings="currentSettings"
                                    @update-setting="onUpdateSetting"
                                    @detection-method-changed="onDetectionMethodChanged"
                                ></image-settings>

                                <v-row dense v-if="loadedImages.length > 1">
                                    <v-col cols="6" md="6">
                                        <v-select
                                            label="Select Image"
                                            :items="loadedImages"
                                            item-title="name"
                                            :item-value="(item) => item"
                                            v-model="selectedImage"
                                        />
                                    </v-col>
                                    <v-col cols="6" md="6">
                                        <v-switch
                                            v-model="exportOnlySelected"
                                            :label="`Export only ${selectedImage?.name}`"
                                        />
                                    </v-col>
                                </v-row>

                                <v-progress-linear
                                    v-if="loading"
                                    :model-value="progressValue"
                                    :value="progressValue"
                                    :buffer-value="progressBufferValue"
                                    color="primary"
                                    height="6"
                                />
                                <v-row v-if="exportedZipBlob">
                                    <v-col cols="12">
                                        <v-btn
                                            v-if="exportedZipBlob"
                                            color="primary"
                                            style="width: 100%"
                                            variant="elevated"
                                            size="large"
                                            prepend-icon="mdi-download"
                                            @click="downloadZip"
                                            >Download ZIP</v-btn
                                        >
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
                            </div>
                        </v-col>
                    </v-row>
                </div>
                <snackbar v-if="snackbarData.show" :data="snackbarData" />
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
import { type SnackbarDataTyped } from '@/types/snackbarDataTyped.mjs';
import { SnackbackMsgType } from '@/types/snackbarMsgTypes.mjs';
import type { DetectionMethodName } from '@/utils/detection/detectionMethodName.mjs';
import { detectionMethods } from '@/utils/detection/index.mjs';
import AppBar from '@/views/AppBar.vue';
import SlicerWorker from '@/worker/slicer.worker?worker';

import Snackbar from './Snackbar.vue';

const snackbarData = ref<SnackbarDataTyped>({
    show: false,
    msg: '',
    type: SnackbackMsgType.Success,
});
const isDoneLoadingImages = ref<boolean>(false);
const rawImageDataByName = ref<Record<string, ImageData>>({});
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

async function onImagesLoadedEvent(images: LoadedImageTyped[]): Promise<void> {
    const existingNames = new Set(loadedImages.value.map((img) => img.name));
    const newImages = images.filter((img) => !existingNames.has(img.name));
    loadedImages.value.push(...newImages);
    selectedImage.value = loadedImages.value[0];
    isDoneLoadingImages.value = true;

    for (const { image, name } of newImages) {
        const c = document.createElement('canvas');
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        rawImageDataByName.value[name] = ctx.getImageData(0, 0, image.width, image.height);
        tryAndDetectColsAndRows(rawImageDataByName.value[name], name);
        onUpdateSettingForImage(name, { width: image.width, height: image.height });
    }
}

function onUpdateSettingForImage(
    imageName: string,
    keyOrObj: ImageSettingKeyType | Partial<ImageSettingsTyped>,
    value?: any
) {
    const current = imageSettings.value[imageName] ?? getDefaultSettings();
    const newSettings = typeof keyOrObj === 'string' ? { ...current, [keyOrObj]: value } : { ...current, ...keyOrObj };
    imageSettings.value[imageName] = newSettings;
}

function onUpdateSetting(keyOrObj: ImageSettingKeyType | Partial<ImageSettingsTyped>, value?: any): void {
    if (!selectedImage.value) {
        return;
    }
    onUpdateSettingForImage(selectedImage.value.name, keyOrObj, value);
}

async function tryAndDetectColsAndRows(
    imageData: ImageData,
    imageName: string,
    method: DetectionMethodName = 'hybrid'
): Promise<void> {
    try {
        const result = await detectionMethods[method]({
            data: imageData.data,
            width: imageData.width,
            height: imageData.height,
        });
        if (!Number.isFinite(result.cols) || !Number.isFinite(result.rows) || result.cols < 1 || result.rows < 1) {
            throw new Error('Invalid detection result');
        }
        onUpdateSettingForImage(imageName, { cols: result.cols, rows: result.rows });
    } catch (err) {
        const errorMsg = `[Automatic Col/Row Error] ${err}`;
        console.error(errorMsg);
        snackbarData.value.msg = errorMsg;
        snackbarData.value.show = true;
        snackbarData.value.type = SnackbackMsgType.Error;
    }
}

async function onDetectionMethodChanged(method: DetectionMethodName = 'hybrid'): Promise<void> {
    if (!selectedImage.value) {
        return;
    }
    const raw = rawImageDataByName.value[selectedImage.value.name];
    if (!raw) {
        return;
    }
    tryAndDetectColsAndRows(raw, selectedImage.value.name, method);
}

const exportFormat = ref<'png' | 'jpeg'>(localStorage.getItem('splicer-format') === 'jpeg' ? 'jpeg' : 'png');
const loading = ref(false);
const skippedTiles = ref<number[]>([]);
const progressValue = ref(0);
const progressBufferValue = ref(0);
const filenamePrefix = ref<string>('slice');
const exportOnlySelected = ref<boolean>(false);
const exportedZipBlob = ref<Blob | null>(null);

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

        const colCount = imageSettings.value[name]?.cols;
        const rowCount = imageSettings.value[name]?.rows;
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
                if (e.data.type === 'error') {
                    snackbarData.value.msg = e.data.message;
                    snackbarData.value.show = true;
                    snackbarData.value.type = SnackbackMsgType.Error;
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
            const baseName = name.replace(/\.[^/.]+$/, '');
            const folderPath = imgObj.folder ?? '';
            const fullPath = `${folderPath}/${baseName}/${filenamePrefix.value}-${t + 1}.${format}`.replace(/^\/+/, '');
            zip.file(fullPath, slices[sliceIndex]);
            sliceIndex++;
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    exportedZipBlob.value = zipBlob;
    snackbarData.value.msg = `Exported ${totalSlices} slices from ${loadedImages.value.length} image${loadedImages.value.length > 1 ? 's' : ''}.`;
    snackbarData.value.show = true;
    snackbarData.value.type = SnackbackMsgType.Success;
    loading.value = false;
}

function resetView(): void {
    onUpdateSetting({ zoom: 1, offsetX: 0, offsetY: 0 });
}

function downloadZip(): void {
    if (!exportedZipBlob.value) {
        return;
    }
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
