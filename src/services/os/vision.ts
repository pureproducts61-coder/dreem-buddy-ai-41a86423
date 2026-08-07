/**
 * Computer vision layer.
 * Preferred path: Desktop Bridge screen capture (real OS screen).
 * Fallback path: browser getDisplayMedia (user picks a window/tab).
 */
import { reportRuntimeCapability } from './capabilities';
import { bridgeCall, isPermitted, pingBridge } from './desktopBridge';

export interface ScreenShot {
  dataUrl: string;
  width: number;
  height: number;
  source: 'bridge' | 'browser';
  takenAt: string;
}

export async function captureScreen(): Promise<ScreenShot> {
  if (isPermitted('screen.capture')) {
    const health = await pingBridge();
    if (health.online) {
      const res = await bridgeCall<{ dataUrl: string; width: number; height: number }>(
        'screen.capture', 'screen.capture',
      );
      return { ...res, source: 'bridge', takenAt: new Date().toISOString() };
    }
  }
  return captureViaBrowser();
}

export async function captureViaBrowser(): Promise<ScreenShot> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
  };
  if (!md?.getDisplayMedia) {
    throw new Error('This device cannot share its screen from the browser.');
  }
  const stream = await md.getDisplayMedia({ video: true, audio: false });
  try {
    const track = stream.getVideoTracks()[0];
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 250));
    const settings = track.getSettings();
    const canvas = document.createElement('canvas');
    canvas.width = settings.width || video.videoWidth || 1280;
    canvas.height = settings.height || video.videoHeight || 720;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      source: 'browser',
      takenAt: new Date().toISOString(),
    };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Ask the Bridge for OCR/UI-element detection when it is available. */
export async function readScreenText(shot?: ScreenShot): Promise<string> {
  const image = shot ?? (await captureScreen());
  if (image.source === 'bridge') {
    try {
      const res = await bridgeCall<{ text: string }>('screen.capture', 'screen.ocr', { dataUrl: image.dataUrl });
      reportRuntimeCapability({ id: 'ocr', label: 'OCR runtime', state: 'ready', detail: 'Reading screen text through the Bridge', health: 'good' });
      return res.text;
    } catch (e) {
      reportRuntimeCapability({ id: 'ocr', label: 'OCR runtime', state: 'unavailable', detail: e instanceof Error ? e.message : 'OCR failed', health: 'down' });
      throw e;
    }
  }
  reportRuntimeCapability({ id: 'ocr', label: 'OCR runtime', state: 'unavailable', detail: 'Needs the Desktop Bridge', health: 'down' });
  throw new Error('Reading text from the screen needs the Desktop Bridge. I can still show you the screenshot.');
}

export async function findUiElement(description: string): Promise<{ x: number; y: number; label: string } | null> {
  const res = await bridgeCall<{ match: { x: number; y: number; label: string } | null }>(
    'screen.capture', 'screen.find', { description },
  );
  return res.match;
}
/* ---------------- UI understanding ---------------- */

export interface UiElement {
  role: string;              // button | menu | dialog | icon | field | window | notification
  label: string;
  x: number; y: number; width: number; height: number;
  confidence?: number;
  app?: string;
}

export interface ScreenUnderstanding {
  shot: ScreenShot;
  elements: UiElement[];
  text: string;
  windows: { title: string; app: string; focused?: boolean }[];
  notes: string[];
}

/**
 * Full screen understanding: capture → OCR → UI element detection.
 * Model needs are resolved through the Model Manager; when something is missing
 * the user is told instead of the call failing silently.
 */
export async function analyzeScreen(): Promise<ScreenUnderstanding> {
  const { requireModelFor } = await import('./orchestrator');
  const shot = await captureScreen();
  const notes: string[] = [];
  let elements: UiElement[] = [];
  let text = '';
  let windows: { title: string; app: string; focused?: boolean }[] = [];

  const ocrModel = await requireModelFor('ocr');
  const visionModel = await requireModelFor('vision');
  if (ocrModel.missing) notes.push(ocrModel.reason);
  if (visionModel.missing) notes.push(visionModel.reason);

  if (shot.source === 'bridge') {
    const res = await bridgeCall<{ elements?: UiElement[]; text?: string; windows?: typeof windows }>(
      'screen.capture', 'screen.analyze',
      { dataUrl: shot.dataUrl, ocrModel: ocrModel.model?.name || '', visionModel: visionModel.model?.name || '' },
    ).catch(() => ({} as { elements?: UiElement[]; text?: string; windows?: typeof windows }));
    elements = res.elements || [];
    text = res.text || '';
    windows = res.windows || [];
  } else {
    notes.push('Only a browser screenshot is available. Install the Desktop Bridge so I can read windows, buttons and menus.');
  }
  return { shot, elements, text, windows, notes };
}

/** Lists open windows through the Bridge window manager. */
export async function listWindows() {
  return bridgeCall<{ windows: { title: string; app: string; focused?: boolean }[] }>('windows.manage', 'windows.list');
}
