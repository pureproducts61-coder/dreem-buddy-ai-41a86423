import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { parseUiSchema, type UiBlock, type UiEvent, type UiAction } from '@/services/world/dynamicUi';

/**
 * Trusted renderer for Brain-emitted UI schemas. Renders only whitelisted
 * blocks as plain text (React escapes everything). Actions emit an intent
 * via onEvent — approval still goes through Control/TDEF, never here.
 */
interface Props { schema: unknown; onEvent?: (e: UiEvent) => void; disabled?: boolean }

const card = 'rounded-xl border border-border bg-card/60 backdrop-blur p-3 space-y-2 text-sm text-card-foreground';

function Act({ a, blockId, onEvent, disabled, values }: { a: UiAction; blockId: string; onEvent?: Props['onEvent']; disabled?: boolean; values?: Record<string, unknown> }) {
  const variant = a.variant === 'danger' ? 'destructive' : a.variant === 'secondary' ? 'outline' : 'default';
  return (
    <Button size="sm" variant={variant} disabled={disabled || !onEvent}
      onClick={() => onEvent?.({ blockId, actionId: a.id, values })}>{a.label}</Button>
  );
}

function FormBlock({ b, onEvent, disabled }: { b: Extract<UiBlock, { type: 'form' }>; onEvent?: Props['onEvent']; disabled?: boolean }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }));
  const missing = b.fields.some((f) => f.required && (values[f.name] === undefined || values[f.name] === ''));
  return (
    <div className="space-y-2">
      {b.fields.map((f) => (
        <label key={f.name} className="block space-y-1">
          <span className="text-xs text-muted-foreground">{f.label}{f.required && ' *'}</span>
          {f.kind === 'textarea' ? <Textarea placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
            : f.kind === 'checkbox' ? <Checkbox onCheckedChange={(c) => set(f.name, c === true)} />
            : f.kind === 'select' ? (
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5"
                defaultValue="" onChange={(e) => set(f.name, e.target.value)}>
                <option value="" disabled>{f.placeholder ?? '—'}</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>)
            : <Input type={f.kind === 'number' ? 'number' : 'text'} placeholder={f.placeholder}
                onChange={(e) => set(f.name, f.kind === 'number' ? Number(e.target.value) : e.target.value)} />}
        </label>
      ))}
      <Act a={b.submit} blockId={b.id} onEvent={onEvent} disabled={disabled || missing} values={values} />
    </div>
  );
}

function Block({ b, onEvent, disabled }: { b: UiBlock; onEvent?: Props['onEvent']; disabled?: boolean }) {
  return (
    <div className={card} data-ui-block={b.type}>
      {b.title && <div className="font-semibold">{b.title}</div>}
      {b.body && <p className="text-muted-foreground whitespace-pre-wrap">{b.body}</p>}
      {b.type === 'clarification' && (<>
        <p>{b.question}</p>
        {b.actions && <div className="flex flex-wrap gap-2">{b.actions.map((a) => <Act key={a.id} a={a} blockId={b.id} onEvent={onEvent} disabled={disabled} />)}</div>}
      </>)}
      {b.type === 'choice' && <div className="flex flex-wrap gap-2">{b.options.map((a) => <Act key={a.id} a={a} blockId={b.id} onEvent={onEvent} disabled={disabled} />)}</div>}
      {b.type === 'form' && <FormBlock b={b} onEvent={onEvent} disabled={disabled} />}
      {b.type === 'approval' && (<>
        <p>{b.action}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={b.risk === 'high' || b.risk === 'critical' ? 'destructive' : 'secondary'}>Risk: {b.risk}</Badge>
          <Badge variant="outline">{b.reversible ? 'Reversible / ফেরতযোগ্য' : 'Irreversible / অফেরতযোগ্য'}</Badge>
        </div>
        <div className="flex gap-2">
          <Act a={b.approve} blockId={b.id} onEvent={onEvent} disabled={disabled} />
          <Act a={{ ...b.reject, variant: b.reject.variant ?? 'secondary' }} blockId={b.id} onEvent={onEvent} disabled={disabled} />
        </div>
      </>)}
      {b.type === 'progress' && (
        <ol className="flex flex-wrap gap-1.5">
          {b.stages.map((s, i) => (
            <li key={i}><Badge variant={s.active ? 'default' : s.done ? 'secondary' : 'outline'}>{s.done ? '✓ ' : ''}{s.label}</Badge></li>
          ))}
        </ol>
      )}
      {b.type === 'evidence' && (<>
        <Badge variant={b.status === 'PASS' ? 'default' : b.status === 'FAILED' || b.status === 'BLOCKED' ? 'destructive' : 'secondary'}>{b.status}</Badge>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {b.items.map((it, i) => (<><dt key={`k${i}`} className="text-muted-foreground">{it.label}</dt><dd key={`v${i}`} className="break-words">{it.value}</dd></>))}
        </dl>
      </>)}
    </div>
  );
}

export default function DynamicUiRenderer({ schema, onEvent, disabled }: Props) {
  const parsed = parseUiSchema(schema);
  if (!parsed) return null; // fail closed: never render untrusted/invalid UI
  return <div className="space-y-2">{parsed.blocks.map((b) => <Block key={b.id} b={b} onEvent={onEvent} disabled={disabled} />)}</div>;
}
