export const FONT_SANS =
  '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
export const FONT_SERIF =
  '"Songti SC", "Noto Serif SC", "SimSun", Georgia, "Times New Roman", serif';

export function fontFamilyValue(family: string): string {
  return `"${family.replace(/"/g, '')}"`;
}

/** older projects stored 'sans' | 'serif'; keep them working */
export function resolveFont(font: string | undefined): string {
  if (!font || font === 'sans') return FONT_SANS;
  if (font === 'serif') return FONT_SERIF;
  return font;
}

export interface FontChoice {
  label: string;
  value: string;
  /** family name used to check whether it is installed */
  family?: string;
}

function family(label: string, name: string): FontChoice {
  return { label, value: fontFamilyValue(name), family: name };
}

export const COMMON_FONTS: FontChoice[] = [
  { label: '系统默认（黑体）', value: FONT_SANS },
  { label: '系统默认（宋体）', value: FONT_SERIF },
  family('微软雅黑', 'Microsoft YaHei'),
  family('微软雅黑 Light', 'Microsoft YaHei Light'),
  family('苹方', 'PingFang SC'),
  family('思源黑体', 'Noto Sans SC'),
  family('思源宋体', 'Noto Serif SC'),
  family('黑体', 'SimHei'),
  family('宋体', 'SimSun'),
  family('楷体', 'KaiTi'),
  family('仿宋', 'FangSong'),
  family('等线', 'DengXian'),
  family('幼圆', 'YouYuan'),
  family('华文黑体', 'STHeiti'),
  family('华文宋体', 'STSong'),
  family('华文楷体', 'STKaiti'),
  family('Arial', 'Arial'),
  family('Helvetica', 'Helvetica'),
  family('Segoe UI', 'Segoe UI'),
  family('Georgia', 'Georgia'),
  family('Times New Roman', 'Times New Roman'),
  family('Impact', 'Impact'),
  family('Consolas', 'Consolas'),
];

const OTHER_FALLBACK_NAMES = [
  // Chinese fonts commonly installed on Windows / macOS
  'NSimSun',
  'STXihei',
  'STHupo',
  'STCaiyun',
  'STXinwei',
  'STXingkai',
  'STLiti',
  'LiSu',
  'Microsoft YaHei UI',
  'DengXian Light',
  'FZShuTi',
  'FZYaoti',
  // Latin fonts
  'Arial Black',
  'Bahnschrift',
  'Baskerville Old Face',
  'Bodoni MT',
  'Book Antiqua',
  'Bookman Old Style',
  'Calibri',
  'Calibri Light',
  'Cambria',
  'Candara',
  'Century',
  'Century Gothic',
  'Century Schoolbook',
  'Comic Sans MS',
  'Copperplate Gothic',
  'Corbel',
  'Courier New',
  'Franklin Gothic',
  'Gabriola',
  'Garamond',
  'Gill Sans MT',
  'Gloucester MT',
  'High Tower Text',
  'Lucida Bright',
  'Lucida Calligraphy',
  'Lucida Console',
  'Lucida Fax',
  'Lucida Handwriting',
  'Lucida Sans',
  'Lucida Sans Typewriter',
  'MS Gothic',
  'MS PGothic',
  'Modern No. 20',
  'Monotype Corsiva',
  'OCR A Extended',
  'Palatino Linotype',
  'Papyrus',
  'Perpetua',
  'Pristina',
  'Rockwell',
  'Script MT Bold',
  'Segoe Print',
  'Segoe Script',
  'Showcard Gothic',
  'Stencil',
  'Tahoma',
  'Tempus Sans ITC',
  'Trebuchet MS',
  'Tw Cen MT',
  'Verdana',
  'Vivaldi',
  'Wide Latin',
];

export const FALLBACK_OTHER_FONTS: FontChoice[] = OTHER_FALLBACK_NAMES.map((name) =>
  family(name, name),
);

interface LocalFontData {
  family?: string;
  fullName?: string;
}

type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
};

let cachedSystemFonts: string[] = [];

export function getCachedSystemFonts(): string[] {
  return cachedSystemFonts;
}

/**
 * Reads fonts installed on the machine (Chromium only, asks for permission).
 */
export async function loadSystemFonts(): Promise<string[]> {
  const api = (window as LocalFontWindow).queryLocalFonts;
  if (typeof api !== 'function') throw new Error('unsupported');

  const list = await api.call(window);
  const unique = new Map<string, string>();
  for (const item of list) {
    const name = (item.family || item.fullName || '').trim();
    if (name) unique.set(name.toLowerCase(), name);
  }
  cachedSystemFonts = [...unique.values()].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  );
  return cachedSystemFonts;
}
