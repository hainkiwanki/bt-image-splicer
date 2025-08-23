<template>
    <div class="settings">
        <v-row dense class="mb-4" align="center">
            <v-col cols="12">
                <div class="tabbox">
                    <v-tabs v-model="tab" grow>
                        <v-tab value="grid">Grid</v-tab>
                        <v-tab value="sprite">Sprite</v-tab>
                    </v-tabs>
                    <v-window v-model="tab" class="mt-4">
                        <v-window-item value="grid">
                            <v-row dense align="center">
                                <v-col cols="12" md="4">
                                    <v-text-field
                                        label="Columns"
                                        type="number"
                                        :model-value="settings.cols"
                                        @update:model-value="
                                            emit('update-setting', 'cols', $event as unknown as number)
                                        "
                                    />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-text-field
                                        label="Rows"
                                        type="number"
                                        :model-value="settings.rows"
                                        @update:model-value="
                                            emit('update-setting', 'rows', $event as unknown as number)
                                        "
                                    />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-btn
                                        color="primary"
                                        style="width: 100%"
                                        variant="elevated"
                                        size="large"
                                        @click="onSuggestButtonClick"
                                    >
                                        Suggest
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-window-item>

                        <v-window-item value="sprite">
                            <v-row dense align="center">
                                <v-col cols="12" md="4">
                                    <v-text-field label="Sprite Width (px)" type="number" v-model="spriteWidth" />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-text-field label="Sprite Height (px)" type="number" v-model="spriteHeight" />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-btn
                                        color="primary"
                                        style="width: 100%"
                                        variant="elevated"
                                        size="large"
                                        @click="onApplyButtonClick"
                                    >
                                        Apply
                                    </v-btn>
                                </v-col>
                            </v-row>
                        </v-window-item>
                    </v-window>
                </div>
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
        </v-row>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import type { ImageSettingKeyType, ImageSettingsTyped } from '@/types/imageSettingsTyped.mjs';
import type { DetectionMethodName } from '@/utils/detection/detectionMethodName.mjs';

const tab = ref<'grid' | 'sprite'>('grid');
const props = defineProps<{
    settings: ImageSettingsTyped;
}>();
const spriteWidth = ref<number>(16);
const spriteHeight = ref<number>(16);

const emit = defineEmits<{
    (e: 'update-setting', key: ImageSettingKeyType, value: any): void;
    (e: 'detection-method-changed', method: DetectionMethodName): void;
}>();

function onSuggestButtonClick() {
    emit('detection-method-changed', props.settings.detection);
}

function onApplyButtonClick() {
    const { height, width } = props.settings as any;
    const cols = Math.max(1, Math.floor(Number(width) / Number(spriteWidth.value)));
    const rows = Math.max(1, Math.floor(Number(height) / Number(spriteHeight.value)));
    emit('update-setting', 'cols', cols);
    emit('update-setting', 'rows', rows);
}
</script>

<style scoped lang="scss">
.tabbox {
    overflow: hidden;
    border-bottom: 1px solid var(--v-theme-outline, rgb(var(--v-theme-on-surface), 0.12));
}

.settings {
    padding: 4px;
    border: 1px solid var(--v-theme-outline, rgb(var(--v-theme-on-surface), 0.12));
    border-radius: 6px;
    overflow: hidden;
}
</style>
