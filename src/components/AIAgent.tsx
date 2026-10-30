import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Project, DeviceDef, DeviceSlot, Background, TextPos, ShotFit } from '../types';
import type { AISlideSuggestion, AISuggestion } from '../lib/ai';
import { analyzeScreenshots, testAIProxy } from '../lib/ai';
import { extractColor, generateGradient } from '../lib/color';
import { createSlide } from '../data';
import { prepareImage, uid } from '../lib/utils';
import { Icon } from './Icon';

interface ScreenshotItem {
  id: string;
  dataUrl: string;
  filename: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (updater: (prev: Project) => Project) => void;
  devices: DeviceDef[];
  project: Project;
}

/** 根据设备 hint 匹配 devices 里的 id */
function pickDeviceId(hint: string | undefined, devices: DeviceDef[], prompt?: string): string | undefined {
  // 优先从用户 prompt 里直接匹配设备名（比如 "mac air"、"iphone 15"）
  if (prompt) {
    const pLower = prompt.toLowerCase();
    for (const d of devices) {
      if (pLower.includes(d.id.toLowerCase())) return d.id;
      if (d.name && pLower.includes(d.name.toLowerCase())) return d.id;
    }
  }
  // 再看 AI 返回的 deviceHint
  if (!hint) return undefined;
  const lower = hint.toLowerCase();
  const keywords: Record<string, string[]> = {
    phone: ['iphone', 'phone', '手机'],
    tablet: ['ipad', 'tablet', '平板'],
    desktop: ['mac', 'desktop', '电脑', '笔记本', 'air', 'book'],
  };
  for (const kws of Object.values(keywords)) {
    if (kws.some((k) => lower.includes(k))) {
      const match = devices.find((d) =>
        kws.some((k) => d.id.toLowerCase().includes(k) || d.name.toLowerCase().includes(k)),
      );
      if (match) return match.id;
    }
  }
  return undefined;
}

function pickTextPos(hint: string | undefined, prompt: string, isPortrait: boolean): TextPos {
  const combined = `${prompt} ${hint || ''}`.toLowerCase();
  // 用户/AI 明确指定了布局
  if (/左右|侧|side|left|right/.test(combined)) return 'side';
  if (/顶部|上|top|header/.test(combined)) return 'top';
  if (/底部|下|bottom|footer/.test(combined)) return 'bottom';
  if (/居中|center/.test(combined)) return 'top';
  // 按画布尺寸自动判断
  return isPortrait ? 'top' : 'side';
}

