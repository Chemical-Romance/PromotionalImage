import type { DeviceDef, DeviceFrame, FrameScreenRect } from '../types';
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
  frame?: unknown;
  ratio?: unknown;
}

function isValid(entry: RawFrameDevice): boolean {
  const idOK = typeof entry.id === 'string' && Boolean(entry.id);
  if (!idOK) return false;
  const hasImage = typeof entry.image === 'string' && Boolean(entry.image);
  // 有 image 就必须有合法的 screen 区域
  if (hasImage) {
    const s = entry.screen;
    return (
      Boolean(s) &&
      Number.isFinite(Number(s?.x)) &&
      Number.isFinite(Number(s?.y)) &&
      Number.isFinite(Number(s?.w)) &&
      Number.isFinite(Number(s?.h)) &&
      Number(s?.w) > 0 &&
      Number(s?.h) > 0
    );
  }
  // 无 image：要么是内置 id（DEVICES 里能找到，自动补 frame/ratio），
  //        要么显式提供 frame + ratio 两个字段
  const builtIn = DEVICES.find((d) => d.id === entry.id);
  if (builtIn) return true;
  const hasFrame =
    typeof entry.frame === 'string' &&
    ['island', 'notch', 'se', 'ipad', 'macbook', 'imac', 'none'].includes(entry.frame);
  const hasRatio = Number.isFinite(Number(entry.ratio)) && Number(entry.ratio) > 0;
  return hasFrame && hasRatio;
}

/**
 * Loads device mockups from /frames/devices.json.
 * Supports two kinds of entries:
 *   - Custom image-based mockups: provide image + screen; frame is always 'image'.
 *   - Built-in style devices: no image, provide frame + ratio + name + note,
 *     or just use a known built-in id (frame/ratio will be filled from DEVICES).
 * The order in devices.json is the order shown in the left panel.
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

  // Preload image-based entries only
  const imageSrcs: string[] = [];
  for (const entry of entries) {
    if (typeof entry.image === 'string' && Boolean(entry.image)) {
      imageSrcs.push(String(entry.image));
    }
  }
  await preload(imageSrcs);

  const builtInMap = new Map(DEVICES.map((d) => [d.id, d]));

  // Preserve JSON order — the first valid entry with a given id wins.
  const byId = new Map<string, DeviceDef>();

  for (const entry of entries) {
    const id = String(entry.id);
    const builtIn = builtInMap.get(id);

    const name = String(entry.name ?? builtIn?.name ?? id);
    const note = String(entry.note ?? builtIn?.note ?? '自定义模型');

    if (typeof entry.image === 'string' && Boolean(entry.image)) {
      // Image-based custom device
      const src = String(entry.image);
      const img = getImage(src);
      if (!img) continue;
      const screen = entry.screen!;
      byId.set(id, {
        id,
        name,
        note,
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
    } else {
      // Built-in style device (no custom image)
      const frame =
        (entry.frame as DeviceFrame | undefined) ?? builtIn?.frame ?? 'island';
      const ratio = Number(entry.ratio) || builtIn?.ratio || 1;
      byId.set(id, { id, name, note, ratio, frame });
    }
  }

  return [...byId.values()];
}
