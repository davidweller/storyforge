'use client';

import { useState, useCallback } from 'react';
import type { WorkflowStage, GenerationUsageSource } from '@/types';
import { useToast } from '@/components/ui';

interface GenerateResult {
  content: string;
  model: string;
  provider: string;
  tokensUsed: number;
  warnings?: string[];
}

export interface GenerateOptions {
  model?: string;
  projectId?: string;
  runId?: string;
  usageSource?: GenerationUsageSource;
  /** When true, skip warning toasts for `/api/generate` `warnings` (e.g. full-auto aggregates elsewhere). */
  suppressOutputCountWarnings?: boolean;
}

interface UseGenerateReturn {
  generate: (
    stage: WorkflowStage,
    data: Record<string, unknown>,
    options?: GenerateOptions
  ) => Promise<GenerateResult>;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGenerate(): UseGenerateReturn {
  const { addToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    stage: WorkflowStage,
    data: Record<string, unknown>,
    options?: GenerateOptions
  ): Promise<GenerateResult> => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          data,
          model: options?.model,
          projectId: options?.projectId,
          runId: options?.runId,
          usageSource: options?.usageSource,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json() as GenerateResult;
      if (
        !options?.suppressOutputCountWarnings &&
        Array.isArray(result.warnings) &&
        result.warnings.length > 0
      ) {
        const msg =
          result.warnings.length === 1
            ? result.warnings[0]
            : `Output count (${result.warnings.length}): ${result.warnings.join(' | ')}`;
        addToast({ type: 'warning', message: msg, duration: 12_000 });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { generate, isGenerating, error, clearError };
}
