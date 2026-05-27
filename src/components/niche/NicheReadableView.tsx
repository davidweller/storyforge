'use client';

import type { NicheOutput } from '@/lib/generation/schemas';
import { formatMarkdown } from '@/lib/utils/markdown';

function TropeList({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; rationale?: string; reason?: string }>;
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={`${title}-${item.name}`}>
            <strong className="text-foreground">{item.name}</strong>
            {item.rationale || item.reason ? ` - ${item.rationale ?? item.reason}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NicheReadableView({ output }: { output: NicheOutput }) {
  const niche = output.niche;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Emotional promise</p>
        <p className="text-sm text-foreground">{niche.emotionalPromise}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TropeList title="Must include" items={niche.tropes.mustInclude} />
        <TropeList title="Consider including" items={niche.tropes.considerIncluding} />
        <TropeList title="Avoid" items={niche.tropes.avoid} />
      </div>

      <details className="rounded-lg border border-border bg-background">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Full niche summary</summary>
        <div className="prose-book px-4 pb-4" dangerouslySetInnerHTML={{ __html: formatMarkdown(niche.summary) }} />
      </details>
    </div>
  );
}
