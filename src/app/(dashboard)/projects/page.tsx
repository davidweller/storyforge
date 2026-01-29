'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '@/hooks/useProject';
import { Button, Badge } from '@/components/ui';
import { formatRelativeTime, STAGE_NAMES } from '@/lib/utils';

// Skeleton card component for loading state
function SkeletonCard() {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ height: '1.5rem', borderRadius: '4px', width: '75%', backgroundColor: '#f5f5f5' }} />
        <div style={{ height: '1.25rem', borderRadius: '9999px', width: '4rem', backgroundColor: '#f5f5f5' }} />
      </div>
      <div style={{ height: '1rem', borderRadius: '4px', width: '33%', backgroundColor: '#f5f5f5', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ height: '1rem', borderRadius: '4px', width: '100%', backgroundColor: '#f5f5f5' }} />
        <div style={{ height: '1rem', borderRadius: '4px', width: '66%', backgroundColor: '#f5f5f5' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ height: '0.75rem', borderRadius: '4px', width: '6rem', backgroundColor: '#f5f5f5' }} />
        <div style={{ height: '0.75rem', borderRadius: '4px', width: '4rem', backgroundColor: '#f5f5f5' }} />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, loading, error } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredProjects = projects.filter((project) =>
    (project.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    project.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.niche?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );
  
  // Show skeleton loading state
  if (loading && projects.length === 0) {
    return (
      <div style={{ paddingTop: '3rem', paddingBottom: '3rem', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <div style={{ height: '2.25rem', borderRadius: '4px', width: '12rem', backgroundColor: '#f5f5f5', marginBottom: '0.5rem' }} />
            <div style={{ height: '1.25rem', borderRadius: '4px', width: '6rem', backgroundColor: '#f5f5f5' }} />
          </div>
          <div style={{ height: '2.75rem', borderRadius: '8px', width: '9rem', backgroundColor: '#f5f5f5' }} />
        </div>
        
        {/* Grid skeleton */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ paddingTop: '3rem', paddingBottom: '3rem', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#171717', letterSpacing: '-0.025em' }}>
            Your Projects
          </h1>
          <p style={{ marginTop: '0.375rem', color: '#737373' }}>
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="lg">
            <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
        </Link>
      </div>
      
      {/* Search */}
      {projects.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', maxWidth: '24rem' }}>
            <svg
              style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                width: '1.25rem', 
                height: '1.25rem',
                color: '#737373'
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '2.75rem',
                paddingLeft: '2.5rem',
                paddingRight: '2.5rem',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#171717',
                border: '1px solid #d4d4d4',
                outline: 'none',
                fontSize: '0.875rem',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ 
                  position: 'absolute', 
                  right: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  width: '1.25rem', 
                  height: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '9999px',
                  backgroundColor: '#f5f5f5', 
                  color: '#737373',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="Clear search"
              >
                <svg style={{ width: '0.75rem', height: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{error}</p>
        </div>
      )}
      
      {/* Empty state */}
      {projects.length === 0 && !loading && (
        <div style={{ maxWidth: '32rem', marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ 
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '4rem', 
              height: '4rem', 
              borderRadius: '9999px', 
              backgroundColor: '#f5f5f5',
              marginBottom: '1rem'
            }}>
              <svg style={{ width: '2rem', height: '2rem', color: '#737373' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#171717', marginBottom: '0.5rem' }}>
              No projects yet
            </h2>
            <p style={{ color: '#737373', marginBottom: '1.5rem' }}>
              Start your first novel project and let AI help you through the entire writing process.
            </p>
            <Link href="/projects/new">
              <Button size="lg">
                <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Project
              </Button>
            </Link>
          </div>
        </div>
      )}
      
      {/* Projects grid */}
      {filteredProjects.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                height: '100%',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: 600, 
                    color: '#171717',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {project.title || `${project.genre} Project`}
                  </h3>
                  <Badge variant={project.status === 'completed' ? 'success' : 'default'}>
                    {project.status}
                  </Badge>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#737373', marginBottom: '1rem' }}>
                  {project.genre}{project.niche && ` • ${project.niche}`}
                </p>
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: '#737373', 
                  marginBottom: '1rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {project.premise || 'No premise provided yet'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#737373' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {STAGE_NAMES[project.currentStage]}
                  </span>
                  <span>{formatRelativeTime(project.updatedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      
      {/* No search results */}
      {projects.length > 0 && filteredProjects.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: '3rem', paddingBottom: '3rem' }}>
          <p style={{ color: '#737373' }}>
            No projects match &quot;{searchQuery}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
