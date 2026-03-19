'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';

interface SettingsState {
  openaiApiKey: string;
  anthropicApiKey: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
}

export default function SettingsPage() {
  const [state, setState] = useState<SettingsState>({
    openaiApiKey: '',
    anthropicApiKey: '',
    hasOpenaiKey: false,
    hasAnthropicKey: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setState((s) => ({
          ...s,
          hasOpenaiKey: data.hasOpenaiKey,
          hasAnthropicKey: data.hasAnthropicKey,
        }));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (state.openaiApiKey) body.openaiApiKey = state.openaiApiKey;
      if (state.anthropicApiKey) body.anthropicApiKey = state.anthropicApiKey;

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setState((s) => ({
        ...s,
        openaiApiKey: '',
        anthropicApiKey: '',
        hasOpenaiKey: s.hasOpenaiKey || !!s.openaiApiKey,
        hasAnthropicKey: s.hasAnthropicKey || !!s.anthropicApiKey,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-12 max-w-2xl mx-auto px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="mt-1.5 text-muted-foreground">Configure your AI provider API keys.</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">API Keys</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Keys are stored locally on your computer and never sent anywhere except directly to the
            respective AI provider.
          </p>

          {/* OpenAI */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              OpenAI API Key
              {state.hasOpenaiKey && (
                <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  ✓ Configured
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showOpenai ? 'text' : 'password'}
                value={state.openaiApiKey}
                onChange={(e) => setState((s) => ({ ...s, openaiApiKey: e.target.value }))}
                placeholder={state.hasOpenaiKey ? 'Enter new key to replace current one' : 'sk-…'}
                className="w-full h-10 px-3 pr-10 rounded-lg bg-background text-foreground border border-border outline-none text-sm focus:border-[var(--ring)]"
              />
              <button
                type="button"
                onClick={() => setShowOpenai((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showOpenai ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for GPT-4o and other OpenAI models. Get yours at{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                platform.openai.com
              </a>
            </p>
          </div>

          {/* Anthropic */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Anthropic API Key
              {state.hasAnthropicKey && (
                <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  ✓ Configured
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showAnthropic ? 'text' : 'password'}
                value={state.anthropicApiKey}
                onChange={(e) => setState((s) => ({ ...s, anthropicApiKey: e.target.value }))}
                placeholder={state.hasAnthropicKey ? 'Enter new key to replace current one' : 'sk-ant-…'}
                className="w-full h-10 px-3 pr-10 rounded-lg bg-background text-foreground border border-border outline-none text-sm focus:border-[var(--ring)]"
              />
              <button
                type="button"
                onClick={() => setShowAnthropic((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAnthropic ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for Claude models (Sonnet, Opus). Get yours at{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)]">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {saved && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Settings saved successfully.</p>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={saving || (!state.openaiApiKey && !state.anthropicApiKey)}
          >
            Save API Keys
          </Button>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]">
        <p className="text-sm text-[var(--accent)] font-medium mb-1">Where are my keys stored?</p>
        <p className="text-xs text-muted-foreground">
          Keys are saved in a <code className="font-mono bg-muted px-1 rounded">settings.json</code> file
          inside your app data folder (<code className="font-mono bg-muted px-1 rounded">%APPDATA%\StoryForge</code> on Windows).
          They are never uploaded anywhere.
        </p>
      </div>
    </div>
  );
}
