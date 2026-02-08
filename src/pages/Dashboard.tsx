import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, Sparkles } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Nav */}
      <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Dreem Dev</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
              <p className="text-sm text-muted-foreground">
                Build and manage your AI-powered projects
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>

          {/* Empty State */}
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="mb-1 text-lg font-semibold">No projects yet</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first project to get started
            </p>
            <Button>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
