import type {
  Background,
  DeviceDef,
  DeviceSlot,
  DeviceState,
  Illustration,
  Project,
  ShotFit,
  Slide,
} from '../types';
import { DEVICES, GRADIENTS, getDeviceState, resolveDevices, resolveTextStyle } from '../data';
import { getImage } from './images';
import { wrapText } from './text';
import { FONT_SANS, resolveFont } from './fonts';

const TAU = Math.PI * 2;

const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TextLayout {
  titleSize: number;
  subSize: number;
  titleLH: number;
  subLH: number;
  gap: number;
  titleLines: string[];
  subLines: string[];
  height: number;
  width: number;
  x: number;
  y: number;
  align: 'center' | 'left';
}

export function withAlpha(hex: string, alpha: number): string {
  let h = (hex || '#ffffff').replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function alignOffset(
  containerW: number,
  containerH: number,
  contentW: number,
  contentH: number,
  align: Background['align'],
): { x: number; y: number } {
  let x = (containerW - contentW) / 2;
  let y = (containerH - contentH) / 2;
  if (align === 'left' || align.endsWith('-left')) x = 0;
  if (align === 'right' || align.endsWith('-right')) x = containerW - contentW;
  if (align === 'top' || align.startsWith('top-')) y = 0;
  if (align === 'bottom' || align.startsWith('bottom-')) y = containerH - contentH;
  return { x, y };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bg: Background,
): void {
  const img = bg.type === 'image' && bg.image ? getImage(bg.image) : null;

  if (img) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, W, H);
    if (iw && ih) {
      const fit = bg.fit ?? 'cover';
      if (fit === 'stretch') {
        ctx.drawImage(img, 0, 0, W, H);
      } else {
        const scale =
          fit === 'contain'
            ? Math.min(W / iw, H / ih)
            : Math.max(W / iw, H / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const pos = alignOffset(W, H, dw, dh, bg.align ?? 'center');
        ctx.drawImage(img, pos.x, pos.y, dw, dh);
      }
    }
  } else if (bg.type === 'solid') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === 'image') {
    ctx.fillStyle = '#12141b';
    ctx.fillRect(0, 0, W, H);
  } else {
    // 支持预设 id（如 "indigo"）和自定义 CSS linear-gradient 字符串
    let from: string, to: string, angle: number;
    const preset = GRADIENTS.find((g) => g.id === bg.gradient);
    if (preset) {
      from = preset.from;
      to = preset.to;
      angle = preset.angle;
    } else {
      // 解析 "linear-gradient(135deg, #9B141E, #F6B8BC)" 格式
      const m = (bg.gradient || '').match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg\s*,\s*([^,]+)\s*,\s*([^)]+)\)/);
      if (m) {
        angle = parseFloat(m[1]);
        from = m[2].trim();
        to = m[3].trim();
      } else {
        // 兜底：用第一个预设
        from = GRADIENTS[0].from;
        to = GRADIENTS[0].to;
        angle = GRADIENTS[0].angle;
      }
    }
    const rad = (angle * Math.PI) / 180;
    const cx = W / 2;
    const cy = H / 2;
    const len = Math.abs(W * Math.cos(rad)) + Math.abs(H * Math.sin(rad));
    const dx = (Math.cos(rad) * len) / 2;
    const dy = (Math.sin(rad) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, from);
    grad.addColorStop(1, to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // soft top-left highlight for depth
  const glow = ctx.createRadialGradient(W * 0.16, H * 0.06, 0, W * 0.16, H * 0.06, W * 0.95);
  glow.addColorStop(0, img ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.14)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (bg.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, Math.max(0, bg.dim))})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function computeTextLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: Project,
  slide: Slide,
): TextLayout | null {
  const t = resolveTextStyle(slide, project);
  if (t.textPos === 'none') return null;
  const title = slide.title.trim();
  const sub = slide.subtitle.trim();
  if (!title && !sub) return null;

  const side = t.textPos === 'side';
  const family = resolveFont(t.font);
  const titleSize = Math.round(
    (side ? W * 0.046 : W * 0.074) * t.titleScale,
  );
  const subSize = Math.round(
    (side ? W * 0.023 : W * 0.033) * t.subtitleScale,
  );

  // 可配置的文字区域
  const areaW = t.textAreaW ?? (side ? 0.42 : 0.84);
  const columnX = W * 0.058;
  const columnW = W * areaW;
  const maxW = side ? columnW : W * areaW;

  ctx.font = `800 ${titleSize}px ${family}`;
  const titleLines = title ? wrapText(ctx, title, maxW) : [];

  ctx.font = `400 ${subSize}px ${family}`;
  const subLines = sub
    ? wrapText(ctx, sub, side ? columnW : maxW * 0.92)
    : [];

  const titleLH = titleSize * 1.16;
  const subLH = subSize * 1.5;
  const gap = titleLines.length && subLines.length ? subSize * 0.95 : 0;
  const height = titleLines.length * titleLH + gap + subLines.length * subLH;
  const centered = t.align === 'center';

  // 基础位置
  let baseX: number, baseY: number;
  if (side) {
    baseX = centered ? columnX + columnW / 2 : columnX;
    baseY = H / 2 - height / 2;
  } else if (t.textPos === 'top') {
    baseX = centered ? W / 2 : W * 0.08;
    baseY = H * 0.062;
  } else {
    baseX = centered ? W / 2 : W * 0.08;
    baseY = Math.max(H * 0.02, H * 0.938 - height);
  }

  // 应用用户手动偏移
  const ox = (t.textOffset?.x ?? 0) * W;
  const oy = (t.textOffset?.y ?? 0) * H;
  const x = baseX + ox;
  const y = baseY + oy;

  return {
    titleSize,
    subSize,
    titleLH,
    subLH,
    gap,
    titleLines,
    subLines,
    height,
    width: maxW,
    x,
    y,
    align: centered ? 'center' : 'left',
  };
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  W: number,
  project: Project,
  slide: Slide,
  layout: TextLayout,
): void {
  const t = resolveTextStyle(slide, project);
  const family = resolveFont(t.font);
  const centered = layout.align === 'center';
  const x = layout.x;

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = centered ? 'center' : 'left';

  let y = layout.y;
  if (layout.titleLines.length) {
    ctx.font = `800 ${layout.titleSize}px ${family}`;
    ctx.fillStyle = t.textColor;
    const trackable = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    try {
      trackable.letterSpacing = `${-layout.titleSize * 0.02}px`;
    } catch {
      /* older engines */
    }
    for (const line of layout.titleLines) {
      ctx.fillText(line, x, y);
      y += layout.titleLH;
    }
    try {
      trackable.letterSpacing = '0px';
    } catch {
      /* noop */
    }
  }

  y += layout.gap;
  if (layout.subLines.length) {
    ctx.font = `400 ${layout.subSize}px ${family}`;
    ctx.fillStyle = withAlpha(t.textColor, 0.76);
    for (const line of layout.subLines) {
      ctx.fillText(line, x, y);
      y += layout.subLH;
    }
  }

  ctx.restore();
}

