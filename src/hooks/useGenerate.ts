'use client';

import { useState, useCallback } from 'react';
import { auth } from '@/lib/firebase/config';
import type { WorkflowStage } from '@/types';

interface GenerateResult {
  content: string;
  model: string;
  provider: string;
  tokensUsed: number;
}

interface GenerateOptions {
  model?: string; // Optional model override
}

interface UseGenerateReturn {
  generate: (stage: WorkflowStage, data: Record<string, unknown>, options?: GenerateOptions) => Promise<GenerateResult>;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGenerate(): UseGenerateReturn {
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
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const token = await user.getIdToken();
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          stage, 
          data,
          model: options?.model, // Pass model override if provided
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }
      
      const result = await response.json();
      return result as GenerateResult;
      
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
  
  return {
    generate,
    isGenerating,
    error,
    clearError,
  };
}
