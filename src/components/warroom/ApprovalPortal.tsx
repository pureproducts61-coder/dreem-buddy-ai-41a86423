import { useState } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  type: 'sub-agent' | 'code-push' | 'deploy' | 'file-create';
}

interface ApprovalPortalProps {
  requests: ApprovalRequest[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export function ApprovalPortal({ requests, onApprove, onDeny }: ApprovalPortalProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {requests.map((req) => (
        <motion.div
          key={req.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            className="w-full max-w-md mx-4 rounded-xl border border-primary/30 bg-card p-6 shadow-2xl glow-cyan"
            initial={{ y: 30 }}
            animate={{ y: 0 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold tracking-wider uppercase text-warning">
                  {t('warroom.approval')}
                </h3>
                <p className="text-xs text-muted-foreground">{t('warroom.approvalDesc')}</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-border/50 bg-secondary/30 p-4">
              <h4 className="font-mono text-sm font-semibold mb-1">{req.title}</h4>
              <p className="text-xs text-muted-foreground font-mono">{req.description}</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => onDeny(req.id)}
              >
                <X className="h-4 w-4 mr-1" />
                {t('warroom.deny')}
              </Button>
              <Button
                className="flex-1 glow-green bg-neon-green/90 hover:bg-neon-green text-background font-semibold"
                onClick={() => onApprove(req.id)}
              >
                <Check className="h-4 w-4 mr-1" />
                {t('warroom.approve')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
