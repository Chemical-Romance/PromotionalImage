/**
 * 从自然语言中提取颜色关键词，返回 HEX 色值。
 * 支持中英文、常见色系、具体色值输入。
 */
const COLOR_MAP: Record<string, string> = {
  // 红
  red: '#E63946', 红色: '#E63946', 大红: '#D62828', 暗红: '#7A1F1F', 酒红: '#6B1C33',
  粉红: '#FF6B9D', 粉: '#FFB6C1', rose: '#FF6B9D', pink: '#FFB6C1',
  珊瑚红: '#FF6B6B', 番茄: '#FF6347',
  // 橙
  orange: '#FF7A59', 橙色: '#FF7A59', 橘色: '#FF8C42', 琥珀: '#F59E0B', 日落橙: '#F2B880',
  // 黄
  yellow: '#FBBF24', 黄色: '#FBBF24', 金黄: '#F59E0B', 鹅黄: '#FEF08A', 柠檬: '#FFF44F',
  // 绿
  green: '#1F8A70', 绿色: '#1F8A70', 草绿: '#22C55E', 墨绿: '#043D2E', 薄荷绿: '#4ECDC4',
  抹茶绿: '#95E1D3', 森林绿: '#1E9E6A', emerald: '#11998E',
  // 青
  cyan: '#22D3EE', 青色: '#22D3EE', 薄荷青: '#4ECDC4', 蒂芙尼: '#81D8D0',
  // 蓝
  blue: '#3B82F6', 蓝色: '#3B82F6', 天蓝: '#87CEEB', 深蓝: '#1E40AF', 藏青: '#0E1526',
  靛蓝: '#5B5BF0', 海军蓝: '#0A192F', 湖蓝: '#0EA5A5', 宝蓝: '#2563EB',
  午夜蓝: '#0E1526', midnight: '#0E1526', indigo: '#5B5BF0',
  // 紫
  purple: '#8B5CF6', 紫色: '#8B5CF6', 紫罗兰: '#7C3AED', 薰衣草: '#E0C3FC',
  丁香紫: '#B78BF0', 深紫: '#6B21A8', violet: '#7C3AED',
  // 粉紫
  樱花: '#F7A8C4', 樱花粉: '#F7A8C4', 桃粉: '#FFB199',
  // 棕
  brown: '#92400E', 棕色: '#92400E', 咖啡: '#6F4E37', 驼色: '#C19A6B', 奶茶: '#D4A574',
  // 白/灰/黑
  white: '#FFFFFF', 白色: '#FFFFFF', 纯白: '#FFFFFF', 米白: '#F6EDDC', 奶油: '#F6EDDC',
  gray: '#6B7280', 灰色: '#6B7280', 浅灰: '#D1D5DB', 深灰: '#374151',
  black: '#111827', 黑色: '#111827', 纯黑: '#000000', 石墨: '#1C1F26',
};

/** 从文本中提取第一个匹配的颜色关键词 */
export function extractColor(text: string): string | null {
  const lower = text.toLowerCase();
  // 先匹配具体 HEX/RGB
  const hexMatch = text.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    return '#' + hex.toUpperCase();
  }
  const rgbMatch = text.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1);
    return rgbToHex(+r, +g, +b);
  }
  // 关键词匹配：长的先匹配（避免"蓝"吞掉"靛蓝"）
  const keys = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key.toLowerCase())) return COLOR_MAP[key];
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** 在主色调基础上生成渐变背景，根据色相调整角度和对比度 */
export function generateGradient(primary: string): { from: string; to: string; angle: number } {
  const hsl = hexToHsl(primary);
  const h = hsl.h;

  // 按色相区间选渐变角度和对比度策略
  let angle = 150;
  let fromDL = -15;  // 起点亮度偏移（负数 = 更深）
  let toDL = +20;    // 终点亮度偏移（正数 = 更浅）
  let fromS = clamp(hsl.s, 40, 95);
  let toS = clamp(hsl.s, 30, 90);

  if ((h >= 0 && h < 30) || h >= 340) {
    // 红色/橙红系：暖色，135° 对角更有冲击力，加大深浅对比
    angle = 135;
    fromDL = -22;
    toDL = +28;
    fromS = clamp(hsl.s, 50, 95);
    toS = clamp(hsl.s, 35, 90);
  } else if (h >= 30 && h < 60) {
    // 橙黄系：120° 横向对角，柔和对比
    angle = 120;
    fromDL = -18;
    toDL = +22;
  } else if (h >= 180 && h < 260) {
    // 蓝/青系：冷色，150° 沉稳，适中对比
    angle = 150;
    fromDL = -18;
    toDL = +22;
  } else if (h >= 260 && h < 320) {
    // 紫/粉紫系：120° 优雅，中等对比
    angle = 120;
    fromDL = -20;
    toDL = +24;
  } else if (h >= 90 && h < 170) {
    // 绿系：150° 自然
    angle = 150;
    fromDL = -16;
    toDL = +20;
  }

  const from = hslToHex(h, fromS, clamp(hsl.l + fromDL, 12, 62));
  const to = hslToHex(h, toS, clamp(hsl.l + toDL, 42, 92));
  return { from, to, angle };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const s1 = s / 100, l1 = l / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (0 <= hp && hp < 1) [r, g, b] = [c, x, 0];
  else if (1 <= hp && hp < 2) [r, g, b] = [x, c, 0];
  else if (2 <= hp && hp < 3) [r, g, b] = [0, c, x];
  else if (3 <= hp && hp < 4) [r, g, b] = [0, x, c];
  else if (4 <= hp && hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l1 - c / 2;
  const to255 = (v: number) => Math.round((v + m) * 255);
  return rgbToHex(to255(r), to255(g), to255(b));
}
