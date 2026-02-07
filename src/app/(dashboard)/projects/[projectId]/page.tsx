'use client';

import { use } from 'react';
import Link from 'next/link';
import { useProject } from '@/hooks/useProject';
import { Button, Badge } from '@/components/ui';
import { WorkflowSidebar } from '@/components/layout';
import { STAGE_NAMES, STAGE_ORDER, getStageIndex, formatDate, formatRelativeTime } from '@/lib/utils';

interface ProjectDashboardProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { projectId } = use(params);
  const {
    project,
    documents,
    chapters,
    loading,
    error,
    getTotalWordCount,
    getApprovedChaptersCount,
    getOpenIssuesCount,
  } = useProject(projectId);
  
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
  
  // Get approved chapter IDs for sidebar
  const approvedChapterIds = new Set<string>();
  // Note: This would need to be populated from chapter versions in a real implementation
  
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
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.5rem', color: '#171717' }}>
                  {project.title || `${project.genre} Project`}
                </h1>
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
          
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {[
              { value: totalWordCount.toLocaleString(), label: 'Total Words' },
              { value: `${approvedChapters}/${chapters.length}`, label: 'Chapters Approved' },
              { value: approvedDocs.length, label: 'Reference Docs' },
              { value: openIssues, label: 'Open Issues' },
            ].map((stat, i) => (
              <div key={i} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#171717' }}>{stat.value}</div>
                <p style={{ fontSize: '0.875rem', color: '#737373' }}>{stat.label}</p>
              </div>
            ))}
          </div>
          
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
                {approvedDocs.map((doc) => (
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
                    <Link href={`/projects/${project.id}/stage/${doc.type}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                ))}
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
