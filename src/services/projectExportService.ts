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

/**
 * Build workflow contract. Each target gets ONE workflow file with a known
 * name and a known artifact name, triggered ONLY by workflow_dispatch so the
 * pipeline can dispatch it explicitly and identify the exact run.
 * (A push never starts these workflows — that avoids duplicate/ambiguous runs.)
 */
export interface BuildWorkflowSpec {
  target: BuildTarget;
  /** File name under .github/workflows — also the workflow id for the Actions API. */
  workflowFile: string;
  /** Artifact the run must upload for the build to count as deliverable. */
  artifactName: string;
  content: string;
}

export function artifactSlug(appName: string): string {
  return appName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tivo-app';
}

export function getBuildWorkflowSpec(target: BuildTarget, appName: string): BuildWorkflowSpec {
  const slug = artifactSlug(appName);
  const workflowFile = `tivo-build-${target}.yml`;
  if (target === 'exe') {
    const artifactName = `${slug}-windows`;
    return { target, workflowFile, artifactName, content: `name: TIVO Build EXE
on:
  workflow_dispatch:

jobs:
  build-exe:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - run: npx @electron/packager . "${slug}" --platform=win32 --arch=x64 --out=release --overwrite
      - uses: actions/upload-artifact@v4
        with:
          name: ${artifactName}
          path: release/
          if-no-files-found: error
` };
  }
  if (target === 'apk') {
    const artifactName = `${slug}-android`;
    return { target, workflowFile, artifactName, content: `name: TIVO Build APK
on:
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
          java-version: 21
      - uses: android-actions/setup-android@v3
      - run: npm install
      - run: npm run build
      - run: npm install @capacitor/core @capacitor/cli @capacitor/android
      - run: if [ ! -d android ]; then npx cap add android; fi
      - run: npx cap sync android
      - name: Build APK
        working-directory: android
        run: chmod +x gradlew && ./gradlew assembleDebug --no-daemon
      - uses: actions/upload-artifact@v4
        with:
          name: ${artifactName}
          path: android/app/build/outputs/apk/debug/*.apk
          if-no-files-found: error
` };
  }
  const artifactName = `${slug}-web-dist`;
  return { target, workflowFile, artifactName, content: `name: TIVO Build Web
on:
  workflow_dispatch:

jobs:
  build-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: ${artifactName}
          path: dist/
          if-no-files-found: error
` };
}

export interface PushWithBuildResult {
  workflowFile: string;
  artifactName: string;
  /** Commit SHA of the last pushed file, when the server reports it. */
  headSha?: string;
}

// Push project to GitHub together with the target's dispatch-only build workflow
export async function pushProjectWithBuild(
  owner: string,
  repo: string,
  files: ProjectFile[],
  buildTarget: BuildTarget,
  appName: string
): Promise<PushWithBuildResult> {
  const spec = getBuildWorkflowSpec(buildTarget, appName);
  // Workflow file goes last so the final commit (headSha) contains everything.
  const allFiles = [
    ...files.filter((f) => f.path !== `.github/workflows/${spec.workflowFile}`),
    { path: `.github/workflows/${spec.workflowFile}`, content: spec.content },
  ];

  const res = await githubService.pushProject(owner, repo, allFiles) as {
    headSha?: string; files?: Array<{ commitSha?: string }>;
  } | undefined;
  const headSha = res?.headSha || res?.files?.at(-1)?.commitSha || undefined;
  return { workflowFile: spec.workflowFile, artifactName: spec.artifactName, headSha };
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
