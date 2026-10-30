import type {
  BgAlign,
  DeviceDef,
  DeviceSlot,
  DeviceState,
  GradientPreset,
  IllustrationKind,
  Project,
  SizePreset,
  Slide,
  TextPos,
} from './types';
import { uid } from './lib/utils';
import { FONT_SANS } from './lib/fonts';

export const DEVICES: DeviceDef[] = [
  { id: 'iphone15', name: 'iPhone 15 Pro', note: '灵动岛 · 6.7″', ratio: 0.483, frame: 'island' },
  { id: 'ipad', name: 'iPad Pro', note: '12.9″ 竖屏', ratio: 0.755, frame: 'ipad' },
  { id: 'none', name: '无边框', note: '纯截图卡片', ratio: 0.4613, frame: 'none' },
];

export const SIZES: SizePreset[] = [
  { id: 'as69', label: 'App Store 6.9″', note: '1320 × 2868', w: 1320, h: 2868 },
  { id: 'as65', label: 'App Store 6.5″', note: '1284 × 2778', w: 1284, h: 2778 },
  { id: 'as55', label: 'App Store 5.5″', note: '1242 × 2208', w: 1242, h: 2208 },
  { id: 'ipad13', label: 'iPad 13″', note: '2064 × 2752', w: 2064, h: 2752 },
  { id: 'wecom', label: '企微电脑版', note: '1080 × 832', w: 1080, h: 832 },
  { id: 'feishu', label: '飞书电脑版', note: '1600 × 1000', w: 1600, h: 1000 },
  { id: 'xhs', label: '小红书 3:4', note: '1080 × 1440', w: 1080, h: 1440 },
  { id: 'ins', label: 'Instagram 4:5', note: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'story', label: '竖屏 9:16', note: '1080 × 1920', w: 1080, h: 1920 },
];

export const GRADIENTS: GradientPreset[] = [
  { id: 'indigo', name: '靛蓝', from: '#5B5BF0', to: '#9D5CF5', angle: 150 },
  { id: 'midnight', name: '午夜', from: '#0E1526', to: '#2A3550', angle: 160 },
  { id: 'sunset', name: '日落', from: '#FF7A59', to: '#F2B880', angle: 150 },
  { id: 'mint', name: '薄荷', from: '#3DDC97', to: '#1F8A70', angle: 150 },
  { id: 'sakura', name: '樱花', from: '#F7A8C4', to: '#B78BF0', angle: 150 },
  { id: 'ocean', name: '深海', from: '#124E78', to: '#0EA5A5', angle: 160 },
  { id: 'forest', name: '森林', from: '#043D2E', to: '#1E9E6A', angle: 150 },
  { id: 'graphite', name: '石墨', from: '#1C1F26', to: '#404652', angle: 160 },
  { id: 'aurora', name: '极光', from: '#22D3EE', to: '#818CF8', angle: 150 },
  { id: 'cream', name: '奶油', from: '#F6EDDC', to: '#EFD9B4', angle: 150 },
  { id: 'peach', name: '蜜桃', from: '#FFB199', to: '#FF6A88', angle: 150 },
  { id: 'twilight', name: '暮光', from: '#667EEA', to: '#764BA2', angle: 150 },
  { id: 'emerald', name: '翡翠', from: '#11998E', to: '#38EF7D', angle: 150 },
  { id: 'galaxy', name: '星河', from: '#0F2027', to: '#2C5364', angle: 160 },
  { id: 'coral', name: '珊瑚', from: '#FF512F', to: '#F09819', angle: 150 },
  { id: 'lavender', name: '薰衣草', from: '#E0C3FC', to: '#8EC5FC', angle: 150 },
  { id: 'sunrise', name: '日出', from: '#FA709A', to: '#FEE140', angle: 150 },
  { id: 'deepocean', name: '深海蓝', from: '#000428', to: '#004E92', angle: 160 },
  { id: 'haze', name: '雾霭', from: '#B8C6DB', to: '#4A5568', angle: 150 },
];

export interface SolidPreset {
  id: string;
  name: string;
  color: string;
}

