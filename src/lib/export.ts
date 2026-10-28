import JSZip from 'jszip';
import type { DeviceDef, Project, Slide } from '../types';
import { DEVICES } from '../data';
import { drawScene } from './draw';
import { preload, slideFrameSources, slideImageSources } from './images';
import { downloadBlob } from './utils';

export function renderSlideCanvas(
  project: Project,
  slide: Slide,
  width = project.size.w,
  height = project.size.h,
  devices: DeviceDef[] = DEVICES,
): Promise<HTMLCanvasElement> {
  const sources = [
    ...slideImageSources(slide),
    ...slideFrameSources(project, slide, devices),
  ];

  return preload(sources).then(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器不支持 Canvas');
    ctx.imageSmoothingQuality = 'high';
    drawScene(ctx, width, height, project, slide, devices);
    return canvas;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败'))),
      'image/png',
    );
  });
}

function fileName(project: Project, index: number): string {
  const { w, h } = project.size;
  return `promo-${w}x${h}-${String(index + 1).padStart(2, '0')}.png`;
}

export async function exportSlide(
  project: Project,
  slide: Slide,
  index: number,
  devices: DeviceDef[] = DEVICES,
): Promise<void> {
  const canvas = await renderSlideCanvas(project, slide, project.size.w, project.size.h, devices);
  const blob = await toBlob(canvas);
  downloadBlob(blob, fileName(project, index));
}

export async function exportAllAsZip(
  project: Project,
  devices: DeviceDef[] = DEVICES,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const zip = new JSZip();
  const total = project.slides.length;

  for (let i = 0; i < total; i += 1) {
    const canvas = await renderSlideCanvas(
      project,
      project.slides[i],
      project.size.w,
      project.size.h,
      devices,
    );
    const blob = await toBlob(canvas);
    zip.file(fileName(project, i), blob);
    onProgress?.(i + 1, total);
  }

  const archive = await zip.generateAsync({ type: 'blob' });
  const { w, h } = project.size;
  downloadBlob(archive, `promo-${w}x${h}.zip`);
  return total;
}
