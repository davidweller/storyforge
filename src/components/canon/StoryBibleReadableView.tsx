'use client';

import type { StoryBibleDocument } from '@/types';

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function StoryBibleReadableView({ story }: { story: StoryBibleDocument }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Logline</p>
        <p className="text-sm text-foreground leading-relaxed">{story.logline || '—'}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Genre promise</p>
            <p className="text-sm">{story.genrePromise || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Audience promise</p>
            <p className="text-sm">{story.audiencePromise || '—'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Voice & style</h3>
        <div className="grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">POV:</span> {story.voiceAndStyle.pov}
          </p>
          <p>
            <span className="text-muted-foreground">Tense:</span> {story.voiceAndStyle.tense}
          </p>
          <p>
            <span className="text-muted-foreground">Distance:</span> {story.voiceAndStyle.narrativeDistance}
          </p>
        </div>
        <ListBlock title="Style rules" items={story.voiceAndStyle.styleRules} />
        <div className="mt-3">
          <ListBlock title="Avoid" items={story.voiceAndStyle.avoid} />
        </div>
      </div>

      <ListBlock title="Themes" items={story.themes} />

      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Characters</h3>
        <div className="space-y-4">
          {story.characters.map((ch, idx) => (
            <div key={`${ch.name}-${idx}`} className="border-l-2 border-accent/40 pl-3">
              <p className="font-medium text-foreground">
                {ch.name}{' '}
                <span className="text-muted-foreground font-normal text-sm">({ch.role})</span>
              </p>
              <p className="text-sm mt-1 text-muted-foreground">Want: {ch.want}</p>
              <p className="text-sm text-muted-foreground">Need: {ch.need}</p>
              <p className="text-sm text-muted-foreground">Flaw: {ch.flaw}</p>
              {ch.arcPromise ? (
                <p className="text-sm mt-1 text-foreground/90">{ch.arcPromise}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <ListBlock title="World rules" items={story.worldRules} />
      <ListBlock title="Timeline facts" items={story.timelineFacts} />
      <ListBlock title="Ending promises" items={story.endingPromises} />
      <ListBlock title="Forbidden changes" items={story.forbiddenChanges} />

      {story.unresolvedThreads?.length ? (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold mb-2">Unresolved threads</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {story.unresolvedThreads.map((t, i) => (
              <li key={i}>
                <strong className="text-foreground">{t.thread}</strong> — resolve by {t.mustResolveBy}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
