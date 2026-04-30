'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { Button, Badge, Textarea, useToast } from '@/components/ui';
import { WorkflowSidebar } from '@/components/layout';
import { STAGE_NAMES, STAGE_ORDER, getStageIndex, formatDate, formatRelativeTime, getStageRouteForDocument } from '@/lib/utils';
import { buildStoryBibleSourceRefs, isCreativeBriefStale, isStoryBibleStale } from '@/lib/context/assembler';
import { parseStoryBible } from '@/lib/generation/schemas';
import * as firestore from '@/lib/db/client';
import {
  labelForFullAutoLastStep,
  readFullAutoCheckpointPending,
  readFullAutoLastStep,
} from '@/lib/fullAuto/checkpointStorage';

interface ProjectDashboardProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { projectId } = use(params);
  const {
    project,
    documents,
    chapters,
    revisionTasks,
    loading,
    error,
    getTotalWordCount,
    getApprovedChaptersCount,
    getOpenIssuesCount,
    getApprovedChapterVersion,
    updateProject,
    createDocument,
    updateDocument,
    approveDocument,
  } = useProject(projectId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [pendingRenameTitle, setPendingRenameTitle] = useState<string | null>(null);
  const [storyBibleDraft, setStoryBibleDraft] = useState('');
  const [isCanonSaving, setIsCanonSaving] = useState(false);
  const [usageTotals, setUsageTotals] = useState({ totalTokens: 0, callCount: 0 });
  const [fullAutoInterruptHint, setFullAutoInterruptHint] = useState<{
    lastStepLabel: string;
    hasPendingCheckpoint: boolean;
  } | null>(null);
  const { addToast } = useToast();
  const { generate, isGenerating: isGeneratingCanon } = useGenerate();

  const manualGenOpts = useMemo(
    () => ({ projectId, usageSource: 'manual-stage' as const }),
    [projectId]
  );

  const refreshUsageTotals = useCallback(async () => {
    try {
      const t = await firestore.getProjectGenerationUsageTotals(projectId);
      setUsageTotals(t);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    if (!pendingRenameTitle) return;
    if (project?.title !== pendingRenameTitle) return;
    addToast({ type: 'success', message: 'Project renamed successfully.' });
    // Avoid synchronous state updates in effect body (eslint rule).
    setTimeout(() => {
      setPendingRenameTitle(null);
      setIsEditingTitle(false);
    }, 0);
  }, [addToast, pendingRenameTitle, project?.title]);

  useEffect(() => {
    if (!pendingRenameTitle) return;
    if (!error) return;
    addToast({ type: 'error', message: `Failed to rename project: ${error}` });
    // Avoid synchronous state updates in effect body (eslint rule).
    setTimeout(() => {
      setPendingRenameTitle(null);
    }, 0);
  }, [addToast, error, pendingRenameTitle]);

  const latestStoryBible = documents
    .filter((doc) => doc.type === 'story-bible')
    .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const approvedStoryBible = documents.find((doc) => doc.type === 'story-bible' && doc.approved);
  const latestCreativeBrief = documents
    .filter((doc) => doc.type === 'creative-brief')
    .sort((a, b) => b.version - a.version || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const approvedCreativeBrief = documents.find((doc) => doc.type === 'creative-brief' && doc.approved);
  const storyBibleStale = latestStoryBible ? isStoryBibleStale(latestStoryBible, documents) : true;
  const creativeBriefStale = latestCreativeBrief ? isCreativeBriefStale(latestCreativeBrief, approvedStoryBible ?? latestStoryBible) : true;

  useEffect(() => {
    setStoryBibleDraft(latestStoryBible?.content ?? '');
  }, [latestStoryBible?.id, latestStoryBible?.content]);

  useEffect(() => {
    void refreshUsageTotals();
  }, [refreshUsageTotals]);

  useEffect(() => {
    const last = readFullAutoLastStep(projectId);
    if (!last) {
      setFullAutoInterruptHint(null);
      return;
    }
    const pending = readFullAutoCheckpointPending(projectId);
    setFullAutoInterruptHint({
      lastStepLabel: labelForFullAutoLastStep(last),
      hasPendingCheckpoint: !!pending,
    });
  }, [projectId, project?.fullAutoMode, project?.blurb, project?.amazonDescription]);
  
  if (loading || !project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', border: '4px solid #e5e5e5', borderTopColor: '#3b82f6', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#737373' }}>Loading project...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
          <Link href="/projects">
            <Button variant="secondary">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const currentStageIndex = getStageIndex(project.currentStage);
  const totalStages = STAGE_ORDER.length;
  const progressPercent = ((currentStageIndex + 1) / totalStages) * 100;
  
  const approvedDocs = documents.filter((d) => d.approved);
  const totalWordCount = getTotalWordCount();
  const approvedChapters = getApprovedChaptersCount();
  const openIssues = getOpenIssuesCount();
  const displayTitle = project.title || `${project.genre} Project`;
  
  // Get approved chapter IDs for sidebar
  const approvedChapterIds = new Set<string>();
  for (const chapter of chapters) {
    if (getApprovedChapterVersion(chapter.id)) {
      approvedChapterIds.add(chapter.id);
    }
  }

  const startEditingTitle = () => {
    setDraftTitle(displayTitle);
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setDraftTitle('');
    setIsEditingTitle(false);
  };

  const saveTitle = async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === project.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    setPendingRenameTitle(nextTitle);
    await updateProject({ title: nextTitle });
    setIsSavingTitle(false);
  };

  const generateStoryBible = async () => {
    if (!project) return;
    const derivedFrom = buildStoryBibleSourceRefs(documents);
    if (derivedFrom.length === 0) {
      addToast({ type: 'error', message: 'Approve planning documents before generating a Story Bible.' });
      return;
    }

    setIsCanonSaving(true);
    try {
      const byType = (type: string) => documents.find((doc) => doc.type === type && doc.approved)?.content;
      const result = await generate('story-bible', {
        title: project.title,
        premise: project.premise,
        genre: project.genre,
        niche: project.niche,
        research: project.research,
        derivedFrom,
        genreResearch: byType('genre'),
        nicheReference: byType('niche'),
        endingReference: byType('ending'),
        endingChoice: byType('ending-choice'),
        charactersReference: byType('characters'),
        structureReference: byType('structure'),
        chapterOutlinesReference: byType('chapter-outlines'),
      }, manualGenOpts);
      if (latestStoryBible) {
        await updateDocument(latestStoryBible.id, {
          content: result.content,
          version: latestStoryBible.version + 1,
          approved: false,
        });
      } else {
        await createDocument({
          projectId: project.id,
          type: 'story-bible',
          content: result.content,
          version: 1,
          approved: false,
        });
      }
      setStoryBibleDraft(result.content);
      addToast({ type: 'success', message: 'Story Bible generated. Review and approve it before drafting.' });
      void refreshUsageTotals();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to generate Story Bible.' });
    } finally {
      setIsCanonSaving(false);
    }
  };

  const saveStoryBibleDraft = async (approve = false) => {
    if (!latestStoryBible) return;
    setIsCanonSaving(true);
    try {
      let content = storyBibleDraft;
      if (approve) {
        const parsed = parseStoryBible(storyBibleDraft);
        content = JSON.stringify({
          storyBible: {
            ...parsed.storyBible,
            approvedAt: new Date().toISOString(),
          },
        }, null, 2);
      }
      await updateDocument(latestStoryBible.id, {
        content,
        approved: approve,
        ...(!approve ? { version: latestStoryBible.version + 1 } : {}),
      });
      setStoryBibleDraft(content);
      addToast({ type: 'success', message: approve ? 'Story Bible approved.' : 'Story Bible saved as a new draft version.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save Story Bible.' });
    } finally {
      setIsCanonSaving(false);
    }
  };

  const generateCreativeBrief = async () => {
    if (!project) return;
    if (!approvedStoryBible) {
      addToast({ type: 'error', message: 'Approve the Story Bible before generating a Creative Brief.' });
      return;
    }

    setIsCanonSaving(true);
    try {
      const result = await generate('creative-brief', {
        storyBibleContent: approvedStoryBible.content,
        storyBibleDocumentId: approvedStoryBible.id,
        storyBibleVersion: approvedStoryBible.version,
        storyBibleUpdatedAt: approvedStoryBible.updatedAt.toISOString(),
      }, manualGenOpts);
      if (latestCreativeBrief) {
        await updateDocument(latestCreativeBrief.id, {
          content: result.content,
          version: latestCreativeBrief.version + 1,
          approved: false,
        });
      } else {
        await createDocument({
          projectId: project.id,
          type: 'creative-brief',
          content: result.content,
          version: 1,
          approved: false,
        });
      }
      addToast({ type: 'success', message: 'Creative Brief generated. Approve it to use it in compact context.' });
      void refreshUsageTotals();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to generate Creative Brief.' });
    } finally {
      setIsCanonSaving(false);
    }
  };

  const approveCreativeBrief = async () => {
    if (!latestCreativeBrief) return;
    setIsCanonSaving(true);
    try {
      await approveDocument(latestCreativeBrief.id);
      addToast({ type: 'success', message: 'Creative Brief approved.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to approve Creative Brief.' });
    } finally {
      setIsCanonSaving(false);
    }
  };
  
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <WorkflowSidebar
        projectId={project.id}
        projectTitle={project.title}
        genre={project.genre}
        niche={project.niche}
        currentStage={project.currentStage}
        chapters={chapters}
        approvedChapterIds={approvedChapterIds}
        revisionTasks={revisionTasks}
        documents={documents}
        fourPassEditorial={!!project.fourPassEditorial}
        blurbFilled={!!project.blurb?.trim()}
        amazonDescriptionFilled={!!project.amazonDescription?.trim()}
      />
      
      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
        <div style={{ maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  {isEditingTitle ? (
                    <>
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveTitle();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEditingTitle();
                          }
                        }}
                        autoFocus
                        maxLength={120}
                        aria-label="Project title"
                        style={{
                          fontSize: '1.875rem',
                          fontWeight: 700,
                          letterSpacing: '-0.025em',
                          color: '#171717',
                          lineHeight: 1.2,
                          border: '1px solid #d4d4d4',
                          borderRadius: '8px',
                          padding: '0.35rem 0.5rem',
                          minWidth: '320px',
                          flex: 1,
                          maxWidth: '620px',
                        }}
                      />
                      <Button size="sm" onClick={() => void saveTitle()} disabled={isSavingTitle}>
                        {isSavingTitle ? 'Saving...' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEditingTitle} disabled={isSavingTitle}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <h1 style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#171717' }}>
                        {displayTitle}
                      </h1>
                      <Button variant="ghost" size="sm" onClick={startEditingTitle}>
                        Rename
                      </Button>
                    </>
                  )}
                </div>
                <p style={{ color: '#737373' }}>
                  {project.genre}{project.niche && ` • ${project.niche}`} • Created {formatDate(project.createdAt)}
                </p>
                {!project.title && (
                  <p style={{ fontSize: '0.8rem', color: '#a3a3a3', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    Title will be set after the ending stage
                  </p>
                )}
              </div>
              <Badge variant={project.status === 'completed' ? 'success' : 'info'}>
                {project.status}
              </Badge>
            </div>
            
            {/* Progress bar */}
            <div style={{ backgroundColor: '#f5f5f5', borderRadius: '9999px', height: '0.5rem', overflow: 'hidden' }}>
              <div
                style={{ height: '100%', backgroundColor: '#3b82f6', transition: 'all 0.5s', width: `${progressPercent}%` }}
              />
            </div>
            <p style={{ fontSize: '0.875rem', color: '#737373', marginTop: '0.5rem' }}>
              Stage {currentStageIndex + 1} of {totalStages}: {STAGE_NAMES[project.currentStage]}
            </p>
          </div>

          {fullAutoInterruptHint &&
            (!project.fullAutoMode || fullAutoInterruptHint.hasPendingCheckpoint) && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
                backgroundColor: '#eff6ff',
              }}
            >
              <p style={{ fontSize: '0.9375rem', color: '#1e3a5f', margin: 0, marginBottom: '0.5rem', fontWeight: 600 }}>
                Full Auto progress
              </p>
              <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0, marginBottom: '0.75rem' }}>
                Last recorded checkpoint: <strong>{fullAutoInterruptHint.lastStepLabel}</strong>
                {fullAutoInterruptHint.hasPendingCheckpoint && project.fullAutoMode
                  ? ' — a review gate was open; reopen Full Auto to restore it after load.'
                  : ''}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                {project.fullAutoMode && (!project.blurb?.trim() || !project.amazonDescription?.trim()) && (
                  <Link href={`/projects/${projectId}/full-auto`}>
                    <Button size="sm">{fullAutoInterruptHint.hasPendingCheckpoint ? 'Resume checkpoint' : 'Open Full Auto'}</Button>
                  </Link>
                )}
                {!project.fullAutoMode && (
                  <span style={{ fontSize: '0.8125rem', color: '#1e40af' }}>
                    Turn Full Auto back on from the{' '}
                    <Link href={`/projects/${projectId}/stage/chapters`} style={{ textDecoration: 'underline' }}>
                      Chapters
                    </Link>{' '}
                    stage or{' '}
                    <Link href={`/projects/${projectId}/stage/setup`} style={{ textDecoration: 'underline' }}>
                      Setup
                    </Link>{' '}
                    to continue.
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {[
              { value: totalWordCount.toLocaleString(), label: 'Total Words' },
              { value: `${approvedChapters}/${chapters.length}`, label: 'Chapters Approved' },
              { value: approvedDocs.length, label: 'Reference Docs' },
              { value: openIssues, label: 'Open Issues' },
              {
                value: usageTotals.totalTokens.toLocaleString(),
                label: `AI tokens${usageTotals.callCount > 0 ? ` (${usageTotals.callCount} calls)` : ''}`,
              },
            ].map((stat, i) => (
              <div key={i} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#171717' }}>{stat.value}</div>
                <p style={{ fontSize: '0.875rem', color: '#737373' }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Canon */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#171717', marginBottom: '0.25rem' }}>Story Bible & Canon</h2>
                <p style={{ fontSize: '0.875rem', color: '#737373' }}>
                  Generate and approve durable canon before chapter drafting. Approved canon is used as the primary context source.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button onClick={generateStoryBible} disabled={isCanonSaving || isGeneratingCanon} size="sm">
                  {latestStoryBible ? 'Regenerate Story Bible' : 'Generate Story Bible'}
                </Button>
                <Button onClick={generateCreativeBrief} disabled={isCanonSaving || isGeneratingCanon || !approvedStoryBible} size="sm" variant="secondary">
                  {latestCreativeBrief ? 'Regenerate Brief' : 'Generate Brief'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <Badge variant={approvedStoryBible ? 'success' : 'default'}>
                Story Bible: {approvedStoryBible ? `Approved v${approvedStoryBible.version}` : latestStoryBible ? `Draft v${latestStoryBible.version}` : 'Missing'}
              </Badge>
              <Badge variant={storyBibleStale ? 'warning' : 'success'}>
                {storyBibleStale ? 'Story Bible stale or missing' : 'Story Bible current'}
              </Badge>
              <Badge variant={approvedCreativeBrief ? 'success' : 'default'}>
                Creative Brief: {approvedCreativeBrief ? `Approved v${approvedCreativeBrief.version}` : latestCreativeBrief ? `Draft v${latestCreativeBrief.version}` : 'Missing'}
              </Badge>
              <Badge variant={creativeBriefStale ? 'warning' : 'success'}>
                {creativeBriefStale ? 'Creative Brief stale or missing' : 'Creative Brief current'}
              </Badge>
            </div>

            {latestStoryBible ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Textarea
                  value={storyBibleDraft}
                  onChange={(event) => setStoryBibleDraft(event.target.value)}
                  rows={14}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  aria-label="Story Bible JSON"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '0.8rem', color: '#737373', maxWidth: '34rem' }}>
                    Review edits carefully before approval. Direct edits make the Creative Brief stale until regenerated.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button variant="secondary" size="sm" onClick={() => void saveStoryBibleDraft(false)} disabled={isCanonSaving || isGeneratingCanon}>
                      Save Draft
                    </Button>
                    <Button size="sm" onClick={() => void saveStoryBibleDraft(true)} disabled={isCanonSaving || isGeneratingCanon}>
                      Approve Story Bible
                    </Button>
                    {latestCreativeBrief && (
                      <Button variant="secondary" size="sm" onClick={approveCreativeBrief} disabled={isCanonSaving || isGeneratingCanon || creativeBriefStale}>
                        Approve Brief
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px', color: '#737373', fontSize: '0.875rem' }}>
                No Story Bible has been generated yet. Approve the planning documents first, then generate canon from this panel.
              </div>
            )}

            {latestCreativeBrief && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#171717' }}>Creative Brief Preview</summary>
                <pre style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '1rem', fontSize: '0.8rem', color: '#171717', maxHeight: '16rem', overflow: 'auto' }}>
                  {latestCreativeBrief.content}
                </pre>
              </details>
            )}
          </div>
          
          {/* Resume Full Auto (when in full auto mode and not yet complete) */}
          {project.fullAutoMode && (!project.blurb?.trim() || !project.amazonDescription?.trim()) && (
            <div style={{ 
              marginBottom: '1.5rem', 
              backgroundColor: 'rgba(99, 102, 241, 0.1)', 
              border: '1px solid rgba(99, 102, 241, 0.4)', 
              borderRadius: '12px', 
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--foreground)' }}>Full Auto Mode</h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                    Resume automatic run from {STAGE_NAMES[project.currentStage]} through Amazon Description.
                  </p>
                </div>
                <Link href={`/projects/${project.id}/full-auto`}>
                  <Button size="lg">
                    Resume Full Auto
                    <svg style={{ width: '1rem', height: '1rem', marginLeft: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </Button>
                </Link>
              </div>
            </div>
          )}
          
          {/* Continue CTA */}
          <div style={{ 
            marginBottom: '2.5rem', 
            background: 'linear-gradient(to right, #171717, #404040)', 
            borderRadius: '12px', 
            padding: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ffffff' }}>Continue Your Story</h2>
                <p style={{ color: '#d4d4d4' }}>
                  Pick up where you left off at {STAGE_NAMES[project.currentStage]}
                </p>
              </div>
              <Link href={`/projects/${project.id}/stage/${project.currentStage}`}>
                <Button
                  variant="secondary"
                  size="lg"
                >
                  Continue
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Premise */}
          {project.premise && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#171717' }}>Premise</h3>
              <p style={{ color: '#171717', whiteSpace: 'pre-wrap' }}>{project.premise}</p>
            </div>
          )}
          
          {/* Reference Documents */}
          {approvedDocs.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#171717' }}>Reference Documents</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {approvedDocs.map((doc) => {
                  const stageRoute = getStageRouteForDocument(doc.type);
                  return (
                    <div
                      key={doc.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg style={{ width: '1rem', height: '1rem', color: '#10b981' }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontWeight: 500, color: '#171717', textTransform: 'capitalize' }}>
                            Reference – {doc.type}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#737373' }}>
                            v{doc.version} • {formatRelativeTime(doc.updatedAt)}
                          </p>
                        </div>
                      </div>
                      {stageRoute && (
                        <Link href={`/projects/${project.id}/stage/${stageRoute}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Chapters */}
          {chapters.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#171717' }}>Chapters</h3>
                <Link href={`/projects/${project.id}/stage/chapters`}>
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {chapters.slice(0, 5).map((chapter) => (
                  <Link
                    key={chapter.id}
                    href={`/projects/${project.id}/chapter/${chapter.id}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '8px', textDecoration: 'none' }}
                  >
                    <div>
                      <p style={{ fontWeight: 500, color: '#171717' }}>
                        Chapter {chapter.chapterNumber}: {chapter.title}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#737373' }}>
                        {chapter.beatReference}
                      </p>
                    </div>
                    <svg style={{ width: '1.25rem', height: '1.25rem', color: '#737373' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
                {chapters.length > 5 && (
                  <p style={{ fontSize: '0.875rem', color: '#737373', textAlign: 'center', paddingTop: '0.5rem' }}>
                    +{chapters.length - 5} more chapters
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
