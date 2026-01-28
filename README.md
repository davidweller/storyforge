# StoryForge

AI-powered novel writing web application with a structured, human-in-the-loop workflow.

## Features

- **Guided Workflow**: Progress through 10 stages from idea to polished manuscript
- **AI-Powered**: Uses GPT-4 for research/planning and Claude for creative writing
- **Human Control**: Every output requires explicit approval before becoming canon
- **Version Control**: Track all changes with full version history
- **Export Ready**: Download your manuscript as .docx or .txt

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Editor**: TipTap (ProseMirror-based)
- **Auth**: Firebase Authentication (Google OAuth)
- **Database**: Firebase Firestore
- **LLMs**: OpenAI API (GPT-4), Anthropic API (Claude)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Firestore and Authentication enabled
- OpenAI API key
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd storyforge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example and fill in your values:
   ```bash
   cp env.example .env.local
   ```

4. Configure your `.env.local` with:
   - Firebase configuration (client and admin)
   - OpenAI API key
   - Anthropic API key

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication with Google provider
3. Create a Firestore database
4. Deploy the security rules from `firestore.rules`
5. Deploy the indexes from `firestore.indexes.json`
6. Generate a service account key for admin SDK

### Environment Variables

```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# LLM APIs
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Workflow Stages

1. **Project Setup** - Define title, genre, and premise
2. **Genre Research** (GPT-4) - Market analysis and opportunities
3. **Niche Positioning** (GPT-4) - Target audience and tropes
4. **Ending Development** (Claude) - Design the ending first
5. **Character Design** (GPT-4) - Create your cast
6. **Story Structure** (GPT-4) - Save the Cat beat sheet
7. **Chapter Drafting** (Claude) - Write chapters one by one
8. **Compilation** - Export your manuscript
9. **Editorial Review** (GPT-4) - Get detailed feedback
10. **Revision Loop** (Claude) - Apply fixes chapter by chapter

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

### Manual Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth pages (login)
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── auth/              # Auth components
│   ├── editor/            # TipTap editor
│   ├── layout/            # Layout components
│   ├── stages/            # Stage-specific components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and services
│   ├── firebase/          # Firebase configuration
│   ├── llm/               # LLM integration
│   ├── prompts/           # Prompt templates
│   └── utils/             # Helper functions
├── stores/                # Zustand stores
└── types/                 # TypeScript types
```

## License

MIT
