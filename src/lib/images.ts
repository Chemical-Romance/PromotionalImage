import type { DeviceDef, Project, Slide } from '../types';
import { resolveDevices } from '../data';

interface Entry {
  img?: HTMLImageElement;
  failed?: boolean;
  started?: boolean;
  waiting?: Array<() => void>;
}

const store = new Map<string, Entry>();

function entryFor(src: string): Entry {
  let entry = store.get(src);
  if (!entry) {
    entry = {};
    store.set(src, entry);
  }
  return entry;
}

export function getImage(src?: string): HTMLImageElement | null {
  if (!src) return null;
  const entry = store.get(src);
  if (entry?.img && entry.img.complete && entry.img.naturalWidth > 0) return entry.img;
  if (!entry) return null;
  return entry.img ?? null;
}

export function isLoaded(src: string): boolean {
  const entry = store.get(src);
  return Boolean(entry?.img && entry.img.complete && entry.img.naturalWidth > 0);
}

export function isFailed(src: string): boolean {
  return Boolean(store.get(src)?.failed);
}

export function loadImage(src: string, onDone?: () => void): void {
  if (!src) {
    onDone?.();
    return;
  }
  const entry = entryFor(src);
  if (entry.img || entry.failed) {
    onDone?.();
    return;
  }
  if (onDone) {
    entry.waiting = entry.waiting ?? [];
    entry.waiting.push(onDone);
  }
  if (entry.started) return;
  entry.started = true;

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    entry.img = img;
    const cbs = entry.waiting ?? [];
    entry.waiting = [];
    cbs.forEach((cb) => cb());
  };
  img.onerror = () => {
    entry.failed = true;
    const cbs = entry.waiting ?? [];
    entry.waiting = [];
    cbs.forEach((cb) => cb());
  };
  img.src = src;
}

export function preload(srcs: string[]): Promise<void> {
  const unique = Array.from(new Set(srcs.filter((s): s is string => Boolean(s))));
  return Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          loadImage(src, resolve);
        }),
    ),
  ).then(() => undefined);
}

export function slideImageSources(slide: Slide): string[] {
  const out: string[] = [];
  for (const state of Object.values(slide.deviceStates ?? {})) {
    if (state.screenshot) out.push(state.screenshot);
  }
  if (slide.bg.type === 'image' && slide.bg.image) out.push(slide.bg.image);
  for (const el of slide.illustrations) {
    if (el.src) out.push(el.src);
  }
  return out;
}

/** image files of the device mockups used by this slide */
export function slideFrameSources(
  project: Project,
  slide: Slide,
  devices: DeviceDef[],
): string[] {
  const out: string[] = [];
  for (const slot of resolveDevices(slide, project)) {
    const src = devices.find((device) => device.id === slot.device)?.image?.image;
    if (src) out.push(src);
  }
  return out;
}
