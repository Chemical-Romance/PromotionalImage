import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Align,
  BgAlign,
  BgFit,
  DeviceDef,
  DeviceState,
  Project,
  ShotFit,
  Slide,
  TextPos,
} from '../types';
import {
  BG_ALIGNS,
  BG_SOLIDS,
  EMOJIS,
  GRADIENTS,
  SIZES,
  STICKERS,
  TEXT_COLORS,
  ensureSlideDevices,
  getDeviceState,
  pickTextForBg,
  resolveDevices,
  resolveTextStyle,
  type StickerDef,
} from '../data';
import { clamp, uid } from '../lib/utils';
import { Icon } from './Icon';
import { Field, Range, Section, Segmented, Swatches, UploadBox } from './ui';
import { FontPicker } from './FontPicker';

interface LeftPanelProps {
  project: Project;
  slide: Slide;
  devices: DeviceDef[];
  onProject: (patch: Partial<Project>) => void;
  onSlide: (patch: Partial<Slide>) => void;
  onSize: (w: number, h: number) => void;
  canvasOpen?: boolean;
  onCanvasOpenChange?: (v: boolean) => void;
  onUploadBg: (file: File) => void;
  onUploadDeviceShot: (slotId: string, files: File[]) => void;
  onUploadSticker: (file: File) => void;
  onAddSticker: (kind: StickerDef['kind']) => void;
  onAddEmoji: (emoji: string) => void;
  onClearIllustrations: () => void;
  onImportDevice: () => void;
}

