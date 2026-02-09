import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Code, Eye, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { useProjects } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import { ChatPanel } from '@/components/workspace/ChatPanel';
import { PreviewPanel } from '@/components/workspace/PreviewPanel';
import { CodeEditorPanel } from '@/components/workspace/CodeEditorPanel';
import { cn } from '@/lib/utils';

type ViewMode = 'preview' | 'code';

const Workspace = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const { t } = useLanguage();
  
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  
  const project = projectId ? getProject(projectId) : undefined;

  useEffect(() => {
    if (!project && projectId) {
      navigate('/');
    }
  }, [project, projectId, navigate]);

  if (!project) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              {project.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold truncate max-w-[200px]">
              {project.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="preview" className="gap-1.5 px-3">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">{t('workspace.preview')}</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-1.5 px-3">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">{t('workspace.code')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ThemeLanguageToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Chat Panel */}
          <ResizablePanel
            defaultSize={35}
            minSize={isChatCollapsed ? 0 : 25}
            maxSize={50}
            collapsible
            collapsedSize={0}
            onCollapse={() => setIsChatCollapsed(true)}
            onExpand={() => setIsChatCollapsed(false)}
            className={cn(
              'transition-all duration-300',
              isChatCollapsed && 'min-w-0'
            )}
          >
            <ChatPanel projectId={project.id} />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Preview/Code Panel */}
          <ResizablePanel defaultSize={65} minSize={40}>
            {viewMode === 'preview' ? (
              <PreviewPanel projectId={project.id} />
            ) : (
              <CodeEditorPanel projectId={project.id} />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Collapsed Chat Toggle */}
      {isChatCollapsed && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-50 h-10 w-10 rounded-full shadow-lg"
          onClick={() => setIsChatCollapsed(false)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default Workspace;