interface DeviceLayoutOptions {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

function computeDeviceRect(
  W: number,
  H: number,
  project: Project,
  slide: Slide,
  text: TextLayout | null,
  model: DeviceDef,
  options: DeviceLayoutOptions = {},
): Rect {
  const t = resolveTextStyle(slide, project);
  const deviceScale = options.scale ?? 1;
  const offsetX = (options.offsetX ?? 0) * W;
  const offsetY = (options.offsetY ?? 0) * H;
  // wide devices (Mac / desktop) may use a little more horizontal space
  const baseCap = W * (model.ratio > 1.05 ? 0.9 : 0.84);
  let base: Rect;

  if (!text) {
    const maxH = H * 0.9;
    const dw = Math.min(baseCap, maxH * model.ratio);
    const dh = dw / model.ratio;
    base = { x: (W - dw) / 2, y: H / 2 - dh / 2, w: dw, h: dh };
  } else if (t.textPos === 'side') {
    const pad = W * 0.058;
    const columnW = W * 0.42;
    const areaX = pad + columnW + W * 0.04;
    const areaW = W - areaX - pad;
    const maxH = H * 0.86;
    const dw = Math.min(areaW, maxH * model.ratio);
    const dh = dw / model.ratio;
    base = {
      x: areaX + (areaW - dw) / 2,
      y: H / 2 - dh / 2,
      w: dw,
      h: dh,
    };
  } else {
    let topLimit: number;
    let bottomLimit: number;
    if (t.textPos === 'top') {
      topLimit = text.y + text.height + H * 0.05;
      // 原 H*0.985 几乎贴到底部，设备视觉上沉在画布下沿；
      // 上移到 H*0.88，给设备底部留出 12% 画布高度的呼吸空间。
      bottomLimit = H * 0.93;
    } else {
      // textPos === 'bottom'
      topLimit = H * 0.015;
      bottomLimit = text.y - H * 0.10;
    }
    const availH = Math.max(H * 0.18, bottomLimit - topLimit);
    const dw = Math.min(baseCap, availH * model.ratio);
    const dh = dw / model.ratio;
    base = {
      x: (W - dw) / 2,
      y: topLimit + (availH - dh) / 2,
      w: dw,
      h: dh,
    };
  }

  // scale around the base center so 100% keeps the old layout exactly
  const cx = base.x + base.w / 2;
  const cy = base.y + base.h / 2;
  const w = base.w * deviceScale;
  const h = base.h * deviceScale;

  return {
    x: cx - w / 2 + offsetX,
    y: cy - h / 2 + offsetY,
    w,
    h,
  };
}

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  measureContext = canvas.getContext('2d');
  return measureContext;
}

