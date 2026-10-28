import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DeviceDef, Project, Slide } from '../types';
import { drawScene } from '../lib/draw';
import { slideFrameSources, slideImageSources } from '../lib/images';
import { useImageVersion } from '../hooks/useImageVersion';
import { Icon } from './Icon';

const THUMB_H = 126;

export function SlideStrip({
  project,
  devices,
  active,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
}: {
  project: Project;
  devices: DeviceDef[];
  active: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}): ReactNode {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const thumbWidth = Math.max(
    36,
    Math.round(THUMB_H * (project.size.w / project.size.h)),
  );
  const showLabel = thumbWidth >= 90;

  return (
    <div className="slides">
      <div className="slides-head">
        <span>
          页面 <b>{project.slides.length}</b> / 10
        </span>
        <span className="slides-hint">点击切换 · 拖动排序 · 导出为 ZIP</span>
      </div>
      <div className="slide-list">
        {project.slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`slide-thumb ${index === active ? 'on' : ''} ${
              overIndex === index && dragIndex !== null && dragIndex !== index ? 'over' : ''
            } ${dragIndex === index ? 'dragging' : ''}`}
            style={{ width: thumbWidth }}
            role="button"
            tabIndex={0}
            draggable
            onClick={() => onSelect(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(index);
            }}
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndex ?? Number(e.dataTransfer.getData('text/plain'));
              if (Number.isFinite(from) && from !== index) onReorder(from, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            <SlideThumb project={project} slide={slide} devices={devices} width={thumbWidth} />
            <span className="slide-index">{index + 1}</span>
            <span className="slide-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" title="复制此页" onClick={() => onDuplicate(index)}>
                <Icon name="copy" size={12} />
              </button>
              {project.slides.length > 1 ? (
                <button type="button" title="删除此页" onClick={() => onDelete(index)}>
                  <Icon name="trash" size={12} />
                </button>
              ) : null}
            </span>
            {showLabel ? (
              <span className="slide-label">{slide.title.trim() || '未命名页面'}</span>
            ) : null}
          </div>
        ))}

        {project.slides.length < 10 ? (
          <button type="button" className="slide-add" onClick={onAdd}>
            <Icon name="plus" size={18} />
            <span>添加页面</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SlideThumb({
  project,
  slide,
  devices,
  width,
}: {
  project: Project;
  slide: Slide;
  devices: DeviceDef[];
  width: number;
}): ReactNode {
  const ref = useRef<HTMLCanvasElement>(null);
  const srcs = useMemo(() => {
    const list = slideImageSources(slide);
    list.push(...slideFrameSources(project, slide, devices));
    return list;
  }, [slide, devices, project.size]);
  const version = useImageVersion(srcs);

  const pixelW = width * 2;
  const pixelH = THUMB_H * 2;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = pixelW;
    canvas.height = pixelH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, pixelW, pixelH, project, slide, devices);
  }, [project, slide, version, pixelW, pixelH, devices]);

  return <canvas ref={ref} style={{ width, height: THUMB_H }} />;
}
