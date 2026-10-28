import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DeviceDef, DeviceState, Illustration, Project, Slide } from './types';
import {
  DEVICES,
  EMOJIS,
  SIZES,
  STICKERS,
  createInitialProject,
  createSlide,
  getDeviceState,
  resolveDevices,
  resolveTextStyle,
} from './data';
import { prepareImage, imageSize, clamp, uid } from './lib/utils';
import { loadCustomFrameDevices } from './lib/customFrames';
import { exportAllAsZip, exportSlide } from './lib/export';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { CanvasStage } from './components/CanvasStage';
import { SlideStrip } from './components/SlideStrip';
import { RightPanel } from './components/RightPanel';
import { FrameImporter } from './components/FrameImporter';

export default function App(): ReactNode {
  const STORAGE_KEY = 'promo-project-v1';

  const loadProject = (): Project => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialProject();
      const parsed = JSON.parse(raw) as Project;
      if (!parsed || !parsed.slides || parsed.slides.length === 0) return createInitialProject();
      return parsed;
    } catch {
      return createInitialProject();
    }
  };

  const [project, setProjectState] = useState<Project>(loadProject);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [customDevices, setCustomDevices] = useState<DeviceDef[]>([]);
  const [importerOpen, setImporterOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // History stack for undo/redo
  const historyRef = useRef<Project[]>([]);
  const redoRef = useRef<Project[]>([]);
  const historyLocked = useRef(false); // skip history during undo/redo replay
  const HISTORY_LIMIT = 50;
  const [historyTick, setHistoryTick] = useState(0); // force re-render for button enablement

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const setProject = useCallback(
    (
      updater: Project | ((prev: Project) => Project),
      opts?: { skipHistory?: boolean },
    ) => {
      setProjectState((prev) => {
        const next =
          typeof updater === 'function' ? (updater as (p: Project) => Project)(prev) : updater;
        if (!opts?.skipHistory && !historyLocked.current) {
          historyRef.current.push(JSON.parse(JSON.stringify(prev)));
          if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
          redoRef.current = []; // new change wipes redo
          setHistoryTick((t) => t + 1);
        }
        return next;
      });
    },
    [],
  );

  const canUndo = () => historyRef.current.length > 0;
  const canRedo = () => redoRef.current.length > 0;

  const undo = useCallback(() => {
    if (!canUndo()) return;
    const prevSnapshot = historyRef.current.pop()!;
    setProjectState((current) => {
      redoRef.current.push(JSON.parse(JSON.stringify(current)));
      historyLocked.current = true;
      // use queueMicrotask so lock clears after this state flush
      queueMicrotask(() => {
        historyLocked.current = false;
      });
      return prevSnapshot;
    });
    setHistoryTick((t) => t + 1);
    showToast('已撤销');
  }, [showToast]);

  const redo = useCallback(() => {
    if (!canRedo()) return;
    const nextSnapshot = redoRef.current.pop()!;
    setProjectState((current) => {
      historyRef.current.push(JSON.parse(JSON.stringify(current)));
      if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
      historyLocked.current = true;
      queueMicrotask(() => {
        historyLocked.current = false;
      });
      return nextSnapshot;
    });
    setHistoryTick((t) => t + 1);
    showToast('已重做');
  }, [showToast]);

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (target as HTMLInputElement).type === 'color');
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (isEditable) return;
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        if (isEditable) return;
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const devices = useMemo(() => {
    const overrides = new Map(customDevices.map((device) => [device.id, device]));
    const merged = DEVICES.map((device) => overrides.get(device.id) ?? device);
    const builtInIds = new Set(DEVICES.map((device) => device.id));
    for (const device of customDevices) {
      if (!builtInIds.has(device.id)) merged.push(device);
    }
    return merged;
  }, [customDevices]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    loadCustomFrameDevices().then((list) => {
      if (alive && list.length > 0) setCustomDevices(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const addCustomDevice = (device: DeviceDef) => {
    setCustomDevices((prev) => [...prev.filter((item) => item.id !== device.id), device]);
    setProject((prev) => ({ ...prev, device: device.id }));
    setImporterOpen(false);
    showToast(`已添加「${device.name}」`);
  };

  const safeActive = Math.min(active, project.slides.length - 1);
  const activeSlide = project.slides[safeActive];
  const activeId = activeSlide.id;

  const patchProject = (patch: Partial<Project>) => {
    setProject((prev) => ({ ...prev, ...patch }));
  };

  const patchSlideById = useCallback((id: string, patch: Partial<Slide>) => {
    setProject((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  const patchActive = (patch: Partial<Slide>) => patchSlideById(activeId, patch);

  const updateIllustration = useCallback(
    (id: string, patch: Partial<Illustration>) => {
      setProject((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === activeId
            ? {
                ...s,
                illustrations: s.illustrations.map((el) =>
                  el.id === id ? { ...el, ...patch } : el,
                ),
              }
            : s,
        ),
      }));
    },
    [activeId],
  );

  const deleteIllustration = useCallback(
    (id: string) => {
      setProject((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === activeId
            ? { ...s, illustrations: s.illustrations.filter((el) => el.id !== id) }
            : s,
        ),
      }));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [activeId],
  );

  const addIllustration = (el: Illustration) => {
    patchActive({ illustrations: [...activeSlide.illustrations, el] });
    setSelectedId(el.id);
  };

  const nextSpot = (count: number) => ({
    cx: 0.5 + ((count % 3) - 1) * 0.07,
    cy: 0.38 + (count % 3) * 0.04,
  });

  const addSticker = (kind: (typeof STICKERS)[number]['kind']) => {
    const def = STICKERS.find((s) => s.kind === kind);
    const long = kind === 'squiggle';
    const spot = nextSpot(activeSlide.illustrations.length);
    const el: Illustration = {
      id: uid(),
      kind,
      color: def?.color ?? '#ffffff',
      cx: spot.cx,
      cy: spot.cy,
      w: long ? 0.26 : 0.16,
      h: long ? 0.09 : 0.16,
      rotation: 0,
      opacity: 1,
    };
    addIllustration(el);
    showToast(`已添加${def?.name ?? '插图'}`);
  };

  const addEmoji = (emoji: string) => {
    if (!EMOJIS.includes(emoji)) return;
    const spot = nextSpot(activeSlide.illustrations.length);
    const el: Illustration = {
      id: uid(),
      kind: 'emoji',
      emoji,
      color: '#ffffff',
      cx: spot.cx,
      cy: spot.cy,
      w: 0.12,
      h: 0.12,
      rotation: 0,
      opacity: 1,
    };
    addIllustration(el);
  };

  const uploadBg = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      showToast('图片过大，请使用 30MB 以内的文件');
      return;
    }
    const targetId = activeId;
    try {
      const src = await prepareImage(file, { maxDim: 2400 });
      setProject((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === targetId
            ? {
                ...s,
                bg: {
                  ...s.bg,
                  type: 'image',
                  image: src,
                  dim: s.bg.dim > 0 ? s.bg.dim : 0.12,
                },
              }
            : s,
        ),
      }));
      showToast('背景已更新');
    } catch {
      showToast('背景图片处理失败');
    }
  };

  const uploadShots = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      showToast('请选择图片文件');
      return;
    }
    if (images.some((f) => f.size > 30 * 1024 * 1024)) {
      showToast('图片过大，请使用 30MB 以内的文件');
      return;
    }

    const targetId = activeId;
    const room = Math.max(0, 10 - project.slides.length);

    try {
      const srcs = await Promise.all(
        images.map((file) => prepareImage(file, { maxDim: 3000, png: true })),
      );
      const accepted = srcs.slice(0, 1 + room);

      setProject((prev) => {
        const index = prev.slides.findIndex((s) => s.id === targetId);
        if (index < 0) return prev;
        const base = prev.slides[index];
        const next = [...prev.slides];
        next[index] = { ...base, screenshot: accepted[0] };

        const extras: Slide[] = accepted.slice(1).map((src) =>
          createSlide({
            bg: { ...base.bg },
            fit: base.fit,
            screenshot: src,
            illustrations: base.illustrations.map((el) => ({ ...el, id: uid() })),
            deviceX: base.deviceX ?? 0,
            deviceY: base.deviceY ?? 0,
            deviceScale: base.deviceScale ?? 1,
            overlayDevice: base.overlayDevice
              ? { ...base.overlayDevice }
              : undefined,
          }),
        );
        next.splice(index + 1, 0, ...extras);
        return { ...prev, slides: next };
      });

      const pages = accepted.length;
      const skipped = images.length - pages;
      if (pages > 1) {
        showToast(
          skipped > 0
            ? `已生成 ${pages} 页，另有 ${skipped} 张超出 10 页上限`
            : `已生成 ${pages} 页，请为每页填写标题`,
        );
      } else if (skipped > 0) {
        showToast(`已替换当前页，另有 ${skipped} 张超出 10 页上限`);
      } else {
        showToast('截图已放入设备');
      }
    } catch {
      showToast('截图处理失败');
    }
  };

  const uploadDeviceShot = async (slotId: string, files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      showToast('请选择图片文件');
      return;
    }
    if (images.some((f) => f.size > 30 * 1024 * 1024)) {
      showToast('图片过大，请使用 30MB 以内的文件');
      return;
    }

    const slotIndex = resolveDevices(activeSlide, project).findIndex((s) => s.id === slotId);
    const targetId = activeId;

    try {
      const srcs = await Promise.all(
        images.map((file) => prepareImage(file, { maxDim: 3000, png: true })),
      );

      setProject((prev) => {
        const index = prev.slides.findIndex((s) => s.id === targetId);
        if (index < 0) return prev;
        const base = prev.slides[index];
        const next = [...prev.slides];

        if (slotIndex === 0 && srcs.length > 1) {
          // 第一台设备多选：生成多页
          const room = Math.max(0, 10 - prev.slides.length);
          const accepted = srcs.slice(0, 1 + room);
          next[index] = {
            ...base,
            deviceStates: {
              ...(base.deviceStates ?? {}),
              [slotId]: { ...(base.deviceStates?.[slotId] ?? {}), screenshot: accepted[0] },
            },
          };
          const extras: Slide[] = accepted.slice(1).map((src) =>
            createSlide({
              bg: { ...base.bg },
              illustrations: base.illustrations.map((el) => ({ ...el, id: uid() })),
              deviceStates: {
                ...(base.deviceStates ?? {}),
                [slotId]: { ...(base.deviceStates?.[slotId] ?? {}), screenshot: src },
              },
            }),
          );
          next.splice(index + 1, 0, ...extras);
        } else {
          // 单张或非第一台设备：只更新当前页
          next[index] = {
            ...base,
            deviceStates: {
              ...(base.deviceStates ?? {}),
              [slotId]: { ...(base.deviceStates?.[slotId] ?? {}), screenshot: srcs[0] },
            },
          };
        }
        return { ...prev, slides: next };
      });

      if (slotIndex === 0 && srcs.length > 1) {
        const skipped = images.length - srcs.length;
        showToast(
          skipped > 0
            ? `已生成 ${srcs.length} 页，另有 ${skipped} 张超出 10 页上限`
            : `已生成 ${srcs.length} 页，请为每页填写标题`,
        );
      } else {
        showToast('截图已更新');
      }
    } catch {
      showToast('截图处理失败');
    }
  };

  const uploadOverlayShot = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      showToast('图片过大，请使用 30MB 以内的文件');
      return;
    }
    const targetId = activeId;
    try {
      const src = await prepareImage(file, { maxDim: 3000, png: true });
      setProject((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === targetId && s.overlayDevice
            ? { ...s, overlayDevice: { ...s.overlayDevice, screenshot: src } }
            : s,
        ),
      }));
      showToast('第二台设备截图已更新');
    } catch {
      showToast('截图处理失败');
    }
  };

  const uploadSticker = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('图片过大，请使用 20MB 以内的文件');
      return;
    }
    const targetId = activeId;
    try {
      const src = await prepareImage(file, { maxDim: 1600, png: true });
      const size = await imageSize(src);
      const aspect = size.h / size.w;
      let ew = 0.24;
      let eh = ew * aspect;
      if (eh > 0.5) {
        eh = 0.5;
        ew = eh / aspect;
      }
      const spot = nextSpot(activeSlide.illustrations.length);
      const el: Illustration = {
        id: uid(),
        kind: 'image',
        src,
        color: '#ffffff',
        cx: spot.cx,
        cy: spot.cy,
        w: clamp(ew, 0.04, 0.6),
        h: clamp(eh, 0.04, 0.6),
        rotation: 0,
        opacity: 1,
      };
      setProject((prev) => ({
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === targetId
            ? { ...s, illustrations: [...s.illustrations, el] }
            : s,
        ),
      }));
      setSelectedId(el.id);
      showToast('插图已添加');
    } catch {
      showToast('插图处理失败');
    }
  };

  const moveIllustration = (id: string, direction: 1 | -1) => {
    const list = [...activeSlide.illustrations];
    const index = list.findIndex((el) => el.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    patchActive({ illustrations: list });
  };

  const clearIllustrations = () => {
    if (activeSlide.illustrations.length === 0) return;
    if (!window.confirm('清空当前页的全部插图？')) return;
    patchActive({ illustrations: [] });
    setSelectedId(null);
  };

  const moveDevice = (slotId: string, x: number, y: number) => {
    // Base on the device's effective state (defaults depend on its layer index,
    // e.g. the 2nd device starts at scale 0.82). Falling back to hardcoded
    // values here used to snap that device to scale 1 / x 0 on first drag.
    const index = resolveDevices(activeSlide, project).findIndex((s) => s.id === slotId);
    const base = getDeviceState(activeSlide, slotId, Math.max(0, index));
    patchActive({
      deviceStates: {
        ...(activeSlide.deviceStates ?? {}),
        [slotId]: { ...base, x, y },
      },
    });
  };

  const scaleDevice = (slotId: string, scale: number) => {
    const index = resolveDevices(activeSlide, project).findIndex((s) => s.id === slotId);
    const base = getDeviceState(activeSlide, slotId, Math.max(0, index));
    patchActive({
      deviceStates: {
        ...(activeSlide.deviceStates ?? {}),
        [slotId]: { ...base, scale },
      },
    });
  };

  const applyDesignToAll = () => {
    // Copy current slide's bg + text layout + device list + deviceStates (size/pos/fit) to every page
    const sourceBg = activeSlide.bg;
    const sourceText = resolveTextStyle(activeSlide, project);
    const sourceDevices = activeSlide.devices ?? resolveDevices(activeSlide, project);
    const sourceStates = activeSlide.deviceStates ?? {};
    setProject((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => {
        // Build deviceStates with matching slot ids — keep existing screenshots per page
        const newStates: Record<string, DeviceState> = {};
        for (const slot of sourceDevices) {
          const src = sourceStates[slot.id];
          if (!src) continue;
          const existingShot = s.deviceStates?.[slot.id]?.screenshot;
          newStates[slot.id] = { ...src, screenshot: existingShot };
        }
        return {
          ...s,
          bg: JSON.parse(JSON.stringify(sourceBg)),
          textPos: sourceText.textPos,
          align: sourceText.align,
          font: sourceText.font,
          textColor: sourceText.textColor,
          titleScale: sourceText.titleScale,
          subtitleScale: sourceText.subtitleScale,
          devices: sourceDevices.map((d) => ({ ...d })),
          deviceStates: newStates,
        };
      }),
    }));
    showToast('设计已应用到全部页面');
  };

  const saveProject = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      showToast('已保存当前设置');
    } catch {
      showToast('保存失败：内容可能过大');
    }
  };

  const moveOverlay = (x: number, y: number) => {
    setProject((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === activeId && s.overlayDevice
          ? { ...s, overlayDevice: { ...s.overlayDevice, x, y } }
          : s,
      ),
    }));
  };

  const scaleOverlay = (scale: number) => {
    setProject((prev) => ({
      ...prev,
      slides: prev.slides.map((s) =>
        s.id === activeId && s.overlayDevice
          ? { ...s, overlayDevice: { ...s.overlayDevice, scale } }
          : s,
      ),
    }));
  };

  const applyOverlayToAll = () => {
    if (!activeSlide.overlayDevice) return;
    const overlay = { ...activeSlide.overlayDevice };
    setProject((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => ({ ...s, overlayDevice: { ...overlay } })),
    }));
    showToast('叠加设备已应用到全部页面');
  };

  const addSlide = () => {
    if (project.slides.length >= 10) {
      showToast('最多 10 页');
      return;
    }
    const fresh = createSlide({
      bg: { ...activeSlide.bg },
      fit: activeSlide.fit,
      screenshot: activeSlide.screenshot,
      illustrations: activeSlide.illustrations.map((el) => ({ ...el, id: uid() })),
      deviceX: activeSlide.deviceX ?? 0,
      deviceY: activeSlide.deviceY ?? 0,
      deviceScale: activeSlide.deviceScale ?? 1,
      overlayDevice: activeSlide.overlayDevice
        ? { ...activeSlide.overlayDevice }
        : undefined,
    });
    const next = [...project.slides];
    next.splice(safeActive + 1, 0, fresh);
    setProject({ ...project, slides: next });
    setActive(safeActive + 1);
    setSelectedId(null);
  };

  const duplicateSlide = (index: number) => {
    if (project.slides.length >= 10) {
      showToast('最多 10 页');
      return;
    }
    const base = project.slides[index];
    const copy: Slide = {
      ...base,
      id: uid(),
      bg: { ...base.bg },
      illustrations: base.illustrations.map((el) => ({ ...el, id: uid() })),
      overlayDevice: base.overlayDevice ? { ...base.overlayDevice } : undefined,
    };
    const next = [...project.slides];
    next.splice(index + 1, 0, copy);
    setProject({ ...project, slides: next });
    setActive(index + 1);
    setSelectedId(null);
  };

  const deleteSlide = (index: number) => {
    if (project.slides.length === 1) {
      showToast('至少保留一页');
      return;
    }
    if (!window.confirm('删除这一页？此操作不可撤销。')) return;
    const next = project.slides.filter((_, i) => i !== index);
    const nextActive = index < safeActive ? safeActive - 1 : Math.min(safeActive, next.length - 1);
    setProject({ ...project, slides: next });
    setActive(nextActive);
    setSelectedId(null);
  };

  const reorderSlides = (from: number, to: number) => {
    if (from === to) return;
    const insertAt = from < to ? to - 1 : to;
    const next = [...project.slides];
    const [moved] = next.splice(from, 1);
    next.splice(insertAt, 0, moved);
    const currentId = activeSlide.id;
    const nextActive = next.findIndex((s) => s.id === currentId);
    setProject({ ...project, slides: next });
    setActive(nextActive < 0 ? insertAt : nextActive);
  };

  const selectSlide = (index: number) => {
    setActive(index);
    setSelectedId(null);
  };

  const presetId = useMemo(() => {
    const found = SIZES.find(
      (s) => s.w === project.size.w && s.h === project.size.h,
    );
    return found?.id ?? 'custom';
  }, [project.size.w, project.size.h]);

  const focusCustomSize = () => {
    setCanvasOpen(true);
    setTimeout(() => {
      const input = document.getElementById('custom-size-width') as HTMLInputElement | null;
      if (!input) return;
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input.focus();
      input.select();
    }, 60);
  };

  /** Switching between landscape and portrait presets picks a layout that fits. */
  const changeSize = (w: number, h: number) => {
    setProject((prev) => {
      const ratio = w / h;
      let textPos = prev.textPos;
      if (ratio > 1.15 && textPos === 'top') textPos = 'side';
      else if (ratio < 0.9 && textPos === 'side') textPos = 'top';
      return { ...prev, size: { w, h }, textPos };
    });
  };

  const handleExportCurrent = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportSlide(project, activeSlide, safeActive, devices);
      showToast('已导出当前页 PNG');
    } catch {
      showToast('导出失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const handleExportAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const total = await exportAllAsZip(project, devices);
      showToast(`已导出 ${total} 页 PNG（ZIP）`);
    } catch {
      showToast('导出失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <Header
        project={project}
        presetId={presetId}
        busy={busy}
        onSize={changeSize}
        onCustomSize={focusCustomSize}
        onSave={saveProject}
        onApplyDesignToAll={applyDesignToAll}
        onExportCurrent={handleExportCurrent}
        onExportAll={handleExportAll}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
      />

      <div className="body">
        <LeftPanel
          project={project}
          slide={activeSlide}
          devices={devices}
          onProject={patchProject}
          onSlide={patchActive}
          onSize={changeSize}
          canvasOpen={canvasOpen}
          onCanvasOpenChange={setCanvasOpen}
          onUploadBg={uploadBg}
          onUploadDeviceShot={uploadDeviceShot}
          onUploadSticker={uploadSticker}
          onAddSticker={addSticker}
          onAddEmoji={addEmoji}
          onClearIllustrations={clearIllustrations}
          onImportDevice={() => setImporterOpen(true)}
          onUploadOverlayShot={uploadOverlayShot}
          onApplyOverlayToAll={applyOverlayToAll}
        />

        <main className="center">
          <CanvasStage
            project={project}
            slide={activeSlide}
            devices={devices}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updateIllustration}
            onDelete={deleteIllustration}
            onDeviceMove={moveDevice}
            onOverlayMove={moveOverlay}
            onDeviceScale={scaleDevice}
            onOverlayScale={scaleOverlay}
          />
          <SlideStrip
            project={project}
            devices={devices}
            active={safeActive}
            onSelect={selectSlide}
            onAdd={addSlide}
            onDuplicate={duplicateSlide}
            onDelete={deleteSlide}
            onReorder={reorderSlides}
          />
        </main>

        <RightPanel
          slide={activeSlide}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={updateIllustration}
          onMove={moveIllustration}
          onDelete={deleteIllustration}
          onClear={clearIllustrations}
        />
      </div>

      <FrameImporter
        open={importerOpen}
        devices={devices}
        onClose={() => setImporterOpen(false)}
        onAdd={addCustomDevice}
        onToast={showToast}
      />

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