/** Same rect the renderer uses; needed for device drag / scale hit testing. */
export interface DeviceLayout {
  slot: DeviceSlot;
  state: DeviceState;
  model: DeviceDef;
  rect: Rect;
}

export function getDeviceLayouts(
  W: number,
  H: number,
  project: Project,
  slide: Slide,
  devices: DeviceDef[] = DEVICES,
): DeviceLayout[] {
  const ctx = getMeasureContext();
  if (!ctx) return [];
  const text = computeTextLayout(ctx, W, H, project, slide);
  const layouts: DeviceLayout[] = [];

  resolveDevices(slide, project).forEach((slot, index) => {
    const model = devices.find((d) => d.id === slot.device);
    if (!model) return;
    const state = getDeviceState(slide, slot.id, index);
    const rect = computeDeviceRect(W, H, project, slide, text, model, {
      scale: state.scale,
      offsetX: state.x,
      offsetY: state.y,
    });
    layouts.push({ slot, state, model, rect });
  });

  return layouts;
}

function drawDeviceShadow(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cx = r.x + r.w / 2;
  ctx.save();
  ctx.translate(cx, r.y + r.h * 1.002);
  ctx.scale(1, 0.16);
  const radius = r.w * 0.64;
  const g = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawScreenshot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: ShotFit,
): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;

  if (fit === 'stretch') {
    ctx.drawImage(img, x, y, w, h);
    return;
  }

  if (fit === 'contain') {
    ctx.fillStyle = '#07080c';
    ctx.fillRect(x, y, w, h);
    const s = Math.min(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return;
  }

  const srcRatio = iw / ih;
  const dstRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (srcRatio > dstRatio) {
    sw = ih * dstRatio;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / dstRatio;
    sy = 0;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#1c2130');
  g.addColorStop(1, '#090b10');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = Math.max(1, w * 0.003);
  for (let i = 1; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.4, w * 0.2 * i, 0, TAU);
    ctx.stroke();
  }

  const size = w * 0.2;
  const ix = x + w / 2 - size / 2;
  const iy = y + h * 0.34;
  const ig = ctx.createLinearGradient(ix, iy, ix + size, iy + size);
  ig.addColorStop(0, '#6366f1');
  ig.addColorStop(1, '#a855f7');
  roundRectPath(ctx, ix, iy, size, size, size * 0.28);
  ctx.fillStyle = ig;
  ctx.fill();

  ctx.save();
  ctx.translate(ix + size / 2, iy + size / 2);
  sparkPath(ctx, size * 0.62, size * 0.62);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = `600 ${Math.round(w * 0.042)}px ${FONT_SANS}`;
  ctx.fillText('上传 App 截图', x + w / 2, iy + size + w * 0.055);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `400 ${Math.round(w * 0.028)}px ${FONT_SANS}`;
  ctx.fillText('PNG / JPG', x + w / 2, iy + size + w * 0.115);
}

function drawGlassGlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const g = ctx.createLinearGradient(x, y, x + w * 0.9, y + h * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.1)');
  g.addColorStop(0.24, 'rgba(255,255,255,0.035)');
  g.addColorStop(0.58, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawMediaScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  img: HTMLImageElement | null,
  fit: ShotFit,
): void {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = '#05060a';
  ctx.fillRect(x, y, w, h);
  if (img) drawScreenshot(ctx, img, x, y, w, h, fit);
  else drawPlaceholder(ctx, x, y, w, h);
  drawGlassGlare(ctx, x, y, w, h);
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(1, w * 0.0016);
  ctx.stroke();
}

