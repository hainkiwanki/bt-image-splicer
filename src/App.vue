<template>
    <router-view />
    <button @click="abortRound">Abort Current Round</button>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { ref } from 'vue';

const currentControllerRef = ref<AbortController | null>(null);
let currentController: AbortController | null = null;
let currentRun: Promise<void> | null = null;
let inFlight = false;

function abortRound(): void {
    if (currentControllerRef.value) {
        currentControllerRef.value.abort();
        console.error('Manual abort triggered!');
    }
}

enum Round {
    Start = 'start',
    Fall = 'fall',
    Wait = 'wait',
    End = 'end',
}

type EnumLike = Record<string, string | number>;

function enumValues<E extends EnumLike>(e: E): Array<E[keyof E]> {
    const vals = Object.values(e) as Array<string | number>;
    const hasNumber = vals.some((v) => typeof v === 'number');
    const filtered = hasNumber
        ? vals.filter((v): v is number => typeof v === 'number')
        : vals.filter((v): v is string => typeof v === 'string');
    return filtered as Array<E[keyof E]>;
}

function getRandomEnumValue<E extends EnumLike>(anEnum: E): E[keyof E] {
    const values = enumValues(anEnum);
    return values[Math.floor(Math.random() * values.length)];
}

function startRandomEmitter<E extends EnumLike>(anEnum: E, callback: (val: E[keyof E]) => void): () => void {
    let t: ReturnType<typeof setTimeout> | null = null;
    const loop = (): void => {
        callback(getRandomEnumValue(anEnum));
        const delay = 2000 + Math.random() * 2000;
        console.error(delay);
        t = setTimeout(loop, delay); // fixed: use computed delay
    };
    loop();
    return () => {
        if (t) clearTimeout(t);
    };
}

// --- Abort helpers ---
class AbortedError extends Error {
    constructor() {
        super('aborted');
        this.name = 'AbortedError';
    }
}
const throwIfAborted = (signal: AbortSignal): void => {
    if (signal.aborted) throw new AbortedError();
};
const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(new AbortedError());
        const id = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(id);
            reject(new AbortedError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });

// --- Round handlers now accept AbortSignal ---
type RoundHandler = (signal: AbortSignal) => Promise<void>;

const roundMapper: Record<Round, RoundHandler> = {
    [Round.Start]: onStartHandler,
    [Round.Fall]: onFallHandler,
    [Round.Wait]: onWaitHandler,
    [Round.End]: onEndHandler,
};

async function onStartHandler(signal: AbortSignal): Promise<void> {
    console.error('onStartHandler > start');
    throwIfAborted(signal);
    await sleep(1000, signal);
    console.error('onStartHandler > part 1 anim done');
    await sleep(1000, signal);
    console.error('onStartHandler > part 2 anim done');
    await sleep(1000, signal);
    console.error('onStartHandler > done');
}

async function onFallHandler(signal: AbortSignal): Promise<void> {
    console.error('onFallHandler > start');
    throwIfAborted(signal);
    await sleep(1000, signal);
    console.error('onFallHandler > part 1 anim done');
    await sleep(1000, signal);
    console.error('onFallHandler > part 2 anim done');
    await sleep(1000, signal);
    console.error('onFallHandler > done');
}

async function onWaitHandler(signal: AbortSignal): Promise<void> {
    console.error('onWaitHandler > start');
    throwIfAborted(signal);
    await sleep(1000, signal);
    console.error('onWaitHandler > part 1 anim done');
    await sleep(1000, signal);
    console.error('onWaitHandler > part 2 anim done');
    await sleep(1000, signal);
    console.error('onWaitHandler > done');
}

async function onEndHandler(signal: AbortSignal): Promise<void> {
    console.error('onEndHandler > start');
    throwIfAborted(signal);
    await sleep(1000, signal);
    console.error('onEndHandler > part 1 anim done');
    await sleep(1000, signal);
    console.error('onEndHandler > part 2 anim done');
    await sleep(1000, signal);
    console.error('onEndHandler > done');
}

document.addEventListener('visibilitychange', (e: Event) => {
    console.error('visibilitychange', e);
});

onMounted(() => {
    startRandomEmitter(Round, async (val) => {
        if (inFlight && currentController) {
            currentController.abort();
            try {
                await currentRun;
            } catch {}
        }

        currentController = new AbortController();
        const signal = currentController.signal;
        inFlight = true;

        console.log('Random enum value:', val);

        currentRun = roundMapper[val](signal)
            .catch((err) => {
                if (err?.name === 'AbortedError') {
                    console.warn(`round ${val} aborted`);
                    return;
                }
                console.error(err);
            })
            .finally(() => {
                inFlight = false;
                currentController = null;
            });

        await currentRun;
    });
});
</script>
