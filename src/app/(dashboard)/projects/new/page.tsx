'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/hooks/useProject';
import { Button, Input, Textarea } from '@/components/ui';

const GENRES = [
  'Fantasy',
  'Science Fiction',
  'Romance',
  'Mystery',
  'Thriller',
  'Horror',
  'Literary Fiction',
  'Historical Fiction',
  'Young Adult',
  'Contemporary',
  'Paranormal',
  'Urban Fantasy',
  'Epic Fantasy',
  'Space Opera',
  'Cozy Mystery',
  'Romantic Suspense',
  'Dark Romance',
  'Other',
];

export default function NewProjectPage() {
  const router = useRouter();
  const { createProject, loading, error } = useCreateProject();
  
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    premise: '',
    research: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOptionalSection, setShowOptionalSection] = useState(false);
  
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.genre) {
      newErrors.genre = 'Please select a genre';
    }
    
    // Premise is now optional - no validation required
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      console.log('Validation failed:', errors);
      return;
    }
    
    console.log('Submitting project with data:', {
      title: formData.title.trim(),
      genre: formData.genre,
      premise: formData.premise.trim() || undefined,
      research: formData.research.trim() || undefined,
    });
    
    try {
      // Prepare data, filtering out empty strings
      const projectData: {
        title: string;
        genre: string;
        premise?: string;
        research?: string;
      } = {
        title: formData.title.trim(),
        genre: formData.genre,
      };
      
      // Only include premise if it has content
      if (formData.premise.trim()) {
        projectData.premise = formData.premise.trim();
      }
      
      // Only include research if it has content
      if (formData.research.trim()) {
        projectData.research = formData.research.trim();
      }
      
      console.log('Calling createProject with:', projectData);
      const projectId = await createProject(projectData);
      console.log('Project created with ID:', projectId);
      
      if (projectId) {
        router.push(`/projects/${projectId}`);
      }
    } catch (err) {
      // Error is handled by the store and displayed in the UI
      console.error('Error creating project:', err);
      // Don't navigate if there's an error
    }
  };
  
  return (
    <div style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
      <div style={{ 
        backgroundColor: '#ffffff', 
        borderRadius: '16px', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        padding: '2rem'
      }}>
        <div style={{ paddingBottom: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e5e5' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#171717', marginBottom: '0.5rem' }}>
            Create New Project
          </h1>
          <p style={{ fontSize: '1rem', color: '#737373' }}>
            Start your novel journey. You can always edit these details later.
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Error */}
            {error && (
              <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{error}</p>
              </div>
            )}
            
            {/* Core Idea Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#171717' }}>Core Idea</h3>
                <p style={{ fontSize: '0.875rem', color: '#737373', marginTop: '0.25rem' }}>
                  The essential details about your novel
                </p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Title */}
                <Input
                  label="Working Title"
                  placeholder="Enter your novel's working title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  error={errors.title}
                />
                
                {/* Genre */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#171717' }}>
                    Genre
                  </label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0.625rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: formData.genre ? '#171717' : '#a3a3a3',
                      border: errors.genre ? '2px solid #ef4444' : '1px solid #d4d4d4',
                      outline: 'none',
                    }}
                  >
                    <option value="">Select a genre</option>
                    {GENRES.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                  {errors.genre && (
                    <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: '#ef4444' }}>{errors.genre}</p>
                  )}
                </div>
                
                {/* Premise */}
                <div>
                  <Textarea
                    label="Premise / Initial Idea (Optional)"
                    placeholder="Describe your story idea. What's the core concept? Who's the protagonist? What's the central conflict?"
                    value={formData.premise}
                    onChange={(e) => setFormData({ ...formData, premise: e.target.value })}
                    error={errors.premise}
                    rows={5}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#737373' }}>
                      {formData.premise.length} characters
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Optional Context Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowOptionalSection(!showOptionalSection)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: '#f8f8f8',
                  border: '1px solid #e5e5e5',
                  cursor: 'pointer',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#171717' }}>Optional Context</h3>
                  <p style={{ fontSize: '0.875rem', color: '#737373', marginTop: '0.125rem' }}>
                    Research notes and inspiration
                  </p>
                </div>
                <svg
                  style={{ 
                    width: '20px', 
                    height: '20px', 
                    color: '#737373',
                    transform: showOptionalSection ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showOptionalSection && (
                <div style={{ paddingTop: '0.5rem' }}>
                  <Textarea
                    label="Research Notes"
                    placeholder="Paste any research, inspiration, or reference material you've gathered. This helps the AI understand your vision better."
                    value={formData.research}
                    onChange={(e) => setFormData({ ...formData, research: e.target.value })}
                    rows={5}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div style={{ 
            paddingTop: '1.5rem', 
            marginTop: '2rem', 
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              loading={loading}
              size="md"
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
