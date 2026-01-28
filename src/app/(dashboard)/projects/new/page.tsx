'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/hooks/useProject';
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { cn } from '@/lib/utils';

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
    
    if (!formData.premise.trim()) {
      newErrors.premise = 'Premise is required';
    } else if (formData.premise.trim().length < 50) {
      newErrors.premise = 'Premise should be at least 50 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    try {
      const projectId = await createProject({
        title: formData.title.trim(),
        genre: formData.genre,
        premise: formData.premise.trim(),
        research: formData.research.trim() || undefined,
      });
      
      router.push(`/projects/${projectId}`);
    } catch (err) {
      // Error is handled by the store
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card>
        <CardHeader className="pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight mb-2">
            Create New Project
          </CardTitle>
          <CardDescription className="text-base">
            Start your novel journey. You can always edit these details later.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-10">
            {/* Error */}
            {error && (
              <div className="p-4 bg-[rgba(239,68,68,0.1)] border border-[var(--destructive)] border-opacity-30 rounded-xl">
                <p className="text-sm text-[var(--destructive)]">{error}</p>
              </div>
            )}
            
            {/* Core Idea Section */}
            <div className="space-y-8">
              <div className="pb-3 border-b border-[var(--border)] border-opacity-30">
                <h3 className="text-lg font-semibold tracking-tight">Core Idea</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1.5">
                  The essential details about your novel
                </p>
              </div>
              
              <div className="space-y-6">
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
                  <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">
                    Genre
                  </label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="w-full h-11 px-4 py-2.5 text-sm border rounded-xl bg-[var(--card)] text-[var(--foreground)] border-[var(--input)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-opacity-20 transition-all"
                  >
                    <option value="">Select a genre</option>
                    {GENRES.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                  {errors.genre && (
                    <p className="mt-1.5 text-sm text-[var(--destructive)]">{errors.genre}</p>
                  )}
                </div>
                
                {/* Premise */}
                <Textarea
                  label="Premise / Initial Idea"
                  placeholder="Describe your story idea. What's the core concept? Who's the protagonist? What's the central conflict?"
                  value={formData.premise}
                  onChange={(e) => setFormData({ ...formData, premise: e.target.value })}
                  error={errors.premise}
                  rows={6}
                />
              </div>
            </div>
            
            {/* Optional Context Section */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowOptionalSection(!showOptionalSection)}
                className="w-full flex items-center justify-between p-5 bg-[var(--muted)] bg-opacity-40 rounded-xl hover:bg-opacity-60 transition-colors border border-[var(--border)] border-opacity-30"
              >
                <div className="text-left">
                  <h3 className="text-lg font-semibold tracking-tight">Optional Context</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                    Research notes and inspiration (optional)
                  </p>
                </div>
                <svg
                  className={cn(
                    'w-5 h-5 text-[var(--muted-foreground)] transition-transform',
                    showOptionalSection && 'rotate-180'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showOptionalSection && (
                <div className="space-y-6 pt-2 animate-fadeIn">
                  <Textarea
                    label="Research Notes"
                    placeholder="Paste any research, inspiration, or reference material you've gathered. This helps the AI understand your vision better."
                    value={formData.research}
                    onChange={(e) => setFormData({ ...formData, research: e.target.value })}
                    rows={6}
                  />
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="pt-8 pb-6 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center border-t border-[var(--border)]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              loading={loading}
              size="lg"
              className="w-full sm:w-auto font-semibold"
            >
              Create Project
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
