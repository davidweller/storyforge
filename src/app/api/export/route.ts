import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// Verify Firebase auth token
async function verifyToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split('Bearer ')[1];
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyToken(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { projectId, format, includeFrontMatter, includeBackMatter } = await request.json();
    
    if (!projectId || !format) {
      return NextResponse.json({ error: 'Missing projectId or format' }, { status: 400 });
    }
    
    const db = getAdminDb();
    
    // Get project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    const project = projectDoc.data();
    if (project?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Get approved chapter versions
    const versionsSnapshot = await db.collection('chapter_versions')
      .where('projectId', '==', projectId)
      .where('approved', '==', true)
      .orderBy('chapterNumber', 'asc')
      .get();
    
    // Get chapters for titles
    const chaptersSnapshot = await db.collection('chapters')
      .where('projectId', '==', projectId)
      .orderBy('chapterNumber', 'asc')
      .get();
    
    const chapters = new Map<number, { title: string; content: string }>();
    
    chaptersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      chapters.set(data.chapterNumber, { title: data.title, content: '' });
    });
    
    versionsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const chapter = chapters.get(data.chapterNumber);
      if (chapter) {
        chapter.content = data.content;
      }
    });
    
    // Build manuscript content
    const sortedChapters = Array.from(chapters.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, data]) => ({ number: num, ...data }));
    
    if (format === 'txt') {
      // Generate plain text
      let text = '';
      
      if (includeFrontMatter) {
        text += `${project?.title}\n`;
        text += `${'='.repeat(project?.title?.length || 0)}\n\n`;
        text += `Genre: ${project?.genre}\n\n`;
        text += '---\n\n';
      }
      
      for (const chapter of sortedChapters) {
        text += `CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}\n\n`;
        text += stripHtml(chapter.content);
        text += '\n\n---\n\n';
      }
      
      if (includeBackMatter) {
        text += '\n\nTHE END\n';
      }
      
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${slugify(project?.title || 'manuscript')}.txt"`,
        },
      });
    } else if (format === 'docx') {
      // Generate DOCX
      const children: Paragraph[] = [];
      
      if (includeFrontMatter) {
        children.push(
          new Paragraph({
            text: project?.title || 'Untitled',
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: `Genre: ${project?.genre}`,
            spacing: { after: 800 },
          }),
          new Paragraph({
            text: '',
            spacing: { after: 400 },
          })
        );
      }
      
      for (const chapter of sortedChapters) {
        children.push(
          new Paragraph({
            text: `Chapter ${chapter.number}: ${chapter.title}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 400 },
          })
        );
        
        // Parse HTML content into paragraphs
        const paragraphs = parseHtmlToParagraphs(chapter.content);
        children.push(...paragraphs);
        
        children.push(
          new Paragraph({
            text: '',
            spacing: { after: 400 },
          })
        );
      }
      
      if (includeBackMatter) {
        children.push(
          new Paragraph({
            text: 'THE END',
            alignment: 'center' as const,
            spacing: { before: 800 },
          })
        );
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });
      
      const buffer = await Packer.toBuffer(doc);
      const uint8Array = new Uint8Array(buffer);
      
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${slugify(project?.title || 'manuscript')}.docx"`,
        },
      });
    }
    
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function parseHtmlToParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Split by paragraph tags
  const parts = html.split(/<\/?p>/);
  
  for (const part of parts) {
    const text = part
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    
    if (text) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(text)],
          spacing: { after: 200 },
        })
      );
    }
  }
  
  return paragraphs;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