function drawMacbook(
  ctx: CanvasRenderingContext2D,
  model: DeviceDef,
  r: Rect,
  img: HTMLImageElement | null,
  fit: ShotFit,
): void {
  const { x, y, w, h } = r;
  const dark = model.id === 'macbookPro';
  const lidX = x + w * 0.045;
  const lidW = w * 0.91;
  const lidH = h * 0.94;
  const lidR = lidW * 0.018;
  const baseY = y + h * 0.925;
  const baseH = h * 0.075;

  // hinge shadow behind the base
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRectPath(ctx, lidX, baseY - h * 0.012, lidW, h * 0.03, h * 0.01);
  ctx.fill();

  const baseGrad = ctx.createLinearGradient(x, baseY, x, y + h);
  if (dark) {
    baseGrad.addColorStop(0, '#5c6069');
    baseGrad.addColorStop(0.45, '#2c2f36');
    baseGrad.addColorStop(1, '#14151a');
  } else {
    baseGrad.addColorStop(0, '#e9ebee');
    baseGrad.addColorStop(0.45, '#c2c6cc');
    baseGrad.addColorStop(1, '#83888f');
  }

  roundRectPath(ctx, x, baseY, w, baseH * 0.58, baseH * 0.28);
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, w * 0.0014);
  ctx.stroke();

  const lipY = baseY + baseH * 0.34;
  roundRectPath(ctx, x + w * 0.008, lipY, w - w * 0.016, baseH * 0.64, baseH * 0.3);
  ctx.fillStyle = dark ? '#1a1c21' : '#989da6';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = Math.max(1, w * 0.001);
  ctx.stroke();

  // lid
  roundRectPath(ctx, lidX, y, lidW, lidH, lidR);
  const lidGrad = ctx.createLinearGradient(lidX, y, lidX + lidW * 0.6, y + lidH);
  if (dark) {
    lidGrad.addColorStop(0, '#5c606a');
    lidGrad.addColorStop(0.28, '#30333b');
    lidGrad.addColorStop(0.65, '#1c1e24');
    lidGrad.addColorStop(1, '#0f1013');
  } else {
    lidGrad.addColorStop(0, '#f4f5f7');
    lidGrad.addColorStop(0.28, '#d9dce1');
    lidGrad.addColorStop(0.65, '#b4b9c0');
    lidGrad.addColorStop(1, '#8a9098');
  }
  ctx.fillStyle = lidGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(1, w * 0.0014);
  ctx.stroke();

  // black glass plate leaves a thin silver rim at the lid edge
  const glassInset = lidW * 0.007;
  roundRectPath(
    ctx,
    lidX + glassInset,
    y + glassInset,
    lidW - glassInset * 2,
    lidH - glassInset * 2,
    lidR * 0.82,
  );
  ctx.fillStyle = '#050609';
  ctx.fill();

  // display
  const bezel = lidW * 0.019;
  const sx = lidX + bezel;
  const sy = y + bezel;
  const sw = lidW - bezel * 2;
  const sh = lidH - bezel * 2;
  drawMediaScreen(ctx, sx, sy, sw, sh, lidW * 0.012, img, fit);

  // camera notch
  const nw = sw * 0.105;
  const nh = Math.max(h * 0.009, sh * 0.028);
  const nx = sx + (sw - nw) / 2;
  const ny = sy - 1;
  const nr = nw * 0.16;
  ctx.beginPath();
  ctx.moveTo(nx, ny);
  ctx.lineTo(nx + nw, ny);
  ctx.lineTo(nx + nw, ny + nh - nr);
  ctx.quadraticCurveTo(nx + nw, ny + nh, nx + nw - nr, ny + nh);
  ctx.lineTo(nx + nr, ny + nh);
  ctx.quadraticCurveTo(nx, ny + nh, nx, ny + nh - nr);
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(nx + nw / 2, ny + nh * 0.4, Math.max(0.8, nh * 0.14), 0, TAU);
  ctx.fillStyle = '#1a2432';
  ctx.fill();
}

