import type { DetectionMethodName } from '../utils/detection/detectionMethodName.mts';

export interface ImageSettingsTyped {
    cols: number;
    rows: number;
    width: number;
    height: number;
    format: 'png' | 'jpeg';
    zoom: number;
    offsetX: number;
    offsetY: number;
    prefix: string;
    detection: DetectionMethodName;
}

export type ImageSettingKeyType = 'cols' | 'rows' | 'width' | 'height' | 'format' | 'prefix' | 'zoom' | 'offsetX' | 'offsetY' | 'detection';

export function getDefaultSettings(): ImageSettingsTyped {
    return {
        cols: -1,
        rows: -1,
        width: 16,
        height: 16,
        format: 'png',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        prefix: 'slice',
        detection: 'hybrid',
    };
}
