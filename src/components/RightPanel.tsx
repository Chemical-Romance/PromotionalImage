import type { ReactNode } from 'react';
import type { Illustration, Slide } from '../types';
import { LAYER_NAMES, STICKER_COLORS } from '../data';
import { Icon } from './Icon';
import { Field, Range, Swatches } from './ui';

const GLYPHS: Record<string, string> = {
  star: '★',
  spark: '✦',
  circle: '●',
  heart: '♥',
  squiggle: '∿',
  burst: '✹',
};

export function RightPanel({
  slide,
  selectedId,
  onSelect,
  onChange,
  onMove,
  onDelete,
  onClear,
}: {
  slide: Slide;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Illustration>) => void;
  onMove: (id: string, direction: 1 | -1) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}): ReactNode {
  const list = [...slide.illustrations].reverse();
  const selected = slide.illustrations.find((el) => el.id === selectedId) ?? null;
  const canColor = selected ? selected.kind !== 'image' && selected.kind !== 'emoji' : false;

  return (
    <aside className="panel right-panel">
      <div className="rp-head">
        <span>图层</span>
        <span className="rp-count">{slide.illustrations.length}</span>
      </div>

      <div className="layer-list">
        {list.length === 0 ? (
          <div className="empty">
            <Icon name="layers" size={20} />
            <span>还没有插图</span>
            <small>从左侧添加星星、表情，或上传自己的 PNG</small>
          </div>
        ) : (
          list.map((el) => {
            const index = slide.illustrations.indexOf(el);
            return (
              <div
                key={el.id}
                className={`layer ${selectedId === el.id ? 'on' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(el.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(el.id);
                }}
              >
                <span className="layer-ico" style={{ color: el.color }}>
                  <LayerThumb el={el} />
                </span>
                <span className="layer-name">{LAYER_NAMES[el.kind]}</span>
                <span className="layer-btns" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="icon-btn"
                    title="上移一层"
                    disabled={index === slide.illustrations.length - 1}
                    onClick={() => onMove(el.id, 1)}
                  >
                    <Icon name="up" size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="下移一层"
                    disabled={index === 0}
                    onClick={() => onMove(el.id, -1)}
                  >
                    <Icon name="down" size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="删除"
                    onClick={() => onDelete(el.id)}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {slide.illustrations.length > 0 ? (
        <button type="button" className="link-btn danger clear-layers" onClick={onClear}>
          清空全部插图
        </button>
      ) : null}

      <div className="rp-head">
        <span>属性</span>
        {selected ? <span className="rp-count">{LAYER_NAMES[selected.kind]}</span> : null}
      </div>

      <div className="props-panel">
        {!selected ? (
          <div className="empty">
            <Icon name="sparkles" size={20} />
            <span>未选中插图</span>
            <small>在画布或图层列表中选中一个元素</small>
          </div>
        ) : (
          <>
            <Range
              label="大小"
              value={selected.w}
              min={0.03}
              max={0.85}
              step={0.005}
              display={`${Math.round(selected.w * 100)}%`}
              onChange={(v) => {
                const ratio = selected.w > 0 ? selected.h / selected.w : 1;
                onChange(selected.id, { w: v, h: v * ratio });
              }}
            />
            <Range
              label="旋转"
              value={selected.rotation}
              min={-180}
              max={180}
              step={1}
              display={`${Math.round(selected.rotation)}°`}
              onChange={(v) => onChange(selected.id, { rotation: v })}
            />
            <Range
              label="不透明度"
              value={selected.opacity}
              min={0.1}
              max={1}
              step={0.01}
              display={`${Math.round(selected.opacity * 100)}%`}
              onChange={(v) => onChange(selected.id, { opacity: v })}
            />
            {canColor ? (
              <Field label="颜色">
                <Swatches
                  colors={STICKER_COLORS}
                  value={selected.color}
                  onChange={(c) => onChange(selected.id, { color: c })}
                />
              </Field>
            ) : null}
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                onChange(selected.id, { cx: 0.5, cy: 0.5, rotation: 0 })
              }
            >
              <Icon name="grid" size={13} /> 回到画布中心
            </button>
            <p className="hint">画布中拖动移动，四角缩放，顶部圆点旋转。Delete 删除，方向键微调。</p>
          </>
        )}
      </div>
    </aside>
  );
}

function LayerThumb({ el }: { el: Illustration }): ReactNode {
  if (el.kind === 'image' && el.src) {
    return <img src={el.src} alt="" className="layer-img" />;
  }
  if (el.kind === 'emoji') {
    return <span className="layer-emoji">{el.emoji}</span>;
  }
  return <span className="layer-glyph">{GLYPHS[el.kind] ?? '★'}</span>;
}
