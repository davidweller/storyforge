'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/hooks/useProject';
import { Button, Textarea } from '@/components/ui';
import { GENRES, getNichesByGenre, getGenreById } from '@/lib/data/genres';
import type { Genre, Niche } from '@/lib/data/genres';

type Step = 'genre' | 'niche' | 'details';

export default function NewProjectPage() {
  const router = useRouter();
  const { createProject, loading, error } = useCreateProject();
  
  const [step, setStep] = useState<Step>('genre');
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [formData, setFormData] = useState({
    premise: '',
    research: '',
  });
  
  const handleGenreSelect = (genre: Genre) => {
    setSelectedGenre(genre);
    setSelectedNiche(null);
    setStep('niche');
  };
  
  const handleNicheSelect = (niche: Niche) => {
    setSelectedNiche(niche);
    setStep('details');
  };
  
  const handleSkipNiche = () => {
    setSelectedNiche(null);
    setStep('details');
  };
  
  const handleBack = () => {
    if (step === 'niche') {
      setStep('genre');
      setSelectedGenre(null);
    } else if (step === 'details') {
      setStep('niche');
    }
  };
  
  const handleSubmit = async () => {
    if (!selectedGenre) return;
    
    try {
      const projectData = {
        genre: selectedGenre.name,
        niche: selectedNiche?.name,
        premise: formData.premise.trim() || undefined,
        research: formData.research.trim() || undefined,
      };
      
      const projectId = await createProject(projectData);
      
      if (projectId) {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };
  
  const niches = selectedGenre ? getNichesByGenre(selectedGenre.id) : [];
  
  return (
    <div style={{ 
      minHeight: 'calc(100vh - 64px)',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
      padding: '2rem 1.5rem',
    }}>
      <div style={{ maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '2.25rem', 
            fontWeight: 800, 
            color: '#ffffff',
            letterSpacing: '-0.025em',
            marginBottom: '0.5rem',
          }}>
            {step === 'genre' && 'Choose Your Genre'}
            {step === 'niche' && 'Select Your Niche'}
            {step === 'details' && 'Add Details'}
          </h1>
          <p style={{ fontSize: '1rem', color: '#a1a1aa' }}>
            {step === 'genre' && 'What kind of story do you want to tell?'}
            {step === 'niche' && `Narrow down your ${selectedGenre?.name} story`}
            {step === 'details' && 'Optional: Share your initial ideas'}
          </p>
        </div>
        
        {/* Progress indicator */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '0.5rem', 
          marginBottom: '2.5rem' 
        }}>
          {['genre', 'niche', 'details'].map((s, i) => (
            <div
              key={s}
              style={{
                width: '3rem',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 
                  s === step ? '#8B5CF6' : 
                  (['genre', 'niche', 'details'].indexOf(step) > i) ? '#8B5CF6' : 
                  'rgba(255,255,255,0.2)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>
        
        {/* Error display */}
        {error && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            borderRadius: '12px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)' 
          }}>
            <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>{error}</p>
          </div>
        )}
        
        {/* Step 1: Genre Selection */}
        {step === 'genre' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
            gap: '1rem' 
          }}>
            {GENRES.map((genre) => (
              <button
                key={genre.id}
                onClick={() => handleGenreSelect(genre)}
                style={{
                  padding: '1.5rem',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = genre.color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: genre.color,
                  opacity: 0.8,
                }} />
                <div style={{ 
                  fontSize: '2rem', 
                  marginBottom: '0.75rem',
                }}>
                  {genre.icon}
                </div>
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: 600, 
                  color: '#ffffff',
                  marginBottom: '0.5rem',
                }}>
                  {genre.name}
                </h3>
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: '#a1a1aa',
                  lineHeight: 1.5,
                }}>
                  {genre.description}
                </p>
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#71717a',
                }}>
                  {genre.niches.length} niches available
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Step 2: Niche Selection */}
        {step === 'niche' && selectedGenre && (
          <>
            {/* Selected genre indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${selectedGenre.color}40`,
            }}>
              <span style={{ fontSize: '1.5rem' }}>{selectedGenre.icon}</span>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Selected Genre
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                  {selectedGenre.name}
                </div>
              </div>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: '1rem',
              marginBottom: '1.5rem',
            }}>
              {niches.map((niche) => (
                <button
                  key={niche.id}
                  onClick={() => handleNicheSelect(niche)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    backgroundColor: selectedNiche?.id === niche.id 
                      ? `${selectedGenre.color}20`
                      : 'rgba(255, 255, 255, 0.03)',
                    border: selectedNiche?.id === niche.id 
                      ? `2px solid ${selectedGenre.color}`
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedNiche?.id !== niche.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = `${selectedGenre.color}60`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedNiche?.id !== niche.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                >
                  <h3 style={{ 
                    fontSize: '1rem', 
                    fontWeight: 600, 
                    color: '#ffffff',
                    marginBottom: '0.5rem',
                  }}>
                    {niche.name}
                  </h3>
                  <p style={{ 
                    fontSize: '0.875rem', 
                    color: '#a1a1aa',
                    lineHeight: 1.5,
                    marginBottom: '0.75rem',
                  }}>
                    {niche.description}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {niche.keywords.slice(0, 3).map((keyword) => (
                      <span
                        key={keyword}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: `${selectedGenre.color}20`,
                          color: selectedGenre.color,
                        }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Navigation */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <Button variant="ghost" onClick={handleBack}>
                <svg style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <Button variant="secondary" onClick={handleSkipNiche}>
                Skip niche selection
                <svg style={{ width: '1rem', height: '1rem', marginLeft: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </>
        )}
        
        {/* Step 3: Optional Details */}
        {step === 'details' && selectedGenre && (
          <>
            {/* Selected genre/niche indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '2rem',
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${selectedGenre.color}40`,
            }}>
              <span style={{ fontSize: '1.5rem' }}>{selectedGenre.icon}</span>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your Story
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                  {selectedGenre.name}
                  {selectedNiche && <span style={{ color: '#a1a1aa' }}> • {selectedNiche.name}</span>}
                </div>
              </div>
            </div>
            
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: 500, 
                  marginBottom: '0.5rem', 
                  color: '#ffffff' 
                }}>
                  Premise / Initial Idea
                  <span style={{ color: '#71717a', fontWeight: 400 }}> (Optional)</span>
                </label>
                <textarea
                  placeholder="Describe your story idea. What's the core concept? Who's the protagonist? What's the central conflict?"
                  value={formData.premise}
                  onChange={(e) => setFormData({ ...formData, premise: e.target.value })}
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
                    {formData.premise.length} characters
                  </span>
                </div>
              </div>
              
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: 500, 
                  marginBottom: '0.5rem', 
                  color: '#ffffff' 
                }}>
                  Research Notes
                  <span style={{ color: '#71717a', fontWeight: 400 }}> (Optional)</span>
                </label>
                <textarea
                  placeholder="Paste any research, inspiration, or reference material you've gathered. This helps the AI understand your vision better."
                  value={formData.research}
                  onChange={(e) => setFormData({ ...formData, research: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    fontSize: '0.875rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
            
            {/* Info box about title */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              marginBottom: '1.5rem',
            }}>
              <svg style={{ width: '1.25rem', height: '1.25rem', color: '#8B5CF6', flexShrink: 0, marginTop: '0.125rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#c4b5fd', fontWeight: 500 }}>
                  Title comes later
                </p>
                <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.25rem' }}>
                  You&apos;ll choose your title after developing your ending, when you have a clearer vision of your story.
                </p>
              </div>
            </div>
            
            {/* Navigation */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <Button variant="ghost" onClick={handleBack}>
                <svg style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <Button onClick={handleSubmit} loading={loading}>
                Create Project
                <svg style={{ width: '1rem', height: '1rem', marginLeft: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </div>
          </>
        )}
        
        {/* Cancel button - always visible */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => router.back()}
            style={{
              fontSize: '0.875rem',
              color: '#71717a',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem 1rem',
            }}
          >
            Cancel and go back
          </button>
        </div>
      </div>
    </div>
  );
}
