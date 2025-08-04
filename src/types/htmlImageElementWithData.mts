export interface HTMLImageElementWithData extends HTMLImageElement {
    dataset: {
        filename?: string;
        [key: string]: string | undefined;
    };
}
