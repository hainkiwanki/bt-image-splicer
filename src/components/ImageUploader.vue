<template>
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
</template>

<script setup lang="ts">
import { ref } from 'vue';

import type { LoadedImageTyped } from '@/types/loadedImageTyped.mjs';

const refFiles = ref<File[]>([]);
const isDragging = ref(false);

const emit = defineEmits<{
    (e: 'images-loaded', images: LoadedImageTyped[]): void;
}>();

async function handleFileUpload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) {
        return;
    }

    const loadedImages: LoadedImageTyped[] = [];
    for (const file of input.files) {
        if (!file.type.startsWith('image/')) {
            return;
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

        if (loadedImages.length > 0) {
            emit('images-loaded', loadedImages);
        }
    }
}

function handleDrop(e: DragEvent): void {
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

<style lang="scss" scoped>
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
