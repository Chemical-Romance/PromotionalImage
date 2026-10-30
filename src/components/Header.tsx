import type { ReactNode } from 'react';
import type { Project } from '../types';
import { SIZES } from '../data';
import { Icon } from './Icon';

export function Header({
  project,
  presetId,
  busy,
  onSize,
  onCustomSize,
  onSave,
  onApplyDesignToAll,
  onExportCurrent,
  onExportAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAI,
}: {
  project: Project;
  presetId: string;
  busy: boolean;
  onSize: (w: number, h: number) => void;
  onCustomSize: () => void;
  onSave: () => void;
  onApplyDesignToAll: () => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAI: () => void;
}): ReactNode {
  const count = project.slides.length;

  return (
    <header className="header">
      <div className="brand">
        <div className="logo">
          <Icon name="sparkles" size={18} strokeWidth={1.6} />
        </div>
        <div className="brand-text">
          <div className="brand-name">宣传图工坊</div>
          <div className="brand-sub">App Promo Studio</div>
        </div>
      </div>

      <div className="header-mid">
        <span className="header-label">画布尺寸</span>
        <select
          className="size-select"
          value={presetId}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              onCustomSize();
              return;
            }
            const preset = SIZES.find((s) => s.id === e.target.value);
            if (preset) onSize(preset.w, preset.h);
          }}
        >
          {SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} · {s.note}
            </option>
          ))}
          <option value="custom">
            自定义尺寸 · {project.size.w} × {project.size.h}
          </option>
        </select>
        <div className="undo-redo">
          <button
            type="button"
            className="btn ghost compact"
            title="撤销 (Ctrl+Z)"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Icon name="undo" size={14} />
          </button>
          <button
            type="button"
            className="btn ghost compact"
            title="重做 (Ctrl+Y)"
            onClick={onRedo}
            disabled={!canRedo}
          >
            <Icon name="redo" size={14} />
          </button>
        </div>
        <button
          type="button"
          className="btn ghost compact"
          title="将当前页的设备和布局应用到全部页面"
          onClick={onApplyDesignToAll}
        >
          <Icon name="layers" size={14} />
          应用到全部
        </button>
      </div>

      <div className="header-actions">
        <button type="button" className="btn ai-entry" onClick={onAI}>
          <Icon name="sparkles" size={15} />
          AI 智能体
        </button>
        <button type="button" className="btn ghost" onClick={onSave}>
          <Icon name="save" size={15} />
          保存设置
        </button>
        <button type="button" className="btn ghost" onClick={onExportCurrent} disabled={busy}>
          <Icon name="download" size={15} />
          导出当前页
        </button>
        <button type="button" className="btn primary" onClick={onExportAll} disabled={busy}>
          <Icon name={busy ? 'rotate' : 'layers'} size={15} className={busy ? 'spin' : ''} />
          {busy ? '导出中…' : `导出全部 ${count} 页`}
        </button>
      </div>
    </header>
  );
}
