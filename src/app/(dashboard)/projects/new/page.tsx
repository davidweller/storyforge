'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/hooks/useProject';
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';

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
    <div className="max-w-3xl mx-auto px-8 py-12 lg:px-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create New Project</CardTitle>
          <CardDescription>
            Start your novel journey. You can always edit these details later.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8">
            {/* Error */}
            {error && (
              <div className="p-4 bg-[rgba(139,38,53,0.1)] border border-[var(--destructive)] rounded-lg">
                <p className="text-sm text-[var(--destructive)]">{error}</p>
              </div>
            )}
            
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
                className="w-full px-3.5 py-2.5 text-sm border rounded-md bg-[var(--card)] text-[var(--foreground)] border-[var(--input)] focus:border-[var(--ring)] focus:outline-none"
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
              rows={5}
            />
            
            {/* Research (optional) */}
            <Textarea
              label="Research Notes (Optional)"
              placeholder="Paste any research, inspiration, or reference material you've gathered. This helps the AI understand your vision better."
              value={formData.research}
              onChange={(e) => setFormData({ ...formData, research: e.target.value })}
              rows={4}
            />
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Project
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
