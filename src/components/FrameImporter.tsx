import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { DeviceDef, FrameScreenRect } from '../types';
import { prepareImage, imageSize, clamp, uid } from '../lib/utils';
import { preload } from '../lib/images';
import { Icon } from './Icon';
import { Field, Segmented, UploadBox } from './ui';

const MAX_STAGE_W = 520;
const MAX_STAGE_H = 430;

export function FrameImporter({
  open,
  devices,
  onClose,
  onAdd,
  onToast,
}: {
  open: boolean;
  devices: DeviceDef[];
  onClose: () => void;
  onAdd: (device: DeviceDef) => void;
  onToast: (message: string) => void;
}): ReactNode {
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [name, setName] = useState('我的设备');
  const [targetId, setTargetId] = useState('');
  const [screen, setScreen] = useState<FrameScreenRect>({ x: 0, y: 0, w: 0, h: 0, radius: 0 });
  const [mode, setMode] = useState<'under' | 'over'>('under');
  const [shadow, setShadow] = useState(false);
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const targetDevice = devices.find((device) => device.id === targetId);

  useEffect(() => {
    if (!open) return;
    setSrc('');
    setNatural({ w: 0, h: 0 });
    setName('我的设备');
    setTargetId('');
    setScreen({ x: 0, y: 0, w: 0, h: 0, radius: 0 });
    setMode('under');
    setShadow(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const dispScale =
    natural.w > 0 && natural.h > 0
      ? Math.min(MAX_STAGE_W / natural.w, MAX_STAGE_H / natural.h)
      : 1;
  const dispW = Math.max(1, Math.round(natural.w * dispScale));
  const dispH = Math.max(1, Math.round(natural.h * dispScale));

  const loadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onToast('请选择图片文件');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await prepareImage(file, { maxDim: 2400, png: true });
      const size = await imageSize(dataUrl);
      if (!size.w || !size.h) throw new Error('bad image');
      setSrc(dataUrl);
      setNatural(size);
      setScreen({
        x: Math.round(size.w * 0.1),
        y: Math.round(size.h * 0.1),
        w: Math.round(size.w * 0.8),
        h: Math.round(size.h * 0.8),
        radius: Math.round(Math.min(size.w, size.h) * 0.04),
      });
      const raw = file.name.replace(/\.[^.]+$/, '').trim();
      if (!targetId) setName(raw.slice(0, 30) || '我的设备');
    } catch {
      onToast('图片读取失败，请换一张试试');
    } finally {
      setBusy(false);
    }
  };

  const patchRect = (patch: Partial<FrameScreenRect>) => {
    setScreen((prev) => {
      const next = { ...prev, ...patch };
      next.x = clamp(Math.round(next.x || 0), 0, Math.max(0, natural.w - 10));
      next.y = clamp(Math.round(next.y || 0), 0, Math.max(0, natural.h - 10));
      next.w = clamp(Math.round(next.w || 10), 10, Math.max(10, natural.w - next.x));
      next.h = clamp(Math.round(next.h || 10), 10, Math.max(10, natural.h - next.y));
      next.radius = clamp(
        Math.round(next.radius || 0),
        0,
        Math.floor(Math.min(next.w, next.h) / 2),
      );
      return next;
    });
  };

  const beginDrag = (
    e: ReactPointerEvent,
    dragMode: 'move' | 'resize',
    corner?: number,
  ) => {
    if (!natural.w) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { ...screen };
    const startX = e.clientX;
    const startY = e.clientY;
    const minW = Math.max(24, natural.w * 0.02);
    const minH = Math.max(24, natural.h * 0.02);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / dispScale;
      const dy = (ev.clientY - startY) / dispScale;

      if (dragMode === 'move') {
        setScreen((prev) => ({
          ...prev,
          x: Math.round(clamp(start.x + dx, 0, natural.w - start.w)),
          y: Math.round(clamp(start.y + dy, 0, natural.h - start.h)),
        }));
        return;
      }

      if (corner === undefined) return;
      let { x, y, w, h } = start;
      if (corner === 0 || corner === 3) {
        const nx = clamp(start.x + dx, 0, start.x + start.w - minW);
        w = start.w + (start.x - nx);
        x = nx;
      } else {
        w = clamp(start.w + dx, minW, natural.w - start.x);
      }
      if (corner === 0 || corner === 1) {
        const ny = clamp(start.y + dy, 0, start.y + start.h - minH);
        h = start.h + (start.y - ny);
        y = ny;
      } else {
        h = clamp(start.h + dy, minH, natural.h - start.y);
      }
      setScreen((prev) => ({
        ...prev,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const canUse = Boolean(src) && screen.w > 10 && screen.h > 10;

  const handleAdd = async () => {
    if (!canUse) return;
    setBusy(true);
    try {
      await preload([src]);
      const device: DeviceDef = {
        id: targetId || `custom-${uid()}`,
        name: name.trim() || targetDevice?.name || '自定义设备',
        note: '自定义模型',
        ratio: natural.w / natural.h,
        frame: 'image',
        image: {
          image: src,
          screen: {
            x: screen.x,
            y: screen.y,
            w: screen.w,
            h: screen.h,
            radius: screen.radius ?? 0,
          },
          mode,
          shadow,
        },
      };
      onAdd(device);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!canUse) return;
    const config = {
      id: targetId || `custom-${uid()}`,
      name: name.trim() || targetDevice?.name || '自定义设备',
      note: '自定义模型',
      image: '/frames/你的图片文件名.png',
      screen: {
        x: screen.x,
        y: screen.y,
        w: screen.w,
        h: screen.h,
        radius: screen.radius ?? 0,
      },
      mode,
      shadow,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      onToast('配置已复制，粘贴到 public/frames/devices.json 即可长期使用');
    } catch {
      onToast('复制失败，请手动记录下方数值');
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="自定义设备模型">
        <div className="modal-head">
          <div>
            <div className="modal-title">自定义设备模型</div>
            <div className="modal-sub">
              上传一张带透明屏幕区域的 PNG，拖动框选截图显示的位置
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="关闭">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-body">
          {!src ? (
            <div className="frame-upload">
              <UploadBox
                label="上传设备框 PNG"
                hint="透明屏幕的 mockup 效果最好，建议 1500px 以上"
                onFile={loadFile}
                accept="image/png,image/webp,image/jpeg"
                tall
              />
              <p className="hint">
                图片比例会成为设备的展示比例；截图会自动缩放并嵌入你框选的屏幕区域。
              </p>
              {busy ? <p className="hint">图片处理中…</p> : null}
            </div>
          ) : (
            <div className="frame-editor">
              <div className="frame-stage-wrap">
                <div className="frame-stage" style={{ width: dispW, height: dispH }}>
                  <img src={src} alt="" draggable={false} />
                  <div
                    className="screen-rect"
                    style={{
                      left: screen.x * dispScale,
                      top: screen.y * dispScale,
                      width: screen.w * dispScale,
                      height: screen.h * dispScale,
                    }}
                    onPointerDown={(e) => beginDrag(e, 'move')}
                  >
                    <span>屏幕区域</span>
                    {[
                      { corner: 0, left: -6, top: -6, cursor: 'nwse-resize' },
                      { corner: 1, right: -6, top: -6, cursor: 'nesw-resize' },
                      { corner: 2, right: -6, bottom: -6, cursor: 'nwse-resize' },
                      { corner: 3, left: -6, bottom: -6, cursor: 'nesw-resize' },
                    ].map((handle) => (
                      <span
                        key={handle.corner}
                        className="screen-handle"
                        style={{
                          left: handle.left,
                          right: handle.right,
                          top: handle.top,
                          bottom: handle.bottom,
                          cursor: handle.cursor,
                        }}
                        onPointerDown={(e) => beginDrag(e, 'resize', handle.corner)}
                      />
                    ))}
                  </div>
                </div>

                <div className="frame-stage-actions">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => replaceRef.current?.click()}
                  >
                    <Icon name="upload" size={12} /> 更换图片
                  </button>
                  <span className="hint">
                    原图 {natural.w} × {natural.h} px
                  </span>
                </div>
                <input
                  ref={replaceRef}
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadFile(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="frame-form">
                <Field label="目标设备" hint="选择已有设备会直接覆盖它">
                  <select
                    className="text-input"
                    value={targetId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTargetId(value);
                      const target = devices.find((device) => device.id === value);
                      if (target) setName(target.name);
                    }}
                  >
                    <option value="">+ 新增一个设备</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="设备名称">
                  <input
                    className="text-input"
                    value={name}
                    maxLength={30}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：iPhone 16 Pro"
                  />
                </Field>

                <div className="screen-inputs">
                  <label>
                    X
                    <input
                      type="number"
                      value={screen.x}
                      onChange={(e) => patchRect({ x: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={screen.y}
                      onChange={(e) => patchRect({ y: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    宽
                    <input
                      type="number"
                      value={screen.w}
                      onChange={(e) => patchRect({ w: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    高
                    <input
                      type="number"
                      value={screen.h}
                      onChange={(e) => patchRect({ h: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    圆角
                    <input
                      type="number"
                      value={screen.radius ?? 0}
                      onChange={(e) => patchRect({ radius: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <Field label="图层关系">
                  <Segmented<'under' | 'over'>
                    value={mode}
                    options={[
                      { value: 'under', label: '设备框在上层' },
                      { value: 'over', label: '截图在上层' },
                    ]}
                    onChange={setMode}
                  />
                </Field>
                <p className="hint">
                  透明屏幕素材选「设备框在上层」；不透明黑屏素材选「截图在上层」。
                </p>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={shadow}
                    onChange={(e) => setShadow(e.target.checked)}
                  />
                  叠加一层设备阴影（素材自带阴影时不要勾选）
                </label>

                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={handleCopy}>
                    复制配置
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleAdd}
                    disabled={!canUse || busy}
                  >
                    {busy ? '处理中…' : '临时使用'}
                  </button>
                </div>

                <p className="hint">
                  「临时使用」刷新页面后失效。要长期使用：把这张 PNG 放到
                  public/frames/，再把「复制配置」得到的 JSON 粘贴到
                  public/frames/devices.json 的 devices 数组里。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
