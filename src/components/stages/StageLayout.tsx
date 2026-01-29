'use client';

import { ReactNode } from 'react';
import { WorkflowSidebar, ContextDrawer } from '@/components/layout';
import { Badge } from '@/components/ui';
import { STAGE_NAMES, STAGE_DESCRIPTIONS, STAGE_MODELS } from '@/lib/utils';
import type { WorkflowStage, Chapter } from '@/types';

interface StageLayoutProps {
  projectId: string;
  projectTitle?: string;  // Optional - may not be set until after ending stage
  genre?: string;         // Used as fallback display when title is missing
  niche?: string;         // Additional context for display
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
  genre,
  niche,
  currentStage,
  activeStage,
  chapters = [],
  approvedChapterIds = new Set(),
  contextContent,
  children,
}: StageLayoutProps) {
  const model = STAGE_MODELS[activeStage];
  
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <WorkflowSidebar
        projectId={projectId}
        projectTitle={projectTitle}
        genre={genre}
        niche={niche}
        currentStage={currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
      />
      
      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {/* Stage header */}
        <div style={{ 
          borderBottom: '1px solid #e5e5e5', 
          backgroundColor: '#ffffff', 
          padding: '2rem 3rem',
        }}>
          <div style={{ maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#171717' }}>
                {STAGE_NAMES[activeStage]}
              </h1>
              <Badge variant={model === 'claude' ? 'info' : 'default'}>
                {model === 'claude' ? 'Claude' : 'GPT-4'}
              </Badge>
            </div>
            <p style={{ color: '#737373' }}>
              {STAGE_DESCRIPTIONS[activeStage]}
            </p>
          </div>
        </div>
        
        {/* Stage content */}
        <div style={{ padding: '2rem 3rem' }}>
          <div style={{ maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
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
