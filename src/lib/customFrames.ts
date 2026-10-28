import type { DeviceDef, FrameScreenRect } from '../types';
import { DEVICES } from '../data';
import { getImage, preload } from './images';

interface RawFrameDevice {
  id?: unknown;
  name?: unknown;
  note?: unknown;
  image?: unknown;
  screen?: Partial<FrameScreenRect>;
  mode?: unknown;
  shadow?: unknown;
}

function isValid(entry: RawFrameDevice): boolean {
  const screen = entry.screen;
  return (
    typeof entry.id === 'string' &&
    typeof entry.image === 'string' &&
    Boolean(entry.image) &&
    Boolean(screen) &&
    Number.isFinite(Number(screen?.x)) &&
    Number.isFinite(Number(screen?.y)) &&
    Number.isFinite(Number(screen?.w)) &&
    Number.isFinite(Number(screen?.h)) &&
    Number(screen?.w) > 0 &&
    Number(screen?.h) > 0
  );
}

/**
 * Loads optional custom device mockups from /frames/devices.json.
 * The image itself can be a png/svg/webp placed under /public/frames.
 */
export async function loadCustomFrameDevices(): Promise<DeviceDef[]> {
  let payload: unknown;
  try {
    const response = await fetch('/frames/devices.json', { cache: 'no-store' });
    if (!response.ok) return [];
    payload = await response.json();
  } catch {
    return [];
  }

  const rawList = (payload as { devices?: unknown })?.devices;
  if (!Array.isArray(rawList)) return [];

  const entries = (rawList as RawFrameDevice[]).filter(isValid);
  await preload(entries.map((entry) => String(entry.image)));

  const builtIns = new Map(DEVICES.map((device) => [device.id, device]));
  const byId = new Map<string, DeviceDef>();

  for (const entry of entries) {
    const id = String(entry.id);
    const src = String(entry.image);
    const img = getImage(src);
    if (!img) continue;
    const screen = entry.screen!;
    const builtIn = builtIns.get(id);
    byId.set(id, {
      id,
      name: String(entry.name || builtIn?.name || id),
      note: String(entry.note || builtIn?.note || '自定义模型'),
      ratio: img.naturalWidth / img.naturalHeight,
      frame: 'image',
      image: {
        image: src,
        screen: {
          x: Number(screen.x) || 0,
          y: Number(screen.y) || 0,
          w: Number(screen.w),
          h: Number(screen.h),
          radius: Number(screen.radius) || 0,
        },
        mode: entry.mode === 'over' ? 'over' : 'under',
        shadow: entry.shadow === true,
      },
    });
  }

  return [...byId.values()];
}
