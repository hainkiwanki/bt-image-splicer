<template>
    <div
        class="upload-box"
        :class="{ dragging: isDragging }"
        @click="fileInputRef?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop="onDrop"
    >
        <input ref="fileInputRef" type="file" accept="image/*" multiple class="hidden-input" @change="onFileChange" />

        <div class="text-content">
            <strong>Drag and drop an image here</strong>
            <div class="text-caption">Or browse files</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import type { LoadedImageTyped } from '@/types/loadedImageTyped.mjs';

const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const emit = defineEmits<{
    (e: 'images-loaded', images: LoadedImageTyped[]): void;
}>();

function onFileChange(e: Event): void {
    const files = (e.target as HTMLInputElement)?.files;
    console.error(files);
    if (files) {
        loadFiles([...files]);
    }
}

function onDrop(e: DragEvent): void {
    e.preventDefault();
    isDragging.value = false;

    const items = e.dataTransfer?.items;
    if (!items) {
        return;
    }

    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
            traverseEntry(entry);
        }
    }
}

async function loadFiles(files: File[]): Promise<void> {
    const loadedImages: LoadedImageTyped[] = [];

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            continue;
        }

        const img = new Image();
        img.src = URL.createObjectURL(file);

        await new Promise<void>((res) => {
            img.onload = () => {
                loadedImages.push({
                    file,
                    image: img,
                    name: file.name,
                    width: img.width,
                    height: img.height,
                });
                res();
            };
        });
    }

    if (loadedImages.length) {
        emit('images-loaded', loadedImages);
    }
}

function traverseEntry(entry: any, path = ''): void {
    if (entry.isFile) {
        entry.file((file: File) => {
            if (!file.type.startsWith('image/')) {
                return;
            }
            const img = new Image();
            img.src = URL.createObjectURL(file);

            img.onload = () => {
                emit('images-loaded', [
                    {
                        file,
                        image: img,
                        name: file.name,
                        width: img.width,
                        height: img.height,
                        folder: path,
                    },
                ]);
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
.upload-box {
    padding: 2rem;
    border: 2px dashed #ccc;
    border-radius: 8px;
    background-color: #fff;
    text-align: center;
    transition: border-color 0.2s;
    cursor: pointer;

    &.dragging {
        background-color: #e3f2fd;
        border-color: #1976d2;
    }

    .text-content {
        font-size: 0.9rem;

        strong {
            display: block;
            margin-bottom: 0.25rem;
        }

        .text-caption {
            color: #666;
        }
    }
}

.hidden-input {
    display: none;
}
</style>
