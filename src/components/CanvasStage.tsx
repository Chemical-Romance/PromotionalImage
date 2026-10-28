import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { DeviceDef, Illustration, Project, Slide } from '../types';
import { drawScene, getDeviceLayouts, type DeviceLayout } from '../lib/draw';
import { slideFrameSources, slideImageSources } from '../lib/images';
import { clamp } from '../lib/utils';
import { useImageVersion } from '../hooks/useImageVersion';
import { Icon } from './Icon';

type Corner = { sx: -1 | 1; sy: -1 | 1 };

interface IllustrationDrag {
  mode: 'move' | 'resize' | 'rotate';
  id: string;
  orig: Illustration;
  start: { x: number; y: number };
  corner?: Corner;
}

interface DeviceDrag {
  mode: 'device';
  slotId: string;
  start: { x: number; y: number };
  origX: number;
  origY: number;
}

interface DeviceScaleDrag {
  mode: 'scaleDevice';
  slotId: string;
  startScale: number;
  startDist: number;
  center: { x: number; y: number };
}

type DragState = IllustrationDrag | DeviceDrag | DeviceScaleDrag;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const STAGE_PAD_X = 72;
const STAGE_PAD_Y = 56;

export function CanvasStage({
  project,
  slide,
  devices,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onDeviceMove,
  onDeviceScale,
}: {
  project: Project;
  slide: Slide;
  devices: DeviceDef[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Illustration>) => void;
  onDelete: (id: string) => void;
  onDeviceMove: (slotId: string, x: number, y: number) => void;
  onDeviceScale: (slotId: string, scale: number) => void;
}): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const W = project.size.w;
  const H = project.size.h;
  const [scale, setScale] = useState(0);

  const srcs = slideImageSources(slide);
  srcs.push(...slideFrameSources(project, slide, devices));
  const version = useImageVersion(srcs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, W, H, project, slide, devices);
  }, [project, slide, W, H, version, scale, devices]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const next = Math.min(
        (rect.width - STAGE_PAD_X) / W,
        (rect.height - STAGE_PAD_Y) / H,
        1,
      );
      setScale(Math.max(0.04, next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [W, H]);

  const selected = slide.illustrations.find((el) => el.id === selectedId) ?? null;
  const layouts = getDeviceLayouts(W, H, project, slide, devices);
  const selectedLayout =
    layouts.find((layout) => layout.slot.id === selectedSlotId) ?? null;

  useEffect(() => {
    setSelectedSlotId(null);
  }, [slide.id]);

  useEffect(() => {
    if (
      selectedSlotId &&
      !layouts.some((layout) => layout.slot.id === selectedSlotId)
    ) {
      setSelectedSlotId(null);
    }
  }, [layouts, selectedSlotId]);

  useEffect(() => {
    if (selectedId) setSelectedSlotId(null);
  }, [selectedId]);

  const toDesign = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const beginDrag = (
    e: ReactPointerEvent,
    state: Omit<IllustrationDrag, 'start'>,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const point = toDesign(e.clientX, e.clientY);
    dragRef.current = { ...state, start: point };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onDeviceDown = (e: ReactPointerEvent, layout: DeviceLayout) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedSlotId(layout.slot.id);
    onSelect(null);
    const point = toDesign(e.clientX, e.clientY);
    dragRef.current = {
      mode: 'device',
      slotId: layout.slot.id,
      start: point,
      origX: layout.state.x,
      origY: layout.state.y,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onScaleDown = (e: ReactPointerEvent, layout: DeviceLayout) => {
    e.stopPropagation();
    e.preventDefault();
    const p = toDesign(e.clientX, e.clientY);
    const center = {
      x: layout.rect.x + layout.rect.w / 2,
      y: layout.rect.y + layout.rect.h / 2,
    };
    const startDist = Math.hypot(p.x - center.x, p.y - center.y);
    if (startDist < 1) return;
    dragRef.current = {
      mode: 'scaleDevice',
      slotId: layout.slot.id,
      startScale: layout.state.scale,
      startDist,
      center,
    };
    setSelectedSlotId(layout.slot.id);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onElementDown = (e: ReactPointerEvent, el: Illustration) => {
    setSelectedSlotId(null);
    onSelect(el.id);
    beginDrag(e, { mode: 'move', id: el.id, orig: { ...el } });
  };

  const onHandleDown = (e: ReactPointerEvent, corner: Corner) => {
    if (!selected) return;
    beginDrag(e, { mode: 'resize', id: selected.id, orig: { ...selected }, corner });
  };

  const onRotateDown = (e: ReactPointerEvent) => {
    if (!selected) return;
    beginDrag(e, { mode: 'rotate', id: selected.id, orig: { ...selected } });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toDesign(e.clientX, e.clientY);

    if (drag.mode === 'device') {
      const dx = (p.x - drag.start.x) / W;
      const dy = (p.y - drag.start.y) / H;
      onDeviceMove(
        drag.slotId,
        clamp(drag.origX + dx, -0.25, 0.25),
        clamp(drag.origY + dy, -0.25, 0.25),
      );
      return;
    }

    if (drag.mode === 'scaleDevice') {
      const dist = Math.hypot(p.x - drag.center.x, p.y - drag.center.y);
      if (drag.startDist < 1) return;
      // Ignore sub-3-screen-px jitter so an accidental handle click doesn't
      // instantly jump the device scale before the user really drags.
      if (Math.abs(dist - drag.startDist) < 3 / scale) return;
      const next = drag.startScale * (dist / drag.startDist);
      onDeviceScale(drag.slotId, clamp(next, 0.2, 1.6));
      return;
    }

    const o = drag.orig;

    if (drag.mode === 'move') {
      const dx = (p.x - drag.start.x) / W;
      const dy = (p.y - drag.start.y) / H;
      onUpdate(drag.id, {
        cx: clamp(o.cx + dx, -0.3, 1.3),
        cy: clamp(o.cy + dy, -0.3, 1.3),
      });
      return;
    }

    if (drag.mode === 'resize' && drag.corner) {
      const rad = (o.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const ocx = o.cx * W;
      const ocy = o.cy * H;
      const ow = o.w * W;
      const oh = o.h * W;
      const { sx, sy } = drag.corner;

      // opposite corner stays fixed in design space
      const fx = ocx - (sx * ow * cos) / 2 + (sy * oh * sin) / 2;
      const fy = ocy - (sx * ow * sin) / 2 - (sy * oh * cos) / 2;

      const dx = p.x - fx;
      const dy = p.y - fy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;

      const minSize = Math.max(6, W * 0.004);
      const nw = Math.max(minSize, Math.abs(lx));
      const nh = Math.max(minSize, Math.abs(ly));

      const ncx = fx + (sx * nw * cos) / 2 - (sy * nh * sin) / 2;
      const ncy = fy + (sx * nw * sin) / 2 + (sy * nh * cos) / 2;

      onUpdate(drag.id, { cx: ncx / W, cy: ncy / H, w: nw / W, h: nh / W });
      return;
    }

    if (drag.mode === 'rotate') {
      const ocx = o.cx * W;
      const ocy = o.cy * H;
      const a0 = Math.atan2(drag.start.y - ocy, drag.start.x - ocx);
      const a1 = Math.atan2(p.y - ocy, p.x - ocx);
      let deg = o.rotation + ((a1 - a0) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = ((deg + 180) % 360 + 360) % 360 - 180;
      onUpdate(drag.id, { rotation: Math.round(deg * 10) / 10 });
    }
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!selected) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDelete(selected.id);
        return;
      }
      const step = e.shiftKey ? 0.02 : 0.005;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onUpdate(selected.id, { cx: clamp(selected.cx - step, -0.3, 1.3) });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onUpdate(selected.id, { cx: clamp(selected.cx + step, -0.3, 1.3) });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onUpdate(selected.id, { cy: clamp(selected.cy - step, -0.3, 1.3) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onUpdate(selected.id, { cy: clamp(selected.cy + step, -0.3, 1.3) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onDelete, onUpdate]);

  const dispW = Math.round(W * scale);
  const dispH = Math.round(H * scale);

  return (
    <div className="stage" ref={stageRef}>
      {scale > 0 ? (
        <div className="canvas-shell" style={{ width: dispW, height: dispH }}>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: dispW, height: dispH }} />
          <svg
            ref={svgRef}
            className="overlay"
            viewBox={`0 0 ${W} ${H}`}
            onPointerDown={(e) => {
              const p = toDesign(e.clientX, e.clientY);
              // Manual hit-test across ALL devices. Since device-hit rects have
              // pointerEvents="none", every click lands here regardless of which
              // visual device was under the cursor.
              // Devices are drawn in layouts order, so the LAST hit is the one
              // visually on top — iterate in reverse and take the first match.
              let picked: DeviceLayout | undefined;
              for (let i = layouts.length - 1; i >= 0; i -= 1) {
                const l = layouts[i];
                if (
                  p.x >= l.rect.x &&
                  p.x <= l.rect.x + l.rect.w &&
                  p.y >= l.rect.y &&
                  p.y <= l.rect.y + l.rect.h
                ) {
                  picked = l;
                  break;
                }
              }
              if (!picked) {
                // Empty click — deselect everything
                onSelect(null);
                setSelectedSlotId(null);
                return;
              }
              e.preventDefault();
              setSelectedSlotId(picked.slot.id);
              onSelect(null);
              dragRef.current = {
                mode: 'device',
                slotId: picked.slot.id,
                start: p,
                origX: picked.state.x,
                origY: picked.state.y,
              };
              svgRef.current?.setPointerCapture(e.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {layouts.map((layout) => (
              <rect
                key={layout.slot.id}
                className="device-hit"
                data-slot={layout.slot.id}
                x={layout.rect.x}
                y={layout.rect.y}
                width={layout.rect.w}
                height={layout.rect.h}
                fill="rgba(0,0,0,0)"
                pointerEvents="none"
                style={{ cursor: 'move' }}
              />
            ))}

            {slide.illustrations.map((el) => {
              const cx = el.cx * W;
              const cy = el.cy * H;
              const w = el.w * W;
              const h = el.h * W;
              return (
                <g key={el.id} transform={`translate(${cx} ${cy}) rotate(${el.rotation})`}>
                  <rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    fill="rgba(0,0,0,0)"
                    pointerEvents="all"
                    style={{ cursor: 'move' }}
                    onPointerDown={(e) => onElementDown(e, el)}
                  />
                </g>
              );
            })}

            {selected ? (
              <SelectionHandles
                el={selected}
                W={W}
                H={H}
                scale={scale}
                onResize={onHandleDown}
                onRotate={onRotateDown}
              />
            ) : null}

            {selectedLayout ? (
              <DeviceHandles
                rect={selectedLayout.rect}
                W={W}
                H={H}
                scale={scale}
                label={selectedLayout.model.name}
                onScaleDown={(e) => onScaleDown(e, selectedLayout)}
              />
            ) : null}
          </svg>
        </div>
      ) : null}

      <div className="stage-tip">
        <Icon name="sparkles" size={12} />
        拖动设备或插图 · 拖角缩放 · 圆点旋转
      </div>
      <div className="zoom-badge">{Math.round(scale * 100)}%</div>
    </div>
  );
}

function SelectionHandles({
  el,
  W,
  H,
  scale,
  onResize,
  onRotate,
}: {
  el: Illustration;
  W: number;
  H: number;
  scale: number;
  onResize: (e: ReactPointerEvent, corner: Corner) => void;
  onRotate: (e: ReactPointerEvent) => void;
}): ReactNode {
  const cx = el.cx * W;
  const cy = el.cy * H;
  const w = el.w * W;
  const h = el.h * W;
  const handleR = 7 / scale;
  const hitR = 15 / scale;
  const rotOffset = 30 / scale;
  const corners: Corner[] = [
    { sx: -1, sy: -1 },
    { sx: 1, sy: -1 },
    { sx: 1, sy: 1 },
    { sx: -1, sy: 1 },
  ];

  return (
    <g transform={`translate(${cx} ${cy}) rotate(${el.rotation})`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill="none"
        stroke="#8b93ff"
        strokeWidth={1.5}
        strokeDasharray="7 5"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <line
        x1={0}
        y1={-h / 2}
        x2={0}
        y2={-h / 2 - rotOffset + handleR}
        stroke="#8b93ff"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {corners.map((c) => (
        <g key={`${c.sx}${c.sy}`}>
          <circle
            cx={(c.sx * w) / 2}
            cy={(c.sy * h) / 2}
            r={hitR}
            fill="rgba(0,0,0,0)"
            pointerEvents="all"
            style={{ cursor: 'nwse-resize' }}
            onPointerDown={(e) => onResize(e, c)}
          />
          <circle
            cx={(c.sx * w) / 2}
            cy={(c.sy * h) / 2}
            r={handleR}
            fill="#ffffff"
            stroke="#6c74ff"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </g>
      ))}
      <circle
        cx={0}
        cy={-h / 2 - rotOffset}
        r={hitR}
        fill="rgba(0,0,0,0)"
        pointerEvents="all"
        style={{ cursor: 'grab' }}
        onPointerDown={onRotate}
      />
      <circle
        cx={0}
        cy={-h / 2 - rotOffset}
        r={handleR}
        fill="#ffffff"
        stroke="#6c74ff"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    </g>
  );
}

function DeviceHandles({
  rect,
  W,
  H,
  scale,
  label,
  onScaleDown,
}: {
  rect: Rect;
  W: number;
  H: number;
  scale: number;
  label: string;
  onScaleDown: (e: ReactPointerEvent) => void;
}): ReactNode {
  const handleR = 7 / scale;
  // Keep the invisible hit circle close to the visible handle dot (7/scale).
  // A larger radius (~15/scale) made the corners of a selected device swallow
  // regular drag clicks, causing accidental "sudden zoom" scale drags.
  const hitR = 10 / scale;
  const margin = 16 / scale;
  const px = (value: number) => clamp(value, margin, W - margin);
  const py = (value: number) => clamp(value, margin, H - margin);
  const corners = [
    { x: px(rect.x), y: py(rect.y), cursor: 'nwse-resize' },
    { x: px(rect.x + rect.w), y: py(rect.y), cursor: 'nesw-resize' },
    { x: px(rect.x + rect.w), y: py(rect.y + rect.h), cursor: 'nwse-resize' },
    { x: px(rect.x), y: py(rect.y + rect.h), cursor: 'nesw-resize' },
  ];
  const labelX = clamp(rect.x + 10 / scale, margin, W - 110 / scale);
  const labelY = clamp(rect.y - 9 / scale, 16 / scale, H - 12 / scale);

  return (
    <g>
      <rect
        className="device-sel-outline"
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="none"
        stroke="#8b93ff"
        strokeWidth={1.5}
        strokeDasharray="8 6"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {corners.map((corner, index) => (
        <g key={index}>
          <circle
            className="device-scale-handle"
            cx={corner.x}
            cy={corner.y}
            r={hitR}
            fill="rgba(0,0,0,0)"
            pointerEvents="all"
            style={{ cursor: corner.cursor }}
            onPointerDown={onScaleDown}
          />
          <circle
            cx={corner.x}
            cy={corner.y}
            r={handleR}
            fill="#ffffff"
            stroke="#6c74ff"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </g>
      ))}
      <text
        className="device-sel-label"
        x={labelX}
        y={labelY}
        fill="#c7cbff"
        fontSize={12 / scale}
        fontWeight={600}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}
