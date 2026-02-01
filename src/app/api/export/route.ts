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
  // Authentication disabled for testing
  // const userId = await verifyToken(request);
  // if (!userId) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  
  try {
    const { projectId, format, includeFrontMatter, includeBackMatter } = await request.json();
    
    if (!projectId || !format) {
      return NextResponse.json({ error: 'Missing projectId or format' }, { status: 400 });
    }
    
    let db;
    try {
      db = getAdminDb();
    } catch (adminError) {
      console.error('Firebase Admin initialization error:', adminError);
      return NextResponse.json(
        { 
          error: `Firebase Admin not configured: ${adminError instanceof Error ? adminError.message : 'Unknown error'}. Please configure FIREBASE_ADMIN credentials in your environment.` 
        },
        { status: 500 }
      );
    }
    
    // Get project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    const project = projectDoc.data();
    // Authentication check disabled for testing
    // if (project?.userId !== userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }
    
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
            text: `Genre: ${project?.genre || ''}`,
            spacing: { after: 800 },
          }),
          new Paragraph({
            text: '',
            spacing: { after: 400 },
          })
        );
      }
      
      for (const chapter of sortedChapters) {
        if (!chapter.content || chapter.content.trim().length === 0) {
          continue; // Skip chapters with no content
        }
        
        children.push(
          new Paragraph({
            text: `Chapter ${chapter.number}: ${chapter.title || 'Untitled'}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 400 },
          })
        );
        
        // Parse HTML content into paragraphs
        const paragraphs = parseHtmlToParagraphs(chapter.content);
        if (paragraphs.length > 0) {
          children.push(...paragraphs);
        } else {
          // Fallback: if parsing fails, use plain text
          const plainText = stripHtml(chapter.content);
          if (plainText.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun(plainText)],
                spacing: { after: 200 },
              })
            );
          }
        }
        
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
      
      // Ensure we have at least one paragraph
      if (children.length === 0) {
        children.push(
          new Paragraph({
            text: 'No content available',
          })
        );
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });
      
      try {
        const buffer = await Packer.toBuffer(doc);
        const uint8Array = new Uint8Array(buffer);
        
        return new NextResponse(uint8Array, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${slugify(project?.title || 'manuscript')}.docx"`,
          },
        });
      } catch (docxError) {
        console.error('DOCX generation error:', docxError);
        throw new Error(`Failed to generate DOCX: ${docxError instanceof Error ? docxError.message : 'Unknown error'}`);
      }
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
  
  if (!html || html.trim().length === 0) {
    return paragraphs;
  }
  
  // Handle TipTap/ProseMirror JSON format if present
  if (html.trim().startsWith('{')) {
    try {
      const json = JSON.parse(html);
      if (json.type === 'doc' && json.content) {
        // Parse ProseMirror document structure
        html = parseProseMirrorToHtml(json);
      }
    } catch {
      // Not JSON, continue with HTML parsing
    }
  }
  
  // Split by paragraph tags, handling both <p> and </p>
  // First, normalize the HTML
  let normalizedHtml = html
    .replace(/<p><\/p>/g, '') // Remove empty paragraphs
    .replace(/<p\s*\/>/g, '') // Remove self-closing paragraphs
    .trim();
  
  // If no paragraph tags, treat entire content as one paragraph
  if (!normalizedHtml.includes('<p>') && !normalizedHtml.includes('</p>')) {
    const text = stripHtml(normalizedHtml);
    if (text.trim()) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(text)],
          spacing: { after: 200 },
        })
      );
    }
    return paragraphs;
  }
  
  // Split by paragraph boundaries
  const parts = normalizedHtml.split(/(?:<\/p>|<p[^>]*>)/);
  
  for (const part of parts) {
    const text = part
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
    
    if (text) {
      // Split by newlines to handle line breaks
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun(line.trim())],
              spacing: { after: 200 },
            })
          );
        }
      }
    }
  }
  
  return paragraphs;
}

function parseProseMirrorToHtml(node: any): string {
  if (typeof node === 'string') {
    return node;
  }
  
  if (!node || typeof node !== 'object') {
    return '';
  }
  
  let html = '';
  
  if (node.type === 'text') {
    return node.text || '';
  }
  
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      html += parseProseMirrorToHtml(child);
      
      if (node.type === 'paragraph' || node.type === 'heading') {
        html += '\n';
      }
    }
  }
  
  return html;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