function drawImac(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  img: HTMLImageElement | null,
  fit: ShotFit,
): void {
  const { x, y, w, h } = r;
  const bodyX = x + w * 0.01;
  const bodyW = w * 0.98;
  const bodyH = h * 0.75;
  const bodyR = w * 0.022;

  const standGrad = ctx.createLinearGradient(x, 0, x + w, 0);
  standGrad.addColorStop(0, '#7f858e');
  standGrad.addColorStop(0.3, '#cdd1d7');
  standGrad.addColorStop(0.55, '#e2e5ea');
  standGrad.addColorStop(0.8, '#b3b8c0');
  standGrad.addColorStop(1, '#7c828b');

  // stand neck (tapered)
  const neckW = w * 0.105;
  const neckX = x + (w - neckW) / 2;
  const neckY = y + bodyH - h * 0.01;
  const neckH = h * 0.17;
  const neckCx = x + w / 2;
  ctx.beginPath();
  ctx.moveTo(neckCx - neckW / 2, neckY);
  ctx.lineTo(neckCx + neckW / 2, neckY);
  ctx.lineTo(neckCx + neckW * 0.34, neckY + neckH);
  ctx.lineTo(neckCx - neckW * 0.34, neckY + neckH);
  ctx.closePath();
  ctx.fillStyle = standGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = Math.max(1, w * 0.0012);
  ctx.stroke();

  // stand foot
  const footW = w * 0.38;
  const footH = h * 0.022;
  const footX = x + (w - footW) / 2;
  const footY = y + h * 0.958;
  roundRectPath(ctx, footX, footY, footW, footH, footH * 0.45);
  ctx.fillStyle = standGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = Math.max(1, w * 0.0012);
  ctx.stroke();

  // body
  roundRectPath(ctx, bodyX, y, bodyW, bodyH, bodyR);
  const bodyGrad = ctx.createLinearGradient(bodyX, y, bodyX, y + bodyH);
  bodyGrad.addColorStop(0, '#f1f3f6');
  bodyGrad.addColorStop(0.55, '#d8dce2');
  bodyGrad.addColorStop(1, '#abb0b9');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, w * 0.0015);
  ctx.stroke();

  // display
  const padX = bodyW * 0.018;
  const sx = bodyX + padX;
  const sw = bodyW - padX * 2;
  const sy = y + h * 0.018;
  const sh = h * 0.64;
  drawMediaScreen(ctx, sx, sy, sw, sh, w * 0.007, img, fit);

  // camera dot in the top bezel
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.009, Math.max(1, h * 0.0032), 0, TAU);
  ctx.fillStyle = '#1a2330';
  ctx.fill();

  // chin crease
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyW * 0.02, y + bodyH - h * 0.004);
  ctx.lineTo(bodyX + bodyW * 0.98, y + bodyH - h * 0.004);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1, w * 0.0012);
  ctx.stroke();
}

function drawImageFrame(
  ctx: CanvasRenderingContext2D,
  model: DeviceDef,
  r: Rect,
  shot: HTMLImageElement | null,
  fit: ShotFit,
): void {
  const frameDef = model.image;
  const frameImg = frameDef ? getImage(frameDef.image) : null;

  if (!frameDef || !frameImg) {
    drawDeviceShadow(ctx, r);
    ctx.save();
    roundRectPath(ctx, r.x, r.y, r.w, r.h, r.w * 0.03);
    ctx.clip();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (shot) drawScreenshot(ctx, shot, r.x, r.y, r.w, r.h, fit);
    else drawPlaceholder(ctx, r.x, r.y, r.w, r.h);
    ctx.restore();
    return;
  }

  if (frameDef.shadow) drawDeviceShadow(ctx, r);

  const scaleX = r.w / frameImg.naturalWidth;
  const scaleY = r.h / frameImg.naturalHeight;
  const screen = frameDef.screen;
  const sx = r.x + screen.x * scaleX;
  const sy = r.y + screen.y * scaleY;
  const sw = screen.w * scaleX;
  const sh = screen.h * scaleY;
  const sr = (screen.radius ?? 0) * Math.min(scaleX, scaleY);

  const drawContent = () => {
    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, sr);
    ctx.clip();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(sx, sy, sw, sh);
    if (shot) drawScreenshot(ctx, shot, sx, sy, sw, sh, fit);
    else drawPlaceholder(ctx, sx, sy, sw, sh);
    ctx.restore();
  };

  if (frameDef.mode === 'over') {
    ctx.drawImage(frameImg, r.x, r.y, r.w, r.h);
    drawContent();
  } else {
    drawContent();
    ctx.drawImage(frameImg, r.x, r.y, r.w, r.h);
  }
}

