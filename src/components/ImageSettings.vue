<template>
    <v-row dense align="center">
        <v-col cols="6" md="3">
            <v-text-field label="Columns" type="number" :model-value="settings.cols" @update:model-value="emit('update-setting', 'cols', $event as unknown as number)" />
        </v-col>
        <v-col cols="6" md="3">
            <v-text-field label="Rows" type="number" :model-value="settings.rows" @update:model-value="emit('update-setting', 'rows', $event as unknown as number)" />
        </v-col>
        <v-col cols="12" md="3">
            <v-select label="Export Format" :items="['png', 'jpeg']" :model-value="settings.format" @update:model-value="emit('update-setting', 'format', $event)" />
        </v-col>
        <v-col cols="12" md="3">
            <v-text-field label="Filename Prefix" :model-value="settings.prefix" @update:model-value="emit('update-setting', 'prefix', $event)" />
        </v-col>
    </v-row>
    <v-row>
        <v-select v-model="selectedDetection" :items="detectionOptions" label="Auto-detect method" outlined dense />
    </v-row>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import type { DetectionMethodName } from '@/types/detectionMethodName.mjs';
import type { ImageSettingKeyType, ImageSettingsTyped } from '@/types/imageSettingsTyped.mjs';

defineProps<{
    settings: ImageSettingsTyped;
}>();

const emit = defineEmits<{
    (e: 'update-setting', key: ImageSettingKeyType, value: any): void;
    (e: 'detection-method', method: DetectionMethodName): void;
}>();

const selectedDetection = ref<DetectionMethodName>('hybrid');
const detectionOptions: DetectionMethodName[] = ['emptySpace', 'edgeDetection', 'metadataHeuristic', 'hybrid'];

watch(
    () => selectedDetection.value,
    () => {
        emit('detection-method', selectedDetection.value);
    }
);
</script>
