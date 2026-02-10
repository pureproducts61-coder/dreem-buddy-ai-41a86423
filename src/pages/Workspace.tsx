import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Code, Eye, Terminal } from 'lucide-react';
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
import { LiveFeed } from '@/components/warroom/LiveFeed';
import { TaskSidebar, TaskStep } from '@/components/warroom/TaskSidebar';
import { WarRoomChat, Message } from '@/components/warroom/WarRoomChat';
import { WarRoomPreview } from '@/components/warroom/WarRoomPreview';
import { WarRoomFileTree } from '@/components/warroom/WarRoomFileTree';
import { ApprovalPortal, ApprovalRequest } from '@/components/warroom/ApprovalPortal';
import { StatusBar } from '@/components/warroom/StatusBar';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type RightView = 'preview' | 'code';

const mockResponses = [
  'প্রজেক্ট বিশ্লেষণ সম্পন্ন। React কম্পোনেন্ট তৈরি শুরু করছি...\n\n```tsx\nexport function Hero() {\n  return (\n    <section className="py-20 text-center">\n      <h1>Welcome</h1>\n    </section>\n  );\n}\n```',
  'কোড জেনারেশন সফল! টেস্টিং চলছে। আপনার অনুমোদনের জন্য অপেক্ষা করছি।',
  'ডিপ্লয়মেন্ট প্রস্তুত। GitHub-এ পুশ করার জন্য আপনার অনুমতি প্রয়োজন।',
];

const Workspace = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const { t } = useLanguage();

  const [rightView, setRightView] = useState<RightView>('preview');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [tasks, setTasks] = useState<TaskStep[]>([
    { id: '1', key: 'warroom.planning', status: 'completed' },
    { id: '2', key: 'warroom.research', status: 'completed' },
    { id: '3', key: 'warroom.coding', status: 'in_progress' },
    { id: '4', key: 'warroom.testing', status: 'pending' },
    { id: '5', key: 'warroom.deploying', status: 'pending' },
  ]);

  const project = projectId ? getProject(projectId) : undefined;
  const backendUrl = localStorage.getItem('dreem-hf-url') || '';

  const handleSendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);

    // Mock: sometimes trigger approval
    if (Math.random() > 0.6) {
      setApprovalRequests(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: 'Sub-Agent Creation Request',
          description: 'AI wants to create a code-review sub-agent to analyze generated components.',
          type: 'sub-agent',
        },
      ]);
    }
  }, []);

  const handleApprove = (id: string) => {
    setApprovalRequests(prev => prev.filter(r => r.id !== id));
  };
  const handleDeny = (id: string) => {
    setApprovalRequests(prev => prev.filter(r => r.id !== id));
  };

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Terminal className="h-12 w-12 text-primary/50 mx-auto mb-4" />
          <p className="font-mono text-sm text-muted-foreground">Mission not found</p>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-4 font-mono text-xs">
            ← Return to base
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background war-room-grid">
      {/* Approval Portal */}
      <ApprovalPortal requests={approvalRequests} onApprove={handleApprove} onDeny={handleDeny} />

      {/* Header */}
      <header className="flex h-11 items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-sm px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-7 w-7">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-display text-xs font-bold tracking-wider uppercase text-primary">
              {project.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={rightView} onValueChange={(v) => setRightView(v as RightView)}>
            <TabsList className="h-7">
              <TabsTrigger value="preview" className="gap-1 px-2 text-xs h-6">
                <Eye className="h-3 w-3" />
                <span className="hidden sm:inline">{t('warroom.preview')}</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-1 px-2 text-xs h-6">
                <Code className="h-3 w-3" />
                <span className="hidden sm:inline">Code</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ThemeLanguageToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Column: Live Feed + Tasks + Chat */}
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <div className="flex h-full flex-col">
              {/* Live Feed */}
              <div className="flex-1 min-h-0 overflow-hidden border-b border-border/50">
                <LiveFeed logs={[]} />
              </div>

              {/* Task Sidebar */}
              <div className="border-b border-border/50">
                <TaskSidebar tasks={tasks} />
              </div>

              {/* Chat Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-lg p-3 text-xs font-mono',
                      msg.role === 'user'
                        ? 'bg-primary/10 border border-primary/20 ml-8'
                        : 'bg-secondary/50 border border-border/50 mr-4'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn('text-[10px] uppercase tracking-wider', msg.role === 'user' ? 'text-primary' : 'text-neon-green')}>
                        {msg.role === 'user' ? 'Operator' : 'AI Agent'}
                      </span>
                      <span className="text-muted-foreground/40 text-[10px]">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{msg.content}</p>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs font-mono text-primary">
                    <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {t('warroom.thinking')}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <WarRoomChat
                projectId={project.id}
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Column: File Tree + Preview/Code */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* File Tree */}
              <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
                <WarRoomFileTree
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    setRightView('code');
                  }}
                  selectedFileId={selectedFileId}
                />
              </ResizablePanel>

              <ResizableHandle />

              {/* Preview / Code Editor */}
              <ResizablePanel defaultSize={75} minSize={40}>
                {rightView === 'preview' ? (
                  <WarRoomPreview />
                ) : (
                  <div className="flex h-full flex-col bg-card/30">
                    {selectedFile ? (
                      <>
                        <div className="flex items-center border-b border-border/50 px-3 py-1.5">
                          <span className="text-xs font-mono text-primary">{selectedFile.name}</span>
                        </div>
                        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground/80 leading-relaxed">
                          {selectedFile.content}
                        </pre>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Code className="mx-auto mb-3 h-8 w-8 opacity-30" />
                          <p className="text-xs font-mono">{t('warroom.noFileOpen')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Status Bar */}
      <StatusBar cpuUsage={42} memoryUsage={67} keepAlive={true} backendUrl={backendUrl} />
    </div>
  );
};

export default Workspace;
