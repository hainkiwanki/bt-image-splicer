<template>
    <v-snackbar v-model="showSnackbar" :color elevation="8" location="bottom right" transition="scale-transition">
        {{ data.msg }}
        <template #actions>
            <v-btn icon @click="showSnackbar = false">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </template>
    </v-snackbar>
</template>

<script setup lang="ts">
import { type ComputedRef, computed, ref } from 'vue';

import type { SnackbarDataTyped } from '@/types/snackbarDataTyped.mjs';
import { SnackbackMsgType } from '@/types/snackbarMsgTypes.mjs';

const props = defineProps<{
    data: SnackbarDataTyped;
}>();
const showSnackbar = ref<boolean>(true);
const colorMap: Record<SnackbackMsgType, string> = {
    [SnackbackMsgType.Info]: 'blue',
    [SnackbackMsgType.Warning]: 'yellow',
    [SnackbackMsgType.Error]: 'red',
    [SnackbackMsgType.Success]: 'green',
};
const color: ComputedRef<string> = computed(() => {
    return colorMap[props.data.type];
});
</script>
