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
</template>

<script setup lang="ts">
import type { ImageSettingKeyType, ImageSettingsTyped } from '@/types/imageSettingsTyped.mjs';

defineProps<{
    settings: ImageSettingsTyped;
}>();

const emit = defineEmits<{
    (e: 'update-setting', key: ImageSettingKeyType, value: any): void;
}>();
</script>
