import { useState, useEffect, useRef } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
}

// Mock file structure
const mockFiles: FileNode[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    children: [
      {
        id: '2',
        name: 'App.tsx',
        type: 'file',
        content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to Dreem Dev</h1>
        <p>Start building your app!</p>
      </header>
    </div>
  );
}

export default App;`,
      },
      {
        id: '3',
        name: 'App.css',
        type: 'file',
        content: `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}`,
      },
      {
        id: '4',
        name: 'components',
        type: 'folder',
        children: [
          {
            id: '5',
            name: 'Button.tsx',
            type: 'file',
            content: `interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}`,
          },
        ],
      },
    ],
  },
  {
    id: '6',
    name: 'package.json',
    type: 'file',
    content: `{
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
  },
  {
    id: '7',
    name: 'index.html',
    type: 'file',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Project</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
  },
];

interface CodeEditorPanelProps {
  projectId: string;
}

interface OpenTab {
  id: string;
  name: string;
  content: string;
}

export function CodeEditorPanel({ projectId }: CodeEditorPanelProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['1']));
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openFile = (file: FileNode) => {
    if (file.type !== 'file') return;

    const existing = openTabs.find((t) => t.id === file.id);
    if (existing) {
      setActiveTabId(file.id);
    } else {
      const newTab: OpenTab = {
        id: file.id,
        name: file.name,
        content: file.content || '',
      };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(file.id);
    }
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTabId === id) {
      const remaining = openTabs.filter((t) => t.id !== id);
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const getLanguageExtension = (filename: string) => {
    if (filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.jsx') || filename.endsWith('.js')) {
      return javascript({ jsx: true, typescript: filename.includes('ts') });
    }
    if (filename.endsWith('.html')) return html();
    if (filename.endsWith('.css')) return css();
    if (filename.endsWith('.json')) return json();
    return javascript();
  };

  useEffect(() => {
    if (!editorRef.current || !activeTab) return;

    // Cleanup previous editor
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const extensions = [
      basicSetup,
      getLanguageExtension(activeTab.name),
      EditorView.lineWrapping,
    ];

    if (theme === 'dark') {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: activeTab.content,
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [activeTabId, theme]);

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isExpanded = expandedFolders.has(node.id);
      const isActive = activeTabId === node.id;

      return (
        <div key={node.id}>
          <button
            onClick={() => (isFolder ? toggleFolder(node.id) : openFile(node))}
            className={cn(
              'flex w-full items-center gap-1.5 px-2 py-1 text-sm hover:bg-muted/50 rounded transition-colors',
              isActive && 'bg-primary/10 text-primary'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isFolder ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-primary" />
                )}
              </>
            ) : (
              <>
                <span className="w-4" />
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isFolder && isExpanded && node.children && (
            <div>{renderFileTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full">
      {/* File Tree Sidebar */}
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            {t('workspace.files')}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1 py-2">
          {renderFileTree(mockFiles)}
        </ScrollArea>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Tabs */}
        {openTabs.length > 0 && (
          <div className="flex border-b bg-muted/30 overflow-x-auto">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  'flex items-center gap-2 border-r px-3 py-2 text-sm transition-colors min-w-max',
                  activeTabId === tab.id
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                <File className="h-3.5 w-3.5" />
                <span>{tab.name}</span>
                <button
                  onClick={(e) => closeTab(tab.id, e)}
                  className="ml-1 rounded hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          {activeTab ? (
            <div ref={editorRef} className="h-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <File className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p className="text-sm">{t('workspace.noFileOpen')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