function drawDevice(
  ctx: CanvasRenderingContext2D,
  model: DeviceDef,
  r: Rect,
  screenshot: string | undefined,
  fit: ShotFit,
): void {
  const { x, y, w, h } = r;
  if (w <= 2 || h <= 2) return;
  const img = getImage(screenshot);

  if (model.frame === 'image' && model.image) {
    drawImageFrame(ctx, model, r, img, fit);
    return;
  }

  drawDeviceShadow(ctx, r);

  if (model.frame === 'none') {
    roundRectPath(ctx, x, y, w, h, w * 0.055);
    ctx.fillStyle = '#08090d';
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, x, y, w, h, w * 0.055);
    ctx.clip();
    if (img) drawScreenshot(ctx, img, x, y, w, h, fit);
    else drawPlaceholder(ctx, x, y, w, h);
    ctx.restore();
    roundRectPath(ctx, x, y, w, h, w * 0.055);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.stroke();
    return;
  }

  if (model.frame === 'macbook') {
    drawMacbook(ctx, model, r, img, fit);
    return;
  }

  if (model.frame === 'imac') {
    drawImac(ctx, r, img, fit);
    return;
  }

  if (model.frame === 'island' || model.frame === 'notch') {
    const bw = w * 0.011;
    const br = bw / 2;
    ctx.fillStyle = '#464a58';
    roundRectPath(ctx, x - bw * 0.55, y + h * 0.165, bw, h * 0.035, br);
    ctx.fill();
    roundRectPath(ctx, x - bw * 0.55, y + h * 0.225, bw, h * 0.055, br);
    ctx.fill();
    roundRectPath(ctx, x - bw * 0.55, y + h * 0.295, bw, h * 0.055, br);
    ctx.fill();
    roundRectPath(ctx, x + w - bw * 0.45, y + h * 0.255, bw, h * 0.085, br);
    ctx.fill();
  }

  const radius =
    model.frame === 'se' ? w * 0.1 : model.frame === 'ipad' ? w * 0.052 : w * 0.155;

  roundRectPath(ctx, x, y, w, h, radius);
  const body = ctx.createLinearGradient(x, y, x + w * 0.55, y + h);
  body.addColorStop(0, '#5a5f6d');
  body.addColorStop(0.16, '#2e323c');
  body.addColorStop(0.5, '#1a1d24');
  body.addColorStop(1, '#0c0d11');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.0016);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.stroke();

  let sx = x;
  let sy = y;
  let sw = w;
  let sh = h;
  let sr = radius;
  if (model.frame === 'se') {
    sx = x + w * 0.055;
    sw = w * 0.89;
    sy = y + h * 0.115;
    sh = h * 0.77;
    sr = w * 0.012;
  } else if (model.frame === 'ipad') {
    const b = w * 0.03;
    sx = x + b;
    sy = y + b;
    sw = w - b * 2;
    sh = h - b * 2;
    sr = w * 0.02;
  } else {
    const b = w * 0.03;
    sx = x + b;
    sy = y + b;
    sw = w - b * 2;
    sh = h - b * 2;
    sr = Math.max(w * 0.05, radius - b * 0.85);
  }

  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  ctx.fillStyle = '#05060a';
  ctx.fillRect(sx, sy, sw, sh);
  if (img) drawScreenshot(ctx, img, sx, sy, sw, sh, fit);
  else drawPlaceholder(ctx, sx, sy, sw, sh);
  drawGlassGlare(ctx, sx, sy, sw, sh);
  ctx.restore();

  roundRectPath(ctx, sx, sy, sw, sh, sr);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.stroke();

  if (model.frame === 'island') {
    const iw = sw * 0.31;
    const ih = sw * 0.086;
    const ix = sx + (sw - iw) / 2;
    const iy = sy + sw * 0.026;
    roundRectPath(ctx, ix, iy, iw, ih, ih / 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ix + iw - ih * 0.62, iy + ih / 2, ih * 0.2, 0, TAU);
    ctx.fillStyle = '#17202f';
    ctx.fill();
  }

  if (model.frame === 'notch') {
    const nw = sw * 0.42;
    const nh = sw * 0.08;
    const nr = sw * 0.028;
    const nx = sx + (sw - nw) / 2;
    const ny = sy - 1;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(nx + nw, ny);
    ctx.lineTo(nx + nw, ny + nh - nr);
    ctx.quadraticCurveTo(nx + nw, ny + nh, nx + nw - nr, ny + nh);
    ctx.lineTo(nx + nr, ny + nh);
    ctx.quadraticCurveTo(nx, ny + nh, nx, ny + nh - nr);
    ctx.closePath();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(nx + nw * 0.68, ny + nh * 0.45, nh * 0.16, 0, TAU);
    ctx.fillStyle = '#141c28';
    ctx.fill();
  }

  if (model.frame === 'se') {
    ctx.fillStyle = '#08090d';
    roundRectPath(ctx, x + w * 0.35, y + h * 0.052, w * 0.3, w * 0.018, w * 0.009);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.24, y + h * 0.058, w * 0.011, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.94, w * 0.052, 0, TAU);
    ctx.strokeStyle = '#3d414d';
    ctx.lineWidth = Math.max(1, w * 0.0035);
    ctx.stroke();
  }

  if (model.frame === 'ipad') {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + w * 0.0155, w * 0.0065, 0, TAU);
    ctx.fillStyle = '#08090d';
    ctx.fill();
  }
}

function starPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const outerX = w / 2;
  const outerY = h / 2;
  const inner = 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 === 0 ? 1 : inner;
    const px = Math.cos(angle) * outerX * k;
    const py = Math.sin(angle) * outerY * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function sparkPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  const c = 0.16;
  ctx.beginPath();
  ctx.moveTo(0, -y);
  ctx.quadraticCurveTo(x * c, -y * c, x, 0);
  ctx.quadraticCurveTo(x * c, y * c, 0, y);
  ctx.quadraticCurveTo(-x * c, y * c, -x, 0);
  ctx.quadraticCurveTo(-x * c, -y * c, 0, -y);
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  ctx.beginPath();
  ctx.moveTo(0, y * 0.78);
  ctx.bezierCurveTo(-x * 1.12, y * 0.08, -x * 0.86, -y * 0.98, 0, -y * 0.36);
  ctx.bezierCurveTo(x * 0.86, -y * 0.98, x * 1.12, y * 0.08, 0, y * 0.78);
  ctx.closePath();
}

function burstPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const points = 12;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const k = i % 2 === 0 ? 1 : 0.74;
    const px = Math.cos(angle) * (w / 2) * k;
    const py = Math.sin(angle) * (h / 2) * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawIllustration(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  el: Illustration,
): void {
  const w = el.w * W;
  const h = el.h * W;
  if (w <= 0.5 || h <= 0.5) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, el.opacity));
  ctx.translate(el.cx * W, el.cy * H);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.fillStyle = el.color;
  ctx.strokeStyle = el.color;

  switch (el.kind) {
    case 'star':
      starPath(ctx, w, h);
      ctx.fill();
      break;
    case 'spark':
      sparkPath(ctx, w, h);
      ctx.fill();
      break;
    case 'circle':
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
      ctx.fill();
      break;
    case 'heart':
      heartPath(ctx, w, h);
      ctx.fill();
      break;
    case 'squiggle': {
      const steps = 48;
      ctx.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const px = -w / 2 + t * w;
        const py = Math.sin(t * Math.PI * 4) * h * 0.36;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineWidth = Math.max(2, h * 0.16);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      break;
    }
    case 'burst':
      burstPath(ctx, w, h);
      ctx.fill();
      break;
    case 'image': {
      const img = getImage(el.src);
      if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
      break;
    }
    case 'emoji': {
      if (el.emoji) {
        ctx.font = `${Math.min(w, h) * 1.18}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.emoji, 0, h * 0.05);
      }
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: Project,
  slide: Slide,
  devices: DeviceDef[] = DEVICES,
): void {
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  drawBackground(ctx, W, H, slide.bg);

  const layouts = getDeviceLayouts(W, H, project, slide, devices);
  for (const layout of layouts) {
    drawDevice(
      ctx,
      layout.model,
      layout.rect,
      layout.state.screenshot,
      layout.state.fit,
    );
  }

  const text = computeTextLayout(ctx, W, H, project, slide);
  if (text) drawTextBlock(ctx, W, project, slide, text);
  for (const el of slide.illustrations) drawIllustration(ctx, W, H, el);

  ctx.restore();
}
