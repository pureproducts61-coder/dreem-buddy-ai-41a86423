import { useState } from 'react';
import { Download, Globe, Monitor, Smartphone, Loader2, Package, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { downloadProjectAsZip, type BuildTarget } from '@/services/projectExportService';
import { githubService } from '@/services/githubService';
import { useToast } from '@/hooks/use-toast';

interface BuildDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  files: Array<{ path: string; content: string }>;
}

const targets: Array<{ key: BuildTarget; icon: typeof Globe; label: string; desc: string }> = [
  { key: 'web', icon: Globe, label: 'Web App', desc: 'Deploy to Vercel / Netlify' },
  { key: 'exe', icon: Monitor, label: 'Windows (.exe)', desc: 'Electron + GitHub Actions' },
  { key: 'apk', icon: Smartphone, label: 'Android (.apk)', desc: 'Capacitor + GitHub Actions' },
];

export function BuildDeliveryDialog({ open, onClose, projectName, files }: BuildDeliveryDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<BuildTarget>('web');
  const [loading, setLoading] = useState(false);
  const hasGithub = githubService.hasToken();

  async function handleZipDownload() {
    setLoading(true);
    try {
      await downloadProjectAsZip(projectName, files);
      toast({ title: '✅ ZIP ডাউনলোড সম্পন্ন' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubPush() {
    if (!hasGithub) {
      toast({ title: 'GitHub Token প্রয়োজন', description: 'Settings → GitHub Token যোগ করুন', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const user = await githubService.getUser();
      let repo;
      try {
        repo = await githubService.createRepo(projectName, `${projectName} - Built with TIVO AI`);
      } catch {
        // repo may already exist
      }
      const { pushProjectWithBuild } = await import('@/services/projectExportService');
      await pushProjectWithBuild(user.login, projectName, files, selected, projectName);
      toast({ title: '✅ GitHub-এ পুশ সম্পন্ন', description: selected !== 'web' ? 'GitHub Actions বিল্ড শুরু হয়েছে' : undefined });
    } catch (e: unknown) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            প্রজেক্ট ডেলিভারি
          </DialogTitle>
          <DialogDescription>বিল্ড টার্গেট বেছে নিন এবং ডাউনলোড বা পুশ করুন</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {targets.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setSelected(t.key)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border p-4 transition-all text-left',
                  selected === t.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border/40 hover:border-border'
                )}
              >
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center',
                  selected === t.key ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleZipDownload}
            disabled={loading}
            variant="outline"
            className="flex-1 gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            ZIP ডাউনলোড
          </Button>
          <Button
            onClick={handleGitHubPush}
            disabled={loading || !hasGithub}
            className="flex-1 gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
            GitHub Push
          </Button>
        </div>

        {!hasGithub && (
          <p className="text-xs text-muted-foreground text-center">
            💡 GitHub Token ছাড়াই ZIP ডাউনলোড করতে পারবেন
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
