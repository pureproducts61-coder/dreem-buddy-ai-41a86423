import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProjects } from '@/contexts/ProjectContext';
import { AppSidebar } from '@/components/AppSidebar';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type FilterType = 'all' | 'recent' | 'favorites';
type ViewMode = 'grid' | 'list';

const Dashboard = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { projects, deleteProject, renameProject, toggleFavorite } = useProjects();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filter === 'favorites') {
      result = result.filter((p) => p.isFavorite);
    } else if (filter === 'recent') {
      result = result.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    }

    return result;
  }, [projects, searchQuery, filter]);

  const handleOpenProject = (id: string) => {
    navigate(`/workspace/${id}`);
  };

  const handleDeleteClick = (id: string) => {
    setSelectedProjectId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedProjectId) {
      deleteProject(selectedProjectId);
      setSelectedProjectId(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleRenameClick = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setSelectedProjectId(id);
      setNewName(project.name);
      setRenameDialogOpen(true);
    }
  };

  const handleRenameConfirm = () => {
    if (selectedProjectId && newName.trim()) {
      renameProject(selectedProjectId, newName.trim());
      setSelectedProjectId(null);
      setNewName('');
    }
    setRenameDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('dashboard.projects')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.projectsDesc')}
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('dashboard.newProject')}
            </Button>
          </div>

          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('dashboard.searchProjects')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setFilter('all')}>
                    {t('dashboard.allProjects')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter('recent')}>
                    {t('dashboard.recent')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter('favorites')}>
                    {t('dashboard.favorites')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="grid" className="px-3">
                  <LayoutGrid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="px-3">
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Projects Grid/List */}
          {filteredProjects.length > 0 ? (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'flex flex-col gap-3'
              }
            >
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  viewMode={viewMode}
                  onOpen={handleOpenProject}
                  onDelete={handleDeleteClick}
                  onRename={handleRenameClick}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mb-1 text-lg font-semibold">
                {t('dashboard.noProjects')}
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('dashboard.noProjectsDesc')}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('dashboard.createProject')}
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete')}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('createProject.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('dashboard.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dashboard.rename')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">{t('createProject.name')}</Label>
            <Input
              id="rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t('createProject.cancel')}
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!newName.trim()}>
              {t('dashboard.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
