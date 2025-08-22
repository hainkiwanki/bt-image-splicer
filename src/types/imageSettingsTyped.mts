import type { DetectionMethodName } from '../utils/detection/detectionMethodName.mts';

export interface ImageSettingsTyped {
    cols: number;
    rows: number;
    format: 'png' | 'jpeg';
    zoom: number;
    offsetX: number;
    offsetY: number;
    prefix: string;
    detection: DetectionMethodName;
}

export type ImageSettingKeyType = 'cols' | 'rows' | 'format' | 'prefix' | 'zoom' | 'offsetX' | 'offsetY' | 'detection';

export function getDefaultSettings(): ImageSettingsTyped {
    return {
        cols: -1,
        rows: -1,
        format: 'png',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        prefix: 'slice',
        detection: 'emptySpace',
    };
}
