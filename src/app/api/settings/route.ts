import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getSettingsPath(): string {
  const dataDir =
    process.env.STORYFORGE_DATA_DIR ||
    path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'settings.json');
}

interface Settings {
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

function readSettings(): Settings {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Settings;
  } catch {
    return {};
  }
}

function writeSettings(settings: Settings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return '';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

export async function GET() {
  const settings = readSettings();
  return NextResponse.json({
    openaiApiKey: maskKey(settings.openaiApiKey),
    anthropicApiKey: maskKey(settings.anthropicApiKey),
    hasOpenaiKey: !!settings.openaiApiKey,
    hasAnthropicKey: !!settings.anthropicApiKey,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Settings>;
    const current = readSettings();

    const updated: Settings = { ...current };
    if (body.openaiApiKey !== undefined) {
      updated.openaiApiKey = body.openaiApiKey || undefined;
    }
    if (body.anthropicApiKey !== undefined) {
      updated.anthropicApiKey = body.anthropicApiKey || undefined;
    }

    writeSettings(updated);

    // Update env vars in the running process so new LLM calls pick them up
    // without needing a restart (best-effort).
    if (updated.openaiApiKey) {
      process.env.OPENAI_API_KEY = updated.openaiApiKey;
    }
    if (updated.anthropicApiKey) {
      process.env.ANTHROPIC_API_KEY = updated.anthropicApiKey;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}
