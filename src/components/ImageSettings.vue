<template>
    <v-row dense class="mb-4" align="center">
        <v-col cols="12" md="6">
            <v-text-field
                label="Columns"
                type="number"
                :model-value="settings.cols"
                @update:model-value="emit('update-setting', 'cols', $event as unknown as number)"
            />
        </v-col>

        <v-col cols="12" md="6">
            <v-text-field
                label="Rows"
                type="number"
                :model-value="settings.rows"
                @update:model-value="emit('update-setting', 'rows', $event as unknown as number)"
            />
        </v-col>

        <v-col cols="12" md="6">
            <v-select
                label="Export Format"
                :items="['png', 'jpeg']"
                :model-value="settings.format"
                @update:model-value="emit('update-setting', 'format', $event)"
            />
        </v-col>

        <v-col cols="12" md="6">
            <v-text-field
                label="Filename Prefix"
                :model-value="settings.prefix"
                @update:model-value="emit('update-setting', 'prefix', $event)"
            />
        </v-col>

        <v-col cols="12" md="6">
            <v-select
                :model-value="settings.detection"
                :items="detectionOptions"
                label="Auto-detect method"
                outlined
                dense
                @update:model-value="
                    (val) => {
                        emit('update-setting', 'detection', val);
                        emit('detection-method-changed', val as DetectionMethodName);
                    }
                "
            />
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import type { ImageSettingKeyType, ImageSettingsTyped } from '@/types/imageSettingsTyped.mjs';
import type { DetectionMethodName } from '@/utils/detection/detectionMethodName.mjs';

defineProps<{
    settings: ImageSettingsTyped;
}>();

const emit = defineEmits<{
    (e: 'update-setting', key: ImageSettingKeyType, value: any): void;
    (e: 'detection-method-changed', method: DetectionMethodName): void;
}>();
const detectionOptions: DetectionMethodName[] = ['emptySpace', 'edgeDetection', 'hybrid'];
</script>