export const BG_SOLIDS: SolidPreset[] = [
  { id: 'white', name: '纯白', color: '#FFFFFF' },
  { id: 'soft-white', name: '米白', color: '#F5F0E8' },
  { id: 'warm-beige', name: '暖米', color: '#E8DCC4' },
  { id: 'cream', name: '奶油', color: '#F0E6D2' },
  { id: 'sand', name: '沙色', color: '#D4C5A9' },
  { id: 'light-gray', name: '浅灰', color: '#E5E7EB' },
  { id: 'slate', name: '石板灰', color: '#94A3B8' },
  { id: 'charcoal', name: '炭灰', color: '#374151' },
  { id: 'ink', name: '墨黑', color: '#111827' },
  { id: 'midnight', name: '午夜', color: '#0B1220' },
  { id: 'indigo', name: '靛蓝', color: '#5B5BF0' },
  { id: 'royal', name: '皇家蓝', color: '#2563EB' },
  { id: 'sky', name: '天蓝', color: '#38BDF8' },
  { id: 'teal', name: '青碧', color: '#14B8A6' },
  { id: 'emerald', name: '翠绿', color: '#10B981' },
  { id: 'mint', name: '薄荷', color: '#6EE7B7' },
  { id: 'lime', name: '柠檬绿', color: '#A3E635' },
  { id: 'yellow', name: '明黄', color: '#FACC15' },
  { id: 'orange', name: '橙色', color: '#F97316' },
  { id: 'coral', name: '珊瑚', color: '#FB7185' },
  { id: 'pink', name: '粉色', color: '#EC4899' },
  { id: 'magenta', name: '洋红', color: '#D946EF' },
  { id: 'purple', name: '紫色', color: '#8B5CF6' },
  { id: 'violet', name: '紫罗兰', color: '#6366F1' },
  { id: 'rose', name: '玫红', color: '#F43F5E' },
  { id: 'amber', name: '琥珀', color: '#F59E0B' },
  { id: 'chartreuse', name: '青绿', color: '#84CC16' },
  { id: 'cyan', name: '青色', color: '#06B6D4' },
  { id: 'maroon', name: '栗色', color: '#7C2D12' },
];

export const TEXT_COLORS = ['#FFFFFF', '#0B1020', '#F8E7C9', '#FFD84D', '#8FD3FF', '#FF6B6B', '#4ECDC4', '#95E1D3'];

export const BG_ALIGNS: Array<{ value: BgAlign; label: string }> = [
  { value: 'top-left', label: '左上' },
  { value: 'top', label: '上' },
  { value: 'top-right', label: '右上' },
  { value: 'left', label: '左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom', label: '下' },
  { value: 'bottom-right', label: '右下' },
];

export const STICKER_COLORS = [
  '#FFFFFF',
  '#FFD84D',
  '#FF8A3D',
  '#FF5D7A',
  '#7C8CFF',
  '#22D3EE',
  '#34D399',
  '#111827',
];

export interface StickerDef {
  kind: Exclude<IllustrationKind, 'image' | 'emoji'>;
  name: string;
  color: string;
  glyph: string;
}

export const STICKERS: StickerDef[] = [
  { kind: 'star', name: '星星', color: '#FFD84D', glyph: '★' },
  { kind: 'spark', name: '闪光', color: '#FFFFFF', glyph: '✦' },
  { kind: 'circle', name: '圆形', color: '#7C8CFF', glyph: '●' },
  { kind: 'heart', name: '爱心', color: '#FF5D7A', glyph: '♥' },
  { kind: 'squiggle', name: '波浪', color: '#FFFFFF', glyph: '∿' },
  { kind: 'burst', name: '爆炸', color: '#FFB020', glyph: '✹' },
];

export const EMOJIS = ['✨', '🔥', '⭐', '💡', '❤️', '🎉', '🚀', '👍'];

export const LAYER_NAMES: Record<IllustrationKind, string> = {
  image: '图片',
  star: '星星',
  spark: '闪光',
  circle: '圆形',
  heart: '爱心',
  squiggle: '波浪',
  burst: '爆炸',
  emoji: '表情',
};

export function createSlide(partial: Partial<Slide> = {}): Slide {
  return {
    id: uid(),
    title: '',
    subtitle: '',
    bg: {
      type: 'gradient',
      gradient: 'indigo',
      color: '#6366F1',
      fit: 'cover',
      align: 'center',
      dim: 0,
    },
    illustrations: [],
    ...partial,
  };
}

