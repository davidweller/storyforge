'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/hooks/useProject';
import { useProjectStore } from '@/stores/projectStore';
import { StageLayout } from '@/components/stages';
import { Button, Input, Textarea } from '@/components/ui';
import { getNextStage } from '@/lib/utils';
import type { WorkflowStage } from '@/types';

interface SetupPageProps {
  params: Promise<{ projectId: string }>;
}

export default function SetupPage({ params }: SetupPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  
  const {
    project,
    chapters,
    loading: projectLoading,
    error: projectError,
  } = useProject(projectId);
  
  const { updateProject, advanceStage } = useProjectStore();
  
  const [premise, setPremise] = useState('');
  const [research, setResearch] = useState('');
  const [fullAutoMode, setFullAutoMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Load existing values
  useEffect(() => {
    if (project) {
      setPremise(project.premise || '');
      setResearch(project.research || '');
      setFullAutoMode(!!project.fullAutoMode);
    }
  }, [project]);
  
  // Track changes
  useEffect(() => {
    if (project) {
      const premiseChanged = premise !== (project.premise || '');
      const researchChanged = research !== (project.research || '');
      setHasChanges(premiseChanged || researchChanged);
    }
  }, [premise, research, project]);
  
  if (projectLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProject(projectId, {
        premise: premise || undefined,
        research: research || undefined,
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleContinue = async () => {
    setIsSaving(true);
    try {
      // Save any pending changes and optional fullAutoMode
      const updates: Parameters<typeof updateProject>[1] = {
        premise: premise || undefined,
        research: research || undefined,
        fullAutoMode: fullAutoMode || undefined,
      };
      if (hasChanges || fullAutoMode !== !!project.fullAutoMode) {
        await updateProject(projectId, updates);
      }
      
      const nextStage = getNextStage('setup');
      if (nextStage && project.currentStage === 'setup') {
        await advanceStage(projectId, nextStage as WorkflowStage);
      }
      
      if (fullAutoMode) {
        router.push(`/projects/${projectId}/full-auto`);
      } else if (nextStage) {
        router.push(`/projects/${projectId}/stage/${nextStage}`);
      }
    } catch (err) {
      console.error('Failed to continue:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <StageLayout
      projectId={projectId}
      projectTitle={project.title}
      genre={project.genre}
      niche={project.niche}
      currentStage={project.currentStage}
      activeStage="setup"
      chapters={chapters}
      blurbFilled={!!project.blurb?.trim()}
      amazonDescriptionFilled={!!project.amazonDescription?.trim()}
    >
      {/* Error display */}
      {projectError && (
        <div className="mb-6 p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
          <p className="text-sm text-[var(--destructive)]">{projectError}</p>
        </div>
      )}
      
      {/* Setup form */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #e5e5e5', 
        borderRadius: '12px',
        padding: '2rem',
      }}>
        {/* Genre & Niche display */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#737373', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Selection
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#171717',
            }}>
              {project.genre}
            </span>
            {project.niche && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#6366f1',
              }}>
                {project.niche}
              </span>
            )}
          </div>
        </div>
        
        {/* Premise input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#171717', marginBottom: '0.5rem' }}>
            Story Premise (Optional)
          </label>
          <Textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="Describe your story idea. What's the core concept? Who's the protagonist? What's the central conflict? The more detail you provide, the better the AI can tailor its suggestions."
            rows={4}
          />
          <p style={{ fontSize: '0.75rem', color: '#737373', marginTop: '0.5rem' }}>
            This helps the AI understand your vision and generate more relevant content.
          </p>
        </div>
        
        {/* Research input */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#171717', marginBottom: '0.5rem' }}>
            Research Notes (Optional)
          </label>
          <Textarea
            value={research}
            onChange={(e) => setResearch(e.target.value)}
            placeholder="Paste any research, inspiration, or reference material you've gathered. This could include character ideas, world-building notes, plot points, or examples from books you admire."
            rows={4}
          />
          <p style={{ fontSize: '0.75rem', color: '#737373', marginTop: '0.5rem' }}>
            Include anything that might help shape your story - notes, links, excerpts, etc.
          </p>
        </div>
        
        {/* Full Auto Mode */}
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--muted)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={fullAutoMode}
              onChange={(e) => setFullAutoMode(e.target.checked)}
              style={{ marginTop: '0.25rem', width: '1rem', height: '1rem' }}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)' }}>
              Run in Full Auto Mode — every step from Market Analysis through Amazon Description will be generated and completed automatically with no intervention.
            </span>
          </label>
          {fullAutoMode && (
            <p style={{ marginTop: '0.75rem', marginLeft: '1.75rem', fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 500 }}>
              This can take a long time and will use a significant number of AI tokens. The app will run without further input until all steps are complete.
            </p>
          )}
        </div>
        
        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          {hasChanges && (
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          <Button
            onClick={handleContinue}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Continue to Market Analysis'}
            <svg style={{ width: '1rem', height: '1rem', marginLeft: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </div>
    </StageLayout>
  );
}
