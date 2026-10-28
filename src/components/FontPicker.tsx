import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  COMMON_FONTS,
  FALLBACK_OTHER_FONTS,
  fontFamilyValue,
  getCachedSystemFonts,
  loadSystemFonts,
  type FontChoice,
} from '../lib/fonts';
import { Icon } from './Icon';

type Status = 'idle' | 'loading' | 'done' | 'error' | 'unsupported';

export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (font: string) => void;
}): ReactNode {
  const [systemFonts, setSystemFonts] = useState<string[]>(getCachedSystemFonts);
  const [status, setStatus] = useState<Status>(
    getCachedSystemFonts().length ? 'done' : 'idle',
  );
  const [message, setMessage] = useState('');

  const installed = useMemo(
    () => new Set(systemFonts.map((name) => name.toLowerCase())),
    [systemFonts],
  );

  const common = useMemo(() => {
    if (systemFonts.length === 0) return COMMON_FONTS;
    return COMMON_FONTS.filter(
      (font) => !font.family || installed.has(font.family.toLowerCase()),
    );
  }, [systemFonts, installed]);

  const commonFamilies = useMemo(
    () =>
      new Set(
        COMMON_FONTS.map((font) => font.family?.toLowerCase()).filter(
          (name): name is string => Boolean(name),
        ),
      ),
    [],
  );

  const others: FontChoice[] = useMemo(() => {
    if (systemFonts.length > 0) {
      return systemFonts
        .filter((name) => !commonFamilies.has(name.toLowerCase()))
        .map((name) => ({
          label: name,
          value: fontFamilyValue(name),
          family: name,
        }));
    }
    return FALLBACK_OTHER_FONTS.filter(
      (font) => !font.family || !commonFamilies.has(font.family.toLowerCase()),
    );
  }, [systemFonts, commonFamilies]);

  const hasValue =
    common.some((font) => font.value === value) ||
    others.some((font) => font.value === value);

  const load = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const list = await loadSystemFonts();
      setSystemFonts(list);
      setStatus('done');
    } catch (error) {
      const unsupported = error instanceof Error && error.message === 'unsupported';
      setStatus(unsupported ? 'unsupported' : 'error');
      setMessage(
        unsupported
          ? '当前浏览器不支持读取系统字体，已显示内置字体列表'
          : '未获得字体访问权限，已显示内置字体列表',
      );
    }
  };

  return (
    <div className="font-picker">
      <div className="font-picker-row">
        <select
          className="text-input"
          value={value}
          onPointerDown={() => {
            if (status === 'idle') load();
          }}
          onChange={(e) => onChange(e.target.value)}
        >
          {hasValue ? null : <option value={value}>当前字体</option>}
          <optgroup label="常用字体">
            {common.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={systemFonts.length ? '其他系统字体' : '其他字体'}>
            {others.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          className="mini-btn font-load-btn"
          onClick={load}
          disabled={status === 'loading'}
          title="读取本机安装的全部字体"
        >
          <Icon
            name="rotate"
            size={12}
            className={status === 'loading' ? 'spin' : ''}
          />
          {status === 'loading' ? '读取中' : status === 'done' ? '刷新' : '读取'}
        </button>
      </div>
      <div className="font-picker-status">
        {status === 'idle' ? '点击「读取」加载本机全部字体' : null}
        {status === 'loading' ? '正在读取系统字体…' : null}
        {status === 'done' ? `已读取 ${systemFonts.length} 个系统字体` : null}
        {status === 'error' || status === 'unsupported' ? message : null}
      </div>
    </div>
  );
}
