import { ShieldAlert, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function BlockedScreen({ reason }: { reason?: string | null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 bg-background text-center">
      <div className="h-20 w-20 rounded-3xl bg-destructive/10 border border-destructive/30 flex items-center justify-center mb-6">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-display font-bold mb-2">Account restricted</h1>
      <p className="text-sm text-muted-foreground max-w-md mb-1">
        Your account has been temporarily restricted by the administrator.
      </p>
      {reason && (
        <p className="text-xs text-muted-foreground/70 max-w-md mb-4 italic">
          Reason: {reason}
        </p>
      )}
      <p className="text-xs text-muted-foreground/70 max-w-md mb-6">
        Chat, project creation, and other features are disabled until this restriction is lifted.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => window.location.href = `mailto:?subject=Account%20restricted&body=Hi%20admin,%20my%20account%20${user?.email || ''}%20is%20restricted.`}
        >
          <Mail className="h-4 w-4" />Contact admin
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-2 text-destructive"
          onClick={async () => { await logout(); navigate('/login'); }}
        >
          <LogOut className="h-4 w-4" />Sign out
        </Button>
      </div>
      <p className="mt-8 text-[10px] text-muted-foreground/40 font-mono">{user?.email}</p>
    </div>
  );
}
