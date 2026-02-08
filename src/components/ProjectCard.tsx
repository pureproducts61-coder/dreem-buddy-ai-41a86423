import { formatDistanceToNow } from 'date-fns';
import { bn, enUS } from 'date-fns/locale';
import {
  MoreHorizontal,
  Star,
  Trash2,
  Pencil,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { Project } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  viewMode: 'grid' | 'list';
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function ProjectCard({
  project,
  viewMode,
  onOpen,
  onDelete,
  onRename,
  onToggleFavorite,
}: ProjectCardProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'bn' ? bn : enUS;

  const timeAgo = formatDistanceToNow(project.updatedAt, {
    addSuffix: true,
    locale: dateLocale,
  });

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{project.name}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {project.description || t('dashboard.noProjectsDesc')}
          </p>
        </div>
        <div className="hidden text-sm text-muted-foreground sm:block">
          {t('dashboard.lastModified')}: {timeAgo}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onToggleFavorite(project.id)}
          >
            <Star
              className={cn(
                'h-4 w-4',
                project.isFavorite && 'fill-warning text-warning'
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpen(project.id)}
          >
            <FolderOpen className="mr-1 h-4 w-4" />
            {t('dashboard.open')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(project.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('dashboard.rename')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(project.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('dashboard.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(project.id);
              }}
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  project.isFavorite && 'fill-warning text-warning'
                )}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen(project.id)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('dashboard.open')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(project.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('dashboard.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(project.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('dashboard.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <h3 className="mb-1 truncate font-semibold" onClick={() => onOpen(project.id)}>
          {project.name}
        </h3>
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {project.description || t('dashboard.noProjectsDesc')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('dashboard.lastModified')}: {timeAgo}
        </p>
      </CardContent>
    </Card>
  );
}
