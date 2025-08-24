import type { SnackbackMsgType } from './snackbarMsgTypes.mts';

export interface SnackbarDataTyped {
    show: boolean;
    msg: string;
    type: SnackbackMsgType;
}
