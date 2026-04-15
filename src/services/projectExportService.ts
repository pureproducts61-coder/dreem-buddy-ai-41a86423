// Project Export Service — ZIP download, GitHub push, build workflows
import JSZip from 'jszip';
import { githubService } from './githubService';

export type BuildTarget = 'web' | 'exe' | 'apk';

interface ProjectFile {
  path: string;
  content: string;
}

// Generate ZIP and trigger browser download
export async function downloadProjectAsZip(
  projectName: string,
  files: ProjectFile[]
): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// GitHub Actions workflow for EXE (Electron)
function getElectronWorkflow(appName: string): string {
  return `name: Build Windows EXE
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-exe:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx @electron/packager . "${appName}" --platform=win32 --arch=x64 --out=release --overwrite
      - uses: actions/upload-artifact@v4
        with:
          name: ${appName}-windows
          path: release/
`;
}

// GitHub Actions workflow for APK (Capacitor)
function getCapacitorWorkflow(appName: string): string {
  return `name: Build Android APK
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - run: npm ci
      - run: npm run build
      - run: npx cap sync android
      - name: Build APK
        working-directory: android
        run: ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: ${appName}-android
          path: android/app/build/outputs/apk/debug/*.apk
`;
}

// Push project to GitHub with optional build workflow
export async function pushProjectWithBuild(
  owner: string,
  repo: string,
  files: ProjectFile[],
  buildTarget: BuildTarget,
  appName: string
): Promise<void> {
  const allFiles = [...files];

  if (buildTarget === 'exe') {
    allFiles.push({
      path: '.github/workflows/build-exe.yml',
      content: getElectronWorkflow(appName),
    });
  } else if (buildTarget === 'apk') {
    allFiles.push({
      path: '.github/workflows/build-apk.yml',
      content: getCapacitorWorkflow(appName),
    });
  }

  await githubService.pushProject(owner, repo, allFiles);
}

// Save project files to localStorage for later push
const LOCAL_PROJECT_FILES_KEY = 'tivo-project-files';

export function saveProjectFilesLocally(projectId: string, files: ProjectFile[]): void {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_PROJECT_FILES_KEY) || '{}');
    stored[projectId] = { files, savedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_PROJECT_FILES_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

export function getLocalProjectFiles(projectId: string): ProjectFile[] | null {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_PROJECT_FILES_KEY) || '{}');
    return stored[projectId]?.files || null;
  } catch {
    return null;
  }
}
