/**
 * Computer vision layer.
 * Preferred path: Desktop Bridge screen capture (real OS screen).
 * Fallback path: browser getDisplayMedia (user picks a window/tab).
 */
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
    const res = await bridgeCall<{ text: string }>('screen.capture', 'screen.ocr', { dataUrl: image.dataUrl });
    return res.text;
  }
  throw new Error('Reading text from the screen needs the Desktop Bridge. I can still show you the screenshot.');
}

export async function findUiElement(description: string): Promise<{ x: number; y: number; label: string } | null> {
  const res = await bridgeCall<{ match: { x: number; y: number; label: string } | null }>(
    'screen.capture', 'screen.find', { description },
  );
  return res.match;
}