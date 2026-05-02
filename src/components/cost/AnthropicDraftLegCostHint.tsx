'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  estimateAnthropicDraftLegUsd,
  formatUsdApprox,
} from '@/lib/cost/anthropicDraftLegUsd';

export function AnthropicDraftLegCostHint(props: {
  chapterCount: number;
  useScenePipeline: boolean;
  polishEnabled: boolean;
  className?: string;
}) {
  const est = useMemo(
    () =>
      estimateAnthropicDraftLegUsd({
        chapterCount: props.chapterCount,
        useScenePipeline: props.useScenePipeline,
        polishEnabled: props.polishEnabled,
      }),
    [props.chapterCount, props.useScenePipeline, props.polishEnabled]
  );

  return (
    <div className={cn('text-xs text-[var(--muted-foreground)] mt-2 space-y-1', props.className)}>
      <p className="font-medium text-[var(--foreground)]">Approx. Claude API cost (order-of-magnitude)</p>
      <ul className="list-disc pl-4 space-y-0.5">
        <li>
          Full Auto–style run (warm prompt cache):{' '}
          <strong className="text-[var(--foreground)]">{formatUsdApprox(est.fullAutoWithCaching)}</strong>
        </li>
        <li>
          Manual across sessions (cold cache on bible/context):{' '}
          <strong className="text-[var(--foreground)]">{formatUsdApprox(est.manualWithoutCaching)}</strong>
        </li>
      </ul>
      <p>
        Same scope as the token preflight (drafting leg through blurbs; excludes editorial/revision). OpenRouter
        defaults differ.
      </p>
    </div>
  );
}
