'use client';

import { ReactNode } from 'react';
import { WorkflowSidebar, ContextDrawer, ContextSection } from '@/components/layout';
import { Badge } from '@/components/ui';
import { STAGE_NAMES, STAGE_DESCRIPTIONS, STAGE_MODELS } from '@/lib/utils';
import type { WorkflowStage, Chapter, ProjectDocument } from '@/types';

interface StageLayoutProps {
  projectId: string;
  projectTitle: string;
  currentStage: WorkflowStage;
  activeStage: WorkflowStage;
  chapters?: Chapter[];
  approvedChapterIds?: Set<string>;
  contextContent?: ReactNode;
  children: ReactNode;
}

export function StageLayout({
  projectId,
  projectTitle,
  currentStage,
  activeStage,
  chapters = [],
  approvedChapterIds = new Set(),
  contextContent,
  children,
}: StageLayoutProps) {
  const model = STAGE_MODELS[activeStage];
  
  return (
    <div className="flex h-[calc(100vh-var(--header-height))]">
      {/* Sidebar */}
      <WorkflowSidebar
        projectId={projectId}
        projectTitle={projectTitle}
        currentStage={currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
      />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Stage header */}
        <div className="border-b border-[var(--border)] bg-[var(--card)] px-8 py-6">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                {STAGE_NAMES[activeStage]}
              </h1>
              <Badge variant={model === 'claude' ? 'info' : 'default'}>
                {model === 'claude' ? 'Claude' : 'GPT-4'}
              </Badge>
            </div>
            <p className="text-[var(--muted-foreground)]">
              {STAGE_DESCRIPTIONS[activeStage]}
            </p>
          </div>
        </div>
        
        {/* Stage content */}
        <div className="p-8">
          <div className="max-w-4xl">
            {children}
          </div>
        </div>
      </main>
      
      {/* Context drawer */}
      {contextContent && (
        <ContextDrawer>
          {contextContent}
        </ContextDrawer>
      )}
    </div>
  );
}
