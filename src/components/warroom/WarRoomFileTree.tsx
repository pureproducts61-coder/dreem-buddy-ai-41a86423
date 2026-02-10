import { useState } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
}

const mockFiles: FileNode[] = [
  {
    id: '1', name: 'src', type: 'folder',
    children: [
      { id: '2', name: 'App.tsx', type: 'file', content: 'import React from "react";\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;' },
      { id: '3', name: 'index.css', type: 'file', content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;' },
      {
        id: '4', name: 'components', type: 'folder',
        children: [
          { id: '5', name: 'Header.tsx', type: 'file', content: 'export function Header() {\n  return <header>Header</header>;\n}' },
          { id: '6', name: 'Footer.tsx', type: 'file', content: 'export function Footer() {\n  return <footer>Footer</footer>;\n}' },
        ],
      },
    ],
  },
  { id: '7', name: 'package.json', type: 'file', content: '{\n  "name": "project",\n  "version": "1.0.0"\n}' },
  { id: '8', name: 'index.html', type: 'file', content: '<!DOCTYPE html>\n<html>\n<body>\n  <div id="root"></div>\n</body>\n</html>' },
];

interface WarRoomFileTreeProps {
  onFileSelect: (file: { name: string; content: string }) => void;
  selectedFileId: string | null;
}

export function WarRoomFileTree({ onFileSelect, selectedFileId }: WarRoomFileTreeProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1']));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderTree = (nodes: FileNode[], depth = 0) =>
    nodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isExpanded = expanded.has(node.id);
      const isActive = selectedFileId === node.id;

      return (
        <div key={node.id}>
          <button
            onClick={() => isFolder ? toggle(node.id) : onFileSelect({ name: node.name, content: node.content || '' })}
            className={cn(
              'flex w-full items-center gap-1.5 px-2 py-1 text-xs font-mono hover:bg-secondary/50 rounded transition-colors',
              isActive && 'bg-primary/10 text-primary'
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isFolder ? (
              <>
                {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                {isExpanded ? <FolderOpen className="h-3 w-3 shrink-0 text-primary" /> : <Folder className="h-3 w-3 shrink-0 text-primary" />}
              </>
            ) : (
              <>
                <span className="w-3" />
                <File className="h-3 w-3 shrink-0 text-muted-foreground" />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isFolder && isExpanded && node.children && renderTree(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/50">
        <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          {t('warroom.files')}
        </span>
      </div>
      <ScrollArea className="flex-1 py-1">
        {renderTree(mockFiles)}
      </ScrollArea>
    </div>
  );
}
