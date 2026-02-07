import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Optional: when using Firebase Emulator locally, allow bypassing the allowlist (dev only)
    if (
      process.env.ALLOWLIST_DISABLED_FOR_EMULATOR === 'true' &&
      process.env.FIRESTORE_EMULATOR_HOST
    ) {
      return NextResponse.json({ allowed: true });
    }

    // Get allowed emails from environment variable
    const allowedEmailsEnv = process.env.ALLOWED_EMAILS;

    if (!allowedEmailsEnv) {
      // If no allowlist is set, deny all sign-ups for security
      return NextResponse.json({ allowed: false });
    }

    // Parse comma-separated list and normalize emails (trim, lowercase)
    const allowedEmails = allowedEmailsEnv
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0);

    // Check if the provided email (normalized) is in the allowlist
    const normalizedEmail = email.trim().toLowerCase();
    const allowed = allowedEmails.includes(normalizedEmail);

    return NextResponse.json({ allowed });
  } catch (error) {
    console.error('Error checking allowlist:', error);
    return NextResponse.json(
      { error: 'Failed to check allowlist' },
      { status: 500 }
    );
  }
}
