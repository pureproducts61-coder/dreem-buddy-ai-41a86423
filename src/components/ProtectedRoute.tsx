import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { BlockedScreen } from '@/components/BlockedScreen';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const { blocked, reason, loading: blockLoading } = useBlockedStatus();

  if (isLoading || blockLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (blocked) return <BlockedScreen reason={reason} />;
  return <>{children}</>;
};

export default ProtectedRoute;