export function defaultDeviceState(index: number): DeviceState {
  if (index === 0) {
    return { fit: 'cover', scale: 1, x: 0, y: 0 };
  }
  if (index === 1) {
    return { fit: 'cover', scale: 0.82, x: 0.16, y: -0.02 };
  }
  return {
    fit: 'cover',
    scale: 0.72,
    x: index % 2 === 0 ? -0.16 : 0.16,
    y: 0.02,
  };
}

export function getDeviceState(
  slide: Slide,
  slotId: string,
  index: number,
): DeviceState {
  return { ...defaultDeviceState(index), ...(slide.deviceStates?.[slotId] ?? {}) };
}

/** Prefer slide.devices, fall back to project.devices for legacy projects. */
export function resolveDevices(slide: Slide, project: Project): DeviceSlot[] {
  return slide.devices ?? project.devices ?? [];
}

/** Resolve slide text layout, falling back to project defaults. */
export function resolveTextStyle(slide: Slide, project: Project) {
  return {
    textPos: slide.textPos ?? project.textPos,
    align: slide.align ?? project.align,
    font: slide.font ?? project.font,
    textColor: slide.textColor ?? project.textColor,
    titleScale: slide.titleScale ?? project.titleScale,
    subtitleScale: slide.subtitleScale ?? project.subtitleScale,
    textOffset: slide.textOffset ?? project.textOffset,
    textAreaW: slide.textAreaW ?? project.textAreaW,
  };
}

/** Ensure the active slide has its own devices array, copying from project if needed. */
export function ensureSlideDevices(slide: Slide, project: Project): DeviceSlot[] {
  if (slide.devices) return slide.devices;
  return (project.devices ?? []).map((s) => ({ ...s }));
}

export function createInitialProject(): Project {
  const slot: DeviceSlot = { id: uid(), device: 'iphone15' };
  return {
    size: { w: 1320, h: 2868 },
    devices: [slot],
    textPos: 'top',
    align: 'center',
    font: FONT_SANS,
    textColor: '#FFFFFF',
    titleScale: 1,
    subtitleScale: 1,
    slides: [
      createSlide({
        title: '更聪明地安排每一天',
        subtitle: '清晰的时间线，让每个任务各得其所',
      }),
    ],
  };
}

/** Parse #RRGGBB or #RGB to [r, g, b] 0-255. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return [128, 128, 128];
}

/** Relative luminance per WCAG 2.1. */
export function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/** Pick white or near-black text color based on background luminance. */
export function pickTextColor(bgHex: string, light = '#FFFFFF', dark = '#0B1020'): string {
  const [r, g, b] = hexToRgb(bgHex);
  return luminance(r, g, b) > 0.45 ? dark : light;
}

/** Sample a linear gradient at a given point on a 0..1 canvas. */
export function sampleGradient(
  fromHex: string,
  toHex: string,
  angleDeg: number,
  py: number,
  px = 0.5,
): string {
  // Match drawBackground: angle is the direction vector of the gradient axis
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Point relative to canvas center (0.5, 0.5)
  const rx = px - 0.5;
  const ry = py - 0.5;
  // Project onto gradient axis; map [-0.5..0.5] → [0..1]
  const axisLen = dx * dx + dy * dy; // = 1 since dx,dy from unit circle
  const t = Math.max(0, Math.min(1, (rx * dx + ry * dy) / axisLen + 0.5));
  const [r1, g1, b1] = hexToRgb(fromHex);
  const [r2, g2, b2] = hexToRgb(toHex);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Given current project state and a bg change (gradient id or solid color),
 * pick the best text color based on where text sits.
 */
export function pickTextForBg(
  bgType: 'gradient' | 'solid' | 'image',
  gradientId: string,
  solidColor: string,
  textPos: TextPos,
): string {
  if (bgType === 'image') return '#FFFFFF';
  const sampleY =
    textPos === 'top' ? 0.062 : textPos === 'bottom' ? 0.938 : textPos === 'side' ? 0.5 : 0.5;
  const sampleX = textPos === 'side' ? 0.25 : 0.5;
  if (bgType === 'solid') {
    return pickTextColor(solidColor);
  }
  const g = GRADIENTS.find((x) => x.id === gradientId);
  if (!g) return '#FFFFFF';
  const sampled = sampleGradient(g.from, g.to, g.angle, sampleY, sampleX);
  return pickTextColor(sampled);
}
