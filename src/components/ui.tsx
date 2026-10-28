import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Section({
  title,
  tag,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
}: {
  title: string;
  tag?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}): ReactNode {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(v);
    onOpenChange?.(v);
  };
  return (
    <section className="section">
      <button
        type="button"
        className={`section-head ${open ? '' : 'closed'}`}
        onClick={() => setOpen(!open)}
      >
        <span className="section-title">
          {title}
          {tag ? <em className="tag">{tag}</em> : null}
        </span>
        <Icon name="chevronDown" size={14} className="chev" />
      </button>
      {open ? <div className="section-body">{children}</div> : null}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="field">
      <div className="field-head">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'on' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Range({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}): ReactNode {
  return (
    <div className="range">
      <div className="range-head">
        <span>{label}</span>
        <span className="range-val">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Swatches({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}): ReactNode {
  const lower = value.toLowerCase();
  return (
    <div className="swatches">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch ${color.toLowerCase() === lower ? 'on' : ''}`}
          style={{ background: color }}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
      <label className="swatch custom" title="自定义颜色">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export function UploadBox({
  label,
  hint,
  preview,
  onFile,
  onFiles,
  onRemove,
  accept = 'image/*',
  tall = false,
  compact = false,
  contain = false,
  multiple = false,
}: {
  label: string;
  hint?: string;
  preview?: string;
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  onRemove?: () => void;
  accept?: string;
  tall?: boolean;
  compact?: boolean;
  contain?: boolean;
  multiple?: boolean;
}): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    if (multiple && onFiles) onFiles(list);
    else onFile?.(list[0]);
  };

  return (
    <div className="upload-wrap">
      <div
        className={`upload ${preview ? 'has-preview' : ''} ${tall ? 'tall' : ''} ${
          compact ? 'compact' : ''
        } ${over ? 'over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = '';
          }}
        />
        {preview ? (
          <>
            <img src={preview} alt="" className={contain ? 'contain' : ''} />
            <span className="upload-overlay">
              <Icon name="upload" size={13} /> 更换
            </span>
          </>
        ) : (
          <div className="upload-empty">
            <span className="upload-icon">
              <Icon name="upload" size={16} />
            </span>
            <span className="upload-label">{label}</span>
            {hint ? <small>{hint}</small> : null}
          </div>
        )}
      </div>
      {preview && onRemove ? (
        <button type="button" className="link-danger" onClick={onRemove}>
          <Icon name="trash" size={12} /> 移除
        </button>
      ) : null}
    </div>
  );
}