export function LeftPanel({
  project,
  slide,
  devices,
  onProject,
  onSlide,
  onSize,
  canvasOpen,
  onCanvasOpenChange,
  onUploadBg,
  onUploadDeviceShot,
  onUploadSticker,
  onAddSticker,
  onAddEmoji,
  onClearIllustrations,
  onImportDevice,
}: LeftPanelProps): ReactNode {
  const slots = resolveDevices(slide, project);
  const selectedIds = slots.map((slot) => slot.device);

  const updateState = (
    slotId: string,
    index: number,
    patch: Partial<DeviceState>,
  ) => {
    const current = getDeviceState(slide, slotId, index);
    onSlide({
      deviceStates: {
        ...(slide.deviceStates ?? {}),
        [slotId]: { ...current, ...patch },
      },
    });
  };

  const toggleDevice = (modelId: string) => {
    const current = slots;
    const existing = current.findIndex((slot) => slot.device === modelId);
    if (existing >= 0) {
      if (current.length <= 1) return;
      onSlide({
        devices: ensureSlideDevices(slide, project).filter((_, index) => index !== existing),
      });
      return;
    }
    if (current.length >= 3) return;
    onSlide({
      devices: [...ensureSlideDevices(slide, project), { id: uid(), device: modelId }],
    });
  };

  const moveSlot = (index: number, direction: 1 | -1) => {
    const current = slots;
    const next = index + direction;
    if (next < 0 || next >= current.length) return;
    const list = [...ensureSlideDevices(slide, project)];
    [list[index], list[next]] = [list[next], list[index]];
    onSlide({ devices: list });
  };

  const removeSlot = (slotId: string) => {
    if (slots.length <= 1) return;
    onSlide({
      devices: ensureSlideDevices(slide, project).filter((slot) => slot.id !== slotId),
    });
  };
  return (
    <aside className="panel left-panel">
      <div className="panel-scroll">
        <Section title="画布尺寸" tag="全局" defaultOpen={false} open={canvasOpen} onOpenChange={onCanvasOpenChange}>
          <div className="size-grid">
            {SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`size-card ${project.size.w === s.w && project.size.h === s.h ? 'on' : ''}`}
                onClick={() => onSize(s.w, s.h)}
              >
                <span>{s.label}</span>
                <small>{s.note}</small>
              </button>
            ))}
          </div>
          <CustomSize w={project.size.w} h={project.size.h} onApply={onSize} />
        </Section>

        <Section title="设备模型" tag="模型">
          <p className="hint">
            点击设备卡片可多选（最多 3 台）；再次点击已选设备可取消。数字表示图层顺序。
          </p>
          <div className="device-grid">
            {devices.map((d) => {
              const order = selectedIds.indexOf(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`device-card ${order >= 0 ? 'on' : ''}`}
                  onClick={() => toggleDevice(d.id)}
                  title={order >= 0 ? '点击取消选择' : '点击添加设备'}
                >
                  {order >= 0 ? <span className="device-order">{order + 1}</span> : null}
                  {d.image ? (
                    <img className="device-glyph-img" src={d.image.image} alt="" />
                  ) : (
                    <DeviceGlyph frame={d.frame} />
                  )}
                  <span className="dc-name">{d.name}</span>
                  <small>{d.note}</small>
                </button>
              );
            })}
            <button type="button" className="device-card import" onClick={onImportDevice}>
              <span className="device-import-plus">
                <Icon name="plus" size={16} />
              </span>
              <span className="dc-name">自定义设备</span>
              <small>导入 PNG 模型</small>
            </button>
          </div>

          {slots.map((slot, index) => {
            const model = devices.find((device) => device.id === slot.device);
            const state = getDeviceState(slide, slot.id, index);
            return (
              <div className="device-slot" key={slot.id}>
                <div className="device-slot-head">
                  <span className="device-slot-name">
                    {index + 1}. {model?.name ?? '设备'}
                  </span>
                  <span className="device-slot-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="移除设备"
                      disabled={slots.length <= 1}
                      onClick={() => removeSlot(slot.id)}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="下移一层"
                      disabled={index === 0}
                      onClick={() => moveSlot(index, -1)}
                    >
                      <Icon name="down" size={12} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="上移一层"
                      disabled={index === slots.length - 1}
                      onClick={() => moveSlot(index, 1)}
                    >
                      <Icon name="up" size={12} />
                    </button>
                  </span>
                </div>
                <Range
                  label="大小"
                  value={state.scale}
                  min={0.2}
                  max={1.6}
                  step={0.01}
                  display={`${Math.round(state.scale * 100)}%`}
                  onChange={(v) => updateState(slot.id, index, { scale: v })}
                />
                <Range
                  label="左右位置"
                  value={state.x}
                  min={-0.25}
                  max={0.25}
                  step={0.005}
                  display={`${Math.round(state.x * 100)}%`}
                  onChange={(v) => updateState(slot.id, index, { x: v })}
                />
                <Range
                  label="上下位置"
                  value={state.y}
                  min={-0.25}
                  max={0.25}
                  step={0.005}
                  display={`${Math.round(state.y * 100)}%`}
                  onChange={(v) => updateState(slot.id, index, { y: v })}
                />
              </div>
            );
          })}

          <p className="hint">
            大小和位置作用于当前页；也可以直接在画布上拖动设备、拖角缩放。
          </p>
        </Section>

        <Section title="App 截图" tag="当前页">
          {slots.map((slot, index) => {
            const model = devices.find((device) => device.id === slot.device);
            const state = getDeviceState(slide, slot.id, index);
            const first = index === 0;
            return (
              <div className="shot-slot" key={slot.id}>
                <div className="shot-slot-head">
                  <span>
                    {index + 1}. {model?.name ?? '设备'}
                  </span>
                </div>
                <UploadBox
                  label="上传截图"
                  hint={first ? 'PNG / JPG · 一次多选可自动生成多页' : 'PNG / JPG'}
                  preview={state.screenshot}
                  onFile={
                    first
                      ? undefined
                      : (file) => onUploadDeviceShot(slot.id, [file])
                  }
                  onFiles={
                    first
                      ? (files) => onUploadDeviceShot(slot.id, files)
                      : undefined
                  }
                  multiple={first}
                  onRemove={() =>
                    updateState(slot.id, index, { screenshot: undefined })
                  }
                  contain
                />
                <Field label="屏幕内显示">
                  <Segmented<ShotFit>
                    value={state.fit}
                    options={[
                      { value: 'cover', label: '裁切填满' },
                      { value: 'contain', label: '完整显示' },
                      { value: 'stretch', label: '拉伸显示' },
                    ]}
                    onChange={(v) => updateState(slot.id, index, { fit: v })}
                  />
                </Field>
              </div>
            );
          })}
          <p className="hint">
            第一台设备可一次选择多张截图自动生成多页；其他设备的截图会随页面一起复制。
          </p>
        </Section>

        <Section title="背景" tag="当前页">
          <Segmented
            value={slide.bg.type}
            options={[
              { value: 'gradient', label: '渐变' },
              { value: 'solid', label: '纯色' },
              { value: 'image', label: '图片' },
            ]}
            onChange={(v) => onSlide({ bg: { ...slide.bg, type: v } })}
          />

          {slide.bg.type === 'gradient' ? (
            <>
              <div className="gradient-grid">
                {GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`gradient-card ${slide.bg.gradient === g.id ? 'on' : ''}`}
                    onClick={() => {
                      onSlide({ bg: { ...slide.bg, gradient: g.id, type: 'gradient' } });
                      onSlide({
                        textColor: pickTextForBg('gradient', g.id, g.from, resolveTextStyle(slide, project).textPos),
                      });
                    }}
                    title={g.name}
                  >
                    <span
                      className="gradient-bar"
                      style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                    />
                    <span className="gradient-name">{g.name}</span>
                  </button>
                ))}
                <GradientCustomCard
                  current={slide.bg.gradient}
                  onApply={(from, to, angle) => {
                    const val = `linear-gradient(${angle}deg, ${from}, ${to})`;
                    onSlide({ bg: { ...slide.bg, gradient: val, type: 'gradient' } });
                    // 用 from 颜色估一个文字颜色
                    onSlide({
                      textColor: pickTextForBg('gradient', val, from, resolveTextStyle(slide, project).textPos),
                    });
                  }}
                />
              </div>
            </>
          ) : null}

          {slide.bg.type === 'solid' ? (
            <div className="solid-grid">
              {BG_SOLIDS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`gradient-card ${slide.bg.color.toLowerCase() === s.color.toLowerCase() ? 'on' : ''}`}
                  onClick={() => {
                    onSlide({ bg: { ...slide.bg, color: s.color, type: 'solid' } });
                    onSlide({ textColor: pickTextForBg('solid', '', s.color, resolveTextStyle(slide, project).textPos) });
                  }}
                  title={`${s.name} ${s.color}`}
                >
                  <span
                    className="gradient-bar"
                    style={{ background: s.color }}
                  />
                  <span className="gradient-name">{s.name}</span>
                </button>
              ))}
              <label className="gradient-card custom-color">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(slide.bg.color) ? slide.bg.color : '#6366f1'}
                  onChange={(e) => {
                    const c = e.target.value;
                    onSlide({ bg: { ...slide.bg, color: c, type: 'solid' } });
                    onSlide({ textColor: pickTextForBg('solid', '', c, resolveTextStyle(slide, project).textPos) });
                  }}
                />
                <span className="gradient-bar">
                  <span className="custom-plus">+</span>
                </span>
                <span className="gradient-name">自定义</span>
              </label>
            </div>
          ) : null}

          {slide.bg.type === 'image' ? (
            <>
              <UploadBox
                label="上传背景图"
                hint="PNG / JPG · 建议竖版"
                preview={slide.bg.image}
                onFile={onUploadBg}
                onRemove={() => onSlide({ bg: { ...slide.bg, image: undefined } })}
                tall
              />
              {slide.bg.image ? (
                <>
                  <Field label="展示方式">
                    <Segmented<BgFit>
                      value={slide.bg.fit ?? 'cover'}
                      options={[
                        { value: 'cover', label: '裁切填满' },
                        { value: 'contain', label: '完整显示' },
                        { value: 'stretch', label: '拉伸铺满' },
                      ]}
                      onChange={(v) => onSlide({ bg: { ...slide.bg, fit: v } })}
                    />
                  </Field>
                  {(slide.bg.fit ?? 'cover') !== 'stretch' ? (
                    <Field label="对齐方式" hint="裁切 / 留白时的锚点">
                      <div className="align-grid">
                        {BG_ALIGNS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`align-cell ${
                              (slide.bg.align ?? 'center') === option.value ? 'on' : ''
                            }`}
                            title={option.label}
                            onClick={() =>
                              onSlide({
                                bg: { ...slide.bg, align: option.value as BgAlign },
                              })
                            }
                          >
                            <span className="align-dot" />
                          </button>
                        ))}
                      </div>
                    </Field>
                  ) : (
                    <p className="hint">拉伸铺满会忽略原图比例与对齐方式。</p>
                  )}
                </>
              ) : null}
            </>
          ) : null}

          <Range
            label="背景压暗"
            value={slide.bg.dim}
            min={0}
            max={0.7}
            step={0.01}
            display={`${Math.round(slide.bg.dim * 100)}%`}
            onChange={(v) => onSlide({ bg: { ...slide.bg, dim: v } })}
          />
        </Section>

        <Section title="文字内容" tag="当前页">
          <Field label="标题" hint={`${slide.title.length} 字`}>
            <textarea
              rows={2}
              value={slide.title}
              placeholder="例如：更聪明地安排每一天"
              onChange={(e) => onSlide({ title: e.target.value })}
            />
          </Field>
          <Field label="副标题" hint={`${slide.subtitle.length} 字`}>
            <textarea
              rows={2}
              value={slide.subtitle}
              placeholder="一句话说明核心卖点"
              onChange={(e) => onSlide({ subtitle: e.target.value })}
            />
          </Field>
          {(() => {
            const t = resolveTextStyle(slide, project);
            return (
              <>
                <Field label="文字位置">
                  <Segmented<TextPos>
                    value={t.textPos}
                    options={[
                      { value: 'top', label: '文字在上' },
                      { value: 'bottom', label: '文字在下' },
                      { value: 'side', label: '左右分栏' },
                      { value: 'none', label: '无文字' },
                    ]}
                    onChange={(v) =>
                      onSlide({
                        textPos: v,
                        textColor:
                          v === 'none'
                            ? t.textColor
                            : pickTextForBg(slide.bg.type, slide.bg.gradient, slide.bg.color, v),
                      })
                    }
                  />
                </Field>
                <Field label="对齐方式">
                  <Segmented<Align>
                    value={t.align}
                    options={[
                      { value: 'center', label: '居中' },
                      { value: 'left', label: '左对齐' },
                    ]}
                    onChange={(v) => onSlide({ align: v })}
                  />
                </Field>
                <Field label="字体">
                  <FontPicker
                    value={t.font}
                    onChange={(font) => onSlide({ font })}
                  />
                </Field>
                <Field label="文字颜色">
                  <Swatches
                    colors={TEXT_COLORS}
                    value={t.textColor}
                    onChange={(c) => onSlide({ textColor: c })}
                  />
                </Field>
                <Range
                  label="标题字号"
                  value={t.titleScale}
                  min={0.6}
                  max={1.5}
                  step={0.01}
                  display={`${Math.round(t.titleScale * 100)}%`}
                  onChange={(v) => onSlide({ titleScale: v })}
                />
                <Range
                  label="副标题字号"
                  value={t.subtitleScale}
                  min={0.6}
                  max={1.6}
                  step={0.01}
                  display={`${Math.round(t.subtitleScale * 100)}%`}
                  onChange={(v) => onSlide({ subtitleScale: v })}
                />
                <Range
                  label="水平偏移"
                  value={t.textOffset?.x ?? 0}
                  min={-0.3}
                  max={0.3}
                  step={0.01}
                  display={`${Math.round((t.textOffset?.x ?? 0) * 100)}%`}
                  onChange={(v) =>
                    onSlide({ textOffset: { x: v, y: t.textOffset?.y ?? 0 } })
                  }
                />
                <Range
                  label="垂直偏移"
                  value={t.textOffset?.y ?? 0}
                  min={-0.3}
                  max={0.3}
                  step={0.01}
                  display={`${Math.round((t.textOffset?.y ?? 0) * 100)}%`}
                  onChange={(v) =>
                    onSlide({ textOffset: { x: t.textOffset?.x ?? 0, y: v } })
                  }
                />
                {t.textPos === 'side' && (
                  <Range
                    label="文字区宽度"
                    value={t.textAreaW ?? 0.42}
                    min={0.2}
                    max={0.6}
                    step={0.01}
                    display={`${Math.round((t.textAreaW ?? 0.42) * 100)}%`}
                    onChange={(v) => onSlide({ textAreaW: v })}
                  />
                )}
              </>
            );
          })()}
        </Section>

        <Section title="小插图" tag="当前页">
          <div className="sticker-grid">
            {STICKERS.map((s) => (
              <button
                key={s.kind}
                type="button"
                className="sticker"
                onClick={() => onAddSticker(s.kind)}
                title={`添加${s.name}`}
              >
                <span className="sticker-glyph" style={{ color: s.color }}>
                  {s.glyph}
                </span>
                <small>{s.name}</small>
              </button>
            ))}
          </div>
          <div className="emoji-row">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                onClick={() => onAddEmoji(emoji)}
                title={`添加 ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <UploadBox
            label="上传自己的插图"
            hint="透明背景 PNG 效果最佳"
            onFile={onUploadSticker}
            compact
          />
          {slide.illustrations.length > 0 ? (
            <button type="button" className="link-btn danger" onClick={onClearIllustrations}>
              <Icon name="trash" size={13} /> 清空本页插图（{slide.illustrations.length}）
            </button>
          ) : null}
          <p className="hint">添加后可在画布上拖动、缩放、旋转，右侧可调整颜色与透明度。</p>
        </Section>
      </div>
    </aside>
  );
}

function CustomSize({
  w,
  h,
  onApply,
}: {
  w: number;
  h: number;
  onApply: (w: number, h: number) => void;
}): ReactNode {
  const [dw, setDw] = useState(String(w));
  const [dh, setDh] = useState(String(h));

  useEffect(() => {
    setDw(String(w));
    setDh(String(h));
  }, [w, h]);

  const apply = () => {
    const nw = Math.round(Number(dw));
    const nh = Math.round(Number(dh));
    if (!Number.isFinite(nw) || !Number.isFinite(nh) || !dw || !dh) {
      setDw(String(w));
      setDh(String(h));
      return;
    }
    onApply(clamp(nw, 240, 5000), clamp(nh, 240, 5000));
  };

  return (
    <div className="custom-size">
      <div className="custom-size-row">
        <label>
          <span>宽</span>
          <input
            id="custom-size-width"
            value={dw}
            inputMode="numeric"
            onChange={(e) => setDw(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={apply}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <span className="times">×</span>
        <label>
          <span>高</span>
          <input
            value={dh}
            inputMode="numeric"
            onChange={(e) => setDh(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={apply}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        <button type="button" className="mini-btn" onClick={apply}>
          应用
        </button>
      </div>
      <p className="hint">自定义尺寸 240 – 5000 px，输入后回车或点击应用。</p>
    </div>
  );
}

function DeviceGlyph({ frame }: { frame: string }): ReactNode {
  if (frame === 'macbook') {
    return (
      <svg className="device-glyph" width="27" height="48" viewBox="0 0 27 48" aria-hidden="true">
        <rect
          x="4"
          y="13"
          width="19"
          height="14"
          rx="1.6"
          fill="#1b2130"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <rect x="5.2" y="14.2" width="16.6" height="11.6" rx="0.8" fill="#0c0e14" />
        <rect x="12.1" y="14.2" width="2.8" height="1.1" rx="0.55" fill="currentColor" />
        <path d="M1.8 28.6h23.4l1.2 2.4H0.6z" fill="currentColor" opacity="0.55" />
        <rect x="0.6" y="31" width="25.8" height="1.8" rx="0.9" fill="currentColor" opacity="0.35" />
      </svg>
    );
  }
  if (frame === 'imac') {
    return (
      <svg className="device-glyph" width="27" height="48" viewBox="0 0 27 48" aria-hidden="true">
        <rect
          x="3"
          y="7"
          width="21"
          height="17"
          rx="1.6"
          fill="#1b2130"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <rect x="4.4" y="8.4" width="18.2" height="12.4" rx="0.6" fill="#0c0e14" />
        <path d="M12 24h3v6h-3z" fill="currentColor" opacity="0.7" />
        <rect x="8" y="30" width="11" height="2" rx="1" fill="currentColor" opacity="0.7" />
        <circle cx="13.5" cy="7.8" r="0.5" fill="currentColor" />
      </svg>
    );
  }

  const isIpad = frame === 'ipad';
  return (
    <svg className="device-glyph" width="27" height="48" viewBox="0 0 27 48" aria-hidden="true">
      <rect
        x="2.2"
        y="1.2"
        width="22.6"
        height="45.6"
        rx={isIpad ? 3 : 5.5}
        fill="#0c0e14"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="4.4"
        y="3.4"
        width="18.2"
        height="41.2"
        rx={isIpad ? 2 : 4}
        fill="#1b2130"
      />
      {frame === 'island' ? (
        <rect x="9.2" y="5.6" width="8.6" height="2.6" rx="1.3" fill="currentColor" />
      ) : null}
      {frame === 'notch' ? (
        <path
          d="M7.8 4.2h11.4v2.2a1.6 1.6 0 0 1-1.6 1.6h-8.2a1.6 1.6 0 0 1-1.6-1.6V4.2z"
          fill="currentColor"
        />
      ) : null}
      {frame === 'se' ? (
        <>
          <circle cx="13.5" cy="42" r="2.4" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="9.5" y="4.4" width="8" height="1.4" rx="0.7" fill="currentColor" opacity="0.7" />
        </>
      ) : null}
      {frame === 'ipad' ? (
        <circle cx="13.5" cy="2.6" r="0.7" fill="currentColor" opacity="0.8" />
      ) : null}
      {frame === 'none' ? (
        <rect
          x="4.4"
          y="3.4"
          width="18.2"
          height="41.2"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="3 2.5"
          opacity="0.7"
        />
      ) : null}
    </svg>
  );
}

/** 从 gradient 字段（预设 id 或 linear-gradient 字符串）反解 from/to/angle */
function parseGradient(current: string | undefined): { from: string; to: string; angle: number; isCustom: boolean } {
  const PRESET_FALLBACK = { from: '#5B5BF0', to: '#9D5CF5', angle: 150, isCustom: false as const };
  if (!current) return PRESET_FALLBACK;
  const preset = GRADIENTS.find((g) => g.id === current);
  if (preset) return { from: preset.from, to: preset.to, angle: preset.angle, isCustom: false };
  const m = current.match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg\s*,\s*([^,]+)\s*,\s*([^)]+)\)/);
  if (m) return { angle: parseFloat(m[1]), from: m[2].trim(), to: m[3].trim(), isCustom: true };
  return PRESET_FALLBACK;
}

function GradientCustomCard({
  current,
  onApply,
}: {
  current: string | undefined;
  onApply: (from: string, to: string, angle: number) => void;
}): ReactNode {
  const parsed = parseGradient(current);
  const [open, setOpen] = useState(parsed.isCustom);
  const [from, setFrom] = useState(parsed.from);
  const [to, setTo] = useState(parsed.to);
  const [angle, setAngle] = useState(parsed.angle);

  // 当外部 current 变化时同步内部状态
  useEffect(() => {
    const p = parseGradient(current);
    setFrom(p.from);
    setTo(p.to);
    setAngle(p.angle);
  }, [current]);

  const trigger = (label: string, preview: boolean) => {
    if (!preview) {
      return (
        <button
          type="button"
          className={`gradient-card gradient-custom-trigger ${parsed.isCustom ? 'on' : ''}`}
          onClick={() => setOpen(!open)}
          title={label}
        >
          <span className="gradient-bar gradient-custom-bar">
            <span
              className="gradient-custom-preview-inner"
              style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
            />
            <span className="custom-plus">+</span>
          </span>
          <span className="gradient-name">自定义渐变</span>
        </button>
      );
    }
    return null;
  };

  if (!open) {
    return trigger('自定义渐变', false);
  }

  return (
    <div className="gradient-custom">
      <div className="gradient-custom-header">
        <span className="gradient-custom-title">自定义渐变</span>
        <button
          type="button"
          className="gradient-custom-close"
          onClick={() => setOpen(false)}
          aria-label="收起"
        >×</button>
      </div>
      <div
        className="gradient-custom-preview"
        style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
      />
      <div className="gradient-custom-row">
        <label className="gradient-custom-input">
          <span>起始</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(from) ? from : '#5B5BF0'}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="gradient-custom-input">
          <span>结束</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(to) ? to : '#9D5CF5'}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="gradient-custom-row">
        <label className="gradient-custom-angle">
          <span>角度</span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={angle}
            onChange={(e) => setAngle(parseInt(e.target.value, 10))}
          />
          <span className="gradient-custom-angle-val">{angle}°</span>
        </label>
      </div>
      <button
        type="button"
        className="btn btn-primary gradient-custom-apply"
        onClick={() => onApply(from, to, angle)}
      >
        应用
      </button>
    </div>
  );
}
