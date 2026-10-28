export type DeviceId =
  | 'iphone15'
  | 'iphone14'
  | 'iphoneSE'
  | 'ipad'
  | 'macbookAir'
  | 'macbookPro'
  | 'imac'
  | 'none';
export type DeviceFrame =
  | 'island'
  | 'notch'
  | 'se'
  | 'ipad'
  | 'macbook'
  | 'imac'
  | 'image'
  | 'none';

export interface FrameScreenRect {
  /** all values are in the original image pixel space */
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
}

export interface ImageFrame {
  /** image url or data url */
  image: string;
  screen: FrameScreenRect;
  /** under = screenshot behind the frame (transparent screen asset) */
  mode?: 'under' | 'over';
  /** draw the built-in soft shadow under the mockup */
  shadow?: boolean;
}

export interface DeviceDef {
  id: string;
  name: string;
  note: string;
  /** outer frame width / height */
  ratio: number;
  frame: DeviceFrame;
  image?: ImageFrame;
}

export interface SizePreset {
  id: string;
  label: string;
  note: string;
  w: number;
  h: number;
}

export interface GradientPreset {
  id: string;
  name: string;
  from: string;
  to: string;
  angle: number;
}

export type BgType = 'gradient' | 'solid' | 'image';
export type BgFit = 'cover' | 'contain' | 'stretch';
export type BgAlign =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export interface Background {
  type: BgType;
  gradient: string;
  color: string;
  image?: string;
  /** how the uploaded image fills the canvas */
  fit: BgFit;
  /** anchor point used by cover / contain */
  align: BgAlign;
  /** black overlay 0 - 0.7 */
  dim: number;
}

export type IllustrationKind =
  | 'image'
  | 'star'
  | 'spark'
  | 'circle'
  | 'heart'
  | 'squiggle'
  | 'burst'
  | 'emoji';

export interface Illustration {
  id: string;
  kind: IllustrationKind;
  src?: string;
  emoji?: string;
  color: string;
  /** normalized center, 0 - 1 */
  cx: number;
  cy: number;
  /** width / height as fraction of canvas width */
  w: number;
  h: number;
  rotation: number;
  opacity: number;
}

export type TextPos = 'top' | 'bottom' | 'side' | 'none';
export type Align = 'center' | 'left';
export type ShotFit = 'cover' | 'contain' | 'stretch';

/** a selected device model on the canvas */
export interface DeviceSlot {
  id: string;
  device: string;
}

/** per-page state of a device slot */
export interface DeviceState {
  screenshot?: string;
  fit: ShotFit;
  /** scale relative to the layout base */
  scale: number;
  /** position offsets, fraction of canvas width / height */
  x: number;
  y: number;
}

export interface Slide {
  id: string;
  title: string;
  subtitle: string;
  bg: Background;
  illustrations: Illustration[];
  /** per-page device slots; if absent, falls back to Project.devices */
  devices?: DeviceSlot[];
  /** keyed by DeviceSlot.id */
  deviceStates?: Record<string, DeviceState>;
  /** per-slide text layout/style; if absent, falls back to Project */
  textPos?: TextPos;
  align?: Align;
  font?: string;
  textColor?: string;
  titleScale?: number;
  subtitleScale?: number;
}

export interface Project {
  size: { w: number; h: number };
  /** legacy default devices, used by slides that don't have their own devices array */
  devices?: DeviceSlot[];
  textPos: TextPos;
  align: Align;
  font: string;
  textColor: string;
  titleScale: number;
  subtitleScale: number;
  slides: Slide[];
}
