'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MarketingLayout } from '@/components/layout';
import { Button, Textarea } from '@/components/ui';
import { useProject } from '@/hooks/useProject';
import { useGenerate } from '@/hooks/useGenerate';
import { getEffectiveModelForStage } from '@/lib/data/models';
import { formatCoverToneForPrompt, resolveApprovedCoverTone } from '@/lib/cover/marketingCoverTone';

const DEBOUNCE_MS = 500;

export default function BlurbPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;
  const {
    project,
    documents,
    chapters,
    revisionTasks,
    loading,
    error,
    updateProject,
    getDocumentByType,
  } = useProject(projectId ?? null);
  const { generate, isGenerating, error: generateError, clearError } = useGenerate();
  const [value, setValue] = useState(project?.blurb ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (project?.blurb !== undefined) {
      setValue(project.blurb ?? '');
    }
  }, [project?.blurb]);

  const save = useCallback(
    (text: string) => {
      updateProject({ blurb: text });
    },
    [updateProject]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(next), DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    clearError();
    const genreDoc = getDocumentByType('genre');
    const nicheDoc = getDocumentByType('niche');
    const structureDoc = getDocumentByType('structure');
    const charactersDoc = getDocumentByType('characters');
    const selectedModel = getEffectiveModelForStage('blurb');
    try {
      const tone = resolveApprovedCoverTone(documents ?? [], project.approvedCoverImageId);
      const coverToneBlock =
        project.marketingAlignCoverToneBlurb && tone ? formatCoverToneForPrompt(tone) : undefined;
      const result = await generate(
        'blurb',
        {
          genre: project.genre,
          niche: project.niche,
          title: project.title,
          premise: project.premise,
          marketAnalysis: genreDoc?.content,
          readerTargeting: nicheDoc?.content,
          plotBlueprint: structureDoc?.content,
          charactersReference: charactersDoc?.content,
          ...(coverToneBlock ? { coverToneBlock } : {}),
        },
        { model: selectedModel.id, projectId, usageSource: 'manual-stage' }
      );
      setValue(result.content);
      save(result.content);
    } catch {
      // Error surfaced by useGenerate
    }
  }, [project, documents, getDocumentByType, generate, save, clearError, projectId]);

  if (!projectId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <p style={{ color: '#737373' }}>Loading project...</p>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '3rem',
              height: '3rem',
              border: '4px solid #e5e5e5',
              borderTopColor: '#3b82f6',
              borderRadius: '9999px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ color: '#737373' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
          <Link href={`/projects/${projectId}`}>Back to Project</Link>
        </div>
      </div>
    );
  }

  return (
    <MarketingLayout
      projectId={projectId}
      title="Blurb for back of book"
      stage="blurb"
      project={project}
      documents={documents ?? []}
      chapters={chapters ?? []}
      revisionTasks={revisionTasks ?? []}
    >
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.875rem', color: '#737373', marginBottom: '0.75rem' }}>
          Generate a back-cover blurb for your book. You can edit the result below if needed.
        </p>
        {(generateError) && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{generateError}</p>
          </div>
        )}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#525252',
            marginBottom: '0.75rem',
            cursor: project.approvedCoverImageId ? 'pointer' : 'not-allowed',
          }}
          title={
            !project.approvedCoverImageId
              ? 'Approve a front cover first to enable this option.'
              : undefined
          }
        >
          <input
            type="checkbox"
            checked={Boolean(project.marketingAlignCoverToneBlurb)}
            disabled={!project.approvedCoverImageId}
            onChange={(e) =>
              updateProject({ marketingAlignCoverToneBlurb: e.target.checked })
            }
          />
          Align blurb tone with approved cover
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {value ? 'Regenerate blurb' : 'Generate blurb'}
          </Button>
        </div>
        {isGenerating && (
          <p style={{ fontSize: '0.875rem', color: '#737373', marginBottom: '0.75rem' }}>Generating…</p>
        )}
        <Textarea
          value={value}
          onChange={handleChange}
          placeholder={value ? undefined : 'Click "Generate blurb" to create a blurb from your project.'}
          rows={12}
          style={{ minHeight: '240px' }}
        />
      </div>
    </MarketingLayout>
  );
}