export function AIAgent({ open, onClose, onApply, devices }: Props): ReactNode {
  const [prompt, setPrompt] = useState('');
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AISuggestion | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [proxyOk, setProxyOk] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const items: ScreenshotItem[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await prepareImage(f, { maxDim: 2048 });
      items.push({ id: uid(), dataUrl, filename: f.name });
    }
    setScreenshots((prev) => [...prev, ...items]);
    setErrorMsg(null);
    setResult(null);
  };

  const removeShot = (id: string) => {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
  };

  const run = async () => {
    if (screenshots.length === 0) {
      setErrorMsg('请至少上传 1 张应用截图');
      return;
    }
    setAnalyzing(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const suggest = await analyzeScreenshots(
        prompt,
        screenshots.map((s) => ({ dataUrl: s.dataUrl, filename: s.filename })),
      );
      setResult(suggest);
      setProxyOk(true);
    } catch (e: any) {
      setErrorMsg(e?.message || 'AI 分析失败');
      setProxyOk(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const apply = () => {
    if (!result) return;

    onApply((prev) => {
      // 优先用 AI 返回的 primaryColor，但必须是合法 HEX；否则从 prompt 里提取；都没有才默认
      const aiColor = result.primaryColor?.match(/^#[0-9A-Fa-f]{3,6}$/) ? result.primaryColor : null;
      const primary = aiColor || extractColor(prompt) || '#5B5BF0';
      const grad = generateGradient(primary);
      const bg: Background = {
        type: 'gradient',
        gradient: `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`,
        color: grad.from,
        fit: 'cover',
        align: 'center',
        dim: 0,
      };

      const deviceId = pickDeviceId(result.deviceHint, devices, prompt) ?? devices[0]?.id ?? 'none';
      const slots: DeviceSlot[] = [{ id: uid(), device: deviceId }];

      const isPortrait = prev.size.h > prev.size.w * 1.1;
      const textPos = pickTextPos(result.bgHint, prompt, isPortrait);

      const newSlides = result.slides.map((s: AISlideSuggestion, i: number) => {
        const slide = createSlide();
        return {
          ...slide,
          title: s.title || `截图 ${i + 1}`,
          subtitle: s.subtitle,
          bg: { ...bg },
          textPos,
          devices: slots,
          deviceStates: {
            [slots[0].id]: {
              screenshot: screenshots[i]?.dataUrl,
              fit: 'contain' as ShotFit,
              scale: 1,
              x: 0,
              y: 0,
            },
          },
          illustrations: [],
        };
      });

      if (newSlides.length === 0) return prev;

      // 根据 textPos 自动切换画布尺寸：side 需要横屏，top/bottom 需要竖屏
      const currentRatio = prev.size.w / prev.size.h;
      const needLandscape = textPos === 'side';
      let size = prev.size;
      if (needLandscape && currentRatio < 1.1) {
        // 竖屏 → 横屏，选 feishu 1600×1000（最宽的横屏）
        size = { w: 1600, h: 1000 };
      } else if (!needLandscape && currentRatio > 0.95) {
        // 横屏 → 竖屏，选 pro 1242×2688
        size = { w: 1242, h: 2688 };
      }

      return {
        ...prev,
        size,
        textPos,
        devices: slots,
        slides: newSlides,
      };
    });

    setPrompt('');
    setScreenshots([]);
    setResult(null);
    onClose();
  };

  const checkProxy = async () => {
    setErrorMsg(null);
    setProxyOk(null);
    const r = await testAIProxy();
    setProxyOk(r.ok);
    if (!r.ok) setErrorMsg(r.message);
  };

  if (!open) return null;

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-header">
          <div className="ai-title">
            <Icon name="sparkles" size={18} />
            AI 智能体
            {proxyOk === false && (
              <span className="ai-proxy-badge bad" title="AI 代理不可用">
                代理未就绪
              </span>
            )}
            {proxyOk === true && (
              <span className="ai-proxy-badge good" title="AI 代理正常">
                代理就绪
              </span>
            )}
          </div>
          <div className="ai-header-btns">
            <button
              type="button"
              className="btn ghost compact"
              onClick={checkProxy}
              title="测试 AI 代理连接"
            >
              <Icon name="rotate" size={14} />
            </button>
            <button type="button" className="btn ghost compact" onClick={onClose}>
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        <div className="ai-body">
          <div className="ai-intro">
            告诉我你想做什么样的宣传图，再上传几张应用截图 —— AI 会帮你生成标题、副标题、背景和排版。
            <br />
            <span className="ai-hint-inline">AI 配置由服务器端管理，无需手动填写 API Key。</span>
          </div>

          <div className="ai-prompt">
            <textarea
              className="ai-prompt-input"
              rows={3}
              placeholder="比如：主色调蓝色，内容是进销存系统，想做 iPhone 竖屏效果图"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="ai-shots">
            <div className="ai-shots-title">
              应用截图（{screenshots.length}）
              <span className="ai-shots-hint">— 每张截图会生成一页宣传图</span>
            </div>
            <div className="ai-shots-grid">
              {screenshots.map((s) => (
                <div key={s.id} className="ai-shot-card">
                  <img src={s.dataUrl} alt={s.filename} />
                  <button
                    type="button"
                    className="ai-shot-del"
                    onClick={() => removeShot(s.id)}
                    title="删除"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ai-shot-add"
                onClick={() => fileRef.current?.click()}
                disabled={analyzing}
              >
                <Icon name="plus" size={20} />
                <span>上传截图</span>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          {analyzing && (
            <div className="ai-loading">
              <Icon name="rotate" size={16} className="spin" />
              AI 正在分析截图并生成文案…
            </div>
          )}

          {errorMsg && <div className="ai-error">{errorMsg}</div>}

          {result && !analyzing && (
            <div className="ai-result">
              <div className="ai-result-title">
                预览 · 主色调
                <span
                  className="ai-color-swatch"
                  style={{ background: result.primaryColor || extractColor(prompt) || '#5B5BF0' }}
                />
              </div>
              {result.slides.map((s, i) => (
                <div key={i} className="ai-slide-preview">
                  <div className="ai-slide-idx">{i + 1}</div>
                  <div className="ai-slide-texts">
                    <div className="ai-slide-title">{s.title || '(待补充)'}</div>
                    {s.subtitle && <div className="ai-slide-sub">{s.subtitle}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ai-footer">
          {result ? (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setResult(null);
                }}
              >
                重新生成
              </button>
              <button type="button" className="btn primary" onClick={apply}>
                <Icon name="check" size={14} />
                应用到画布
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={run}
              disabled={analyzing}
            >
              <Icon name="sparkles" size={14} />
              让 AI 生成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
