import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProject, getProjectChapters, getApprovedChapterVersions } from '@/lib/db/queries';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel,
  AlignmentType,
} from 'docx';

const ExportBodySchema = z.object({
  projectId: z.string().min(1),
  format: z.enum(['docx', 'txt', 'pdf']),
  includeFrontMatter: z.boolean().optional(),
  includeBackMatter: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = ExportBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { projectId, format, includeFrontMatter, includeBackMatter } = parsed.data;
    const includeFront = includeFrontMatter ?? false;
    const includeBack = includeBackMatter ?? false;

    // Get project
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get approved chapter versions and chapter metadata
    const [approvedVersions, dbChapters] = await Promise.all([
      getApprovedChapterVersions(projectId),
      getProjectChapters(projectId),
    ]);

    const chapters = new Map<number, { title: string; content: string }>();

    dbChapters.forEach((ch) => {
      chapters.set(ch.chapterNumber, { title: ch.title, content: '' });
    });

    approvedVersions.forEach((v) => {
      const chapter = chapters.get(v.chapterNumber);
      if (chapter) {
        chapter.content = v.content;
      }
    });
    
    // Build manuscript content
    const sortedChapters = Array.from(chapters.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, data]) => ({ number: num, ...data }));
    
    if (format === 'txt') {
      // Generate plain text
      let text = '';
      
      if (includeFront) {
        text += `${project.title}\n`;
        text += `${'='.repeat(project.title?.length || 0)}\n\n`;
        text += `Genre: ${project.genre}\n\n`;
        text += '---\n\n';
      }
      
      for (const chapter of sortedChapters) {
        text += `CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}\n\n`;
        text += stripHtml(chapter.content);
        text += '\n\n---\n\n';
      }
      
      if (includeBack) {
        text += '\n\nTHE END\n';
      }
      
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${slugify(project.title || 'manuscript')}.txt"`,
        },
      });
    } else if (format === 'docx') {
      // Generate DOCX
      const children: Paragraph[] = [];
      
      if (includeFront) {
        children.push(
          new Paragraph({
            children: [createTextRun({ text: project.title || 'Untitled' })],
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [createTextRun({ text: `Genre: ${project.genre || ''}` })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
          }),
          new Paragraph({
            spacing: { after: 400 },
          })
        );
      }
      
      for (const chapter of sortedChapters) {
        if (!chapter.content || chapter.content.trim().length === 0) {
          continue; // Skip chapters with no content
        }
        
        // Chapter title with Heading1 style matching example
        children.push(
          new Paragraph({
            children: [
              createTextRun({
                text: chapter.title || 'Untitled',
                size: 40, // 20pt matching example (twips: 20 * 2 = 40)
                color: '0F4761', // Dark blue matching example
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: includeFront && chapter.number === 1,
            spacing: {
              before: 360, // 18pt matching example
              after: 80, // 4pt matching example
            },
            keepNext: true,
            keepLines: true,
          })
        );
        
        // Parse HTML content into paragraphs with formatting
        // First paragraph of chapter uses FirstParagraph style
        const paragraphs = parseHtmlToParagraphs(chapter.content, true);
        if (paragraphs.length > 0) {
          children.push(...paragraphs);
        } else {
          // Fallback: if parsing fails, use plain text
          const plainText = stripHtml(chapter.content);
          if (plainText.trim()) {
            children.push(
              new Paragraph({
                children: [createTextRun({ text: plainText })],
                spacing: {
                  before: 180, // 9pt matching BodyText style
                  after: 180, // 9pt matching BodyText style
                },
              })
            );
          }
        }
        
        // No extra spacing needed - BodyText style handles it
      }
      
      if (includeBack) {
        children.push(
          new Paragraph({
            children: [createTextRun({ text: 'THE END' })],
            alignment: 'center' as const,
            spacing: { before: 800 },
          })
        );
      }
      
      // Ensure we have at least one paragraph
      if (children.length === 0) {
        children.push(
          new Paragraph({
            children: [createTextRun({ text: 'No content available' })],
          })
        );
      }
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                width: 12240, // 8.5 inches in twips
                height: 15840, // 11 inches in twips
              },
              margin: {
                top: 1440, // 1 inch
                right: 1440, // 1 inch
                bottom: 1440, // 1 inch
                left: 1800, // 1.25 inches (standard manuscript left margin)
              },
            },
          },
          children,
        }],
      });
      
      try {
        const buffer = await Packer.toBuffer(doc);
        const uint8Array = new Uint8Array(buffer);
        
        return new NextResponse(uint8Array, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${slugify(project.title || 'manuscript')}.docx"`,
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
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Default font settings
const DEFAULT_FONT = 'Arial';
const DEFAULT_FONT_SIZE = 22; // 11pt in twips (1pt = 2 twips)

/**
 * Helper function to create a TextRun with default Arial 11pt font
 */
function createTextRun(options: {
  text: string;
  bold?: boolean;
  italics?: boolean;
  font?: string;
  size?: number;
  color?: string;
}): TextRun {
  return new TextRun({
    text: options.text,
    bold: options.bold || undefined,
    italics: options.italics || undefined,
    font: options.font || DEFAULT_FONT,
    size: options.size || DEFAULT_FONT_SIZE,
    color: options.color,
  });
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

/**
 * Convert markdown to HTML for parsing
 */
function convertMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Convert headers (must be at start of line, optional space after #)
  html = html.replace(/^####+ (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Convert bold: **text** or __text__ (must be double)
  // Process bold first to avoid conflicts with italics
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  
  // Convert italics: *text* or _text_ (single, not part of ** or __)
  // Match *text* where * is not preceded or followed by another *
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  // Match _text_ where _ is not preceded or followed by another _
  html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
  
  // Convert paragraph breaks (double newlines) - but preserve headers
  // Split by lines and process carefully
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inParagraph = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if line is a header
    if (trimmed.match(/^<h[1-4]>/)) {
      if (inParagraph) {
        processedLines.push('</p>');
        inParagraph = false;
      }
      processedLines.push(line);
    } else if (trimmed === '') {
      // Empty line
      if (inParagraph && i < lines.length - 1) {
        // Check if next non-empty line is a header
        let nextNonEmpty = '';
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim()) {
            nextNonEmpty = lines[j].trim();
            break;
          }
        }
        if (nextNonEmpty.match(/^<h[1-4]>/)) {
          processedLines.push('</p>');
          inParagraph = false;
        } else if (inParagraph) {
          processedLines.push('</p><p>');
        }
      }
    } else {
      // Regular content line
      if (!inParagraph) {
        processedLines.push('<p>');
        inParagraph = true;
      }
      processedLines.push(line);
    }
  }
  
  // Close last paragraph if open
  if (inParagraph) {
    processedLines.push('</p>');
  }
  
  html = processedLines.join('\n');
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

/**
 * Helper function to parse HTML content as paragraphs only (no headers)
 */
function parseHtmlParagraphsOnly(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  
  while ((match = paragraphRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (!content) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 180, after: 180 },
          children: [],
        })
      );
      continue;
    }
    
    const textRuns = parseInlineFormatting(content);
    if (textRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: textRuns,
          spacing: { before: 180, after: 180 },
        })
      );
    }
  }
  
  // If no paragraphs found, try splitting by line breaks
  if (paragraphs.length === 0) {
    const plainText = html.replace(/<[^>]+>/g, '').trim();
    if (plainText) {
      const lines = plainText.split(/\n\n+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const textRuns = parseInlineFormatting(trimmed);
          if (textRuns.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: textRuns,
                spacing: { before: 180, after: 180 },
              })
            );
          }
        }
      }
    }
  }
  
  return paragraphs;
}

function parseHtmlToParagraphs(html: string, isFirstParagraph: boolean = false): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  if (!html || html.trim().length === 0) {
    return paragraphs;
  }
  
  // Handle TipTap/ProseMirror JSON format if present
  if (html.trim().startsWith('{')) {
    try {
      const json = JSON.parse(html);
      if (json.type === 'doc' && json.content) {
        // Parse ProseMirror document structure directly to paragraphs
        return parseProseMirrorToParagraphs(json, isFirstParagraph);
      }
    } catch {
      // Not JSON, continue with parsing
    }
  }
  
  // Always convert markdown formatting (even if content is HTML)
  // This handles cases where HTML contains markdown asterisks like <p>*example text*</p>
  // First check if it's pure markdown (no HTML tags)
  const isPureMarkdown = !html.includes('<') && !html.trim().startsWith('{');
  
  if (isPureMarkdown) {
    // Pure markdown - convert everything
    html = convertMarkdownToHtml(html);
  } else {
    // HTML with potential markdown inside - convert markdown patterns within text content
    // Strategy: Process text nodes separately from HTML tags
    // Split by HTML tags, process text parts, then reassemble
    const parts: string[] = [];
    let lastIndex = 0;
    const tagRegex = /<[^>]+>/g;
    let match;
    
    while ((match = tagRegex.exec(html)) !== null) {
      // Add text before tag (with markdown conversion)
      if (match.index > lastIndex) {
        const textBefore = html.substring(lastIndex, match.index);
        // Convert markdown in this text segment
        let converted = textBefore;
        // Convert bold first (to avoid conflicts with italics)
        converted = converted.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
        converted = converted.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
        // Then convert italics (single asterisks not part of **)
        converted = converted.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        converted = converted.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
        parts.push(converted);
      }
      // Add the HTML tag as-is
      parts.push(match[0]);
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last tag
    if (lastIndex < html.length) {
      const textAfter = html.substring(lastIndex);
      let converted = textAfter;
      // Convert markdown in this text segment
      converted = converted.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
      converted = converted.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
      converted = converted.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
      converted = converted.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
      parts.push(converted);
    }
    
    html = parts.join('');
  }
  
  // Normalize the HTML
  const normalizedHtml = html
    .replace(/<p><\/p>/g, '') // Remove empty paragraphs
    .replace(/<p\s*\/>/g, '') // Remove self-closing paragraphs
    .trim();
  
  // Process headers that were converted from markdown
  const headerMatches: Array<{ match: string; level: number; text: string; index: number }> = [];
  const headerRegex = /<(h[1-4])>(.*?)<\/h[1-4]>/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalizedHtml)) !== null) {
    const level = parseInt(headerMatch[1].substring(1));
    headerMatches.push({
      match: headerMatch[0],
      level,
      text: headerMatch[2],
      index: headerMatch.index,
    });
  }
  
  // If we found headers, process them separately
  if (headerMatches.length > 0) {
    let lastIndex = 0;
    for (const header of headerMatches.sort((a, b) => a.index - b.index)) {
      // Add content before header as paragraphs
      if (header.index > lastIndex) {
        const beforeContent = normalizedHtml.substring(lastIndex, header.index).trim();
        if (beforeContent && !beforeContent.match(/^<h[1-4]>/)) {
          const tempParagraphs = parseHtmlParagraphsOnly(beforeContent);
          paragraphs.push(...tempParagraphs);
        }
      }
      
      // Add header paragraph
      const headerTextRuns = parseInlineFormatting(header.text);
      paragraphs.push(
        new Paragraph({
          children: headerTextRuns,
          heading: header.level === 1 ? HeadingLevel.HEADING_1 : 
                   header.level === 2 ? HeadingLevel.HEADING_2 :
                   header.level === 3 ? HeadingLevel.HEADING_3 :
                   HeadingLevel.HEADING_4,
          spacing: {
            before: header.level === 1 ? 360 : header.level === 2 ? 240 : 180,
            after: header.level === 1 ? 80 : 180,
          },
        })
      );
      
      lastIndex = header.index + header.match.length;
    }
    
    // Add remaining content after last header
    if (lastIndex < normalizedHtml.length) {
      const remainingContent = normalizedHtml.substring(lastIndex).trim();
      if (remainingContent && !remainingContent.match(/^<h[1-4]>/)) {
        const tempParagraphs = parseHtmlParagraphsOnly(remainingContent);
        paragraphs.push(...tempParagraphs);
      }
    }
    
    return paragraphs;
  }
  
  // If no paragraph tags, split by line breaks to create paragraphs
  if (!normalizedHtml.includes('<p>') && !normalizedHtml.includes('</p>')) {
    // Remove HTML tags but preserve text
    const plainText = normalizedHtml.replace(/<[^>]+>/g, '');
    
    // Split by double line breaks (paragraph breaks) or single line breaks
    // First try double line breaks, then fall back to single line breaks
    let lines: string[] = [];
    if (plainText.includes('\n\n')) {
      lines = plainText.split(/\n\n+/);
    } else if (plainText.includes('\n')) {
      lines = plainText.split(/\n/);
    } else {
      // No line breaks, treat as single paragraph
      lines = [plainText];
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for scene breaks
      if (line === '* * *' || line === '***') {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 180, after: 180 },
            children: [],
          })
        );
        paragraphs.push(
          new Paragraph({
            spacing: { before: 180, after: 180 },
            children: [createTextRun({ text: '* * *' })],
          })
        );
        paragraphs.push(
          new Paragraph({
            spacing: { before: 180, after: 180 },
            children: [],
          })
        );
        continue;
      }
      
      if (!line) {
        // Empty line = empty paragraph for spacing
        paragraphs.push(
          new Paragraph({
            spacing: { before: 180, after: 180 },
            children: [],
          })
        );
        continue;
      }
      
      // Parse inline formatting and create paragraph
      const textRuns = parseInlineFormatting(line);
      if (textRuns.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: textRuns,
            spacing: {
              before: 180,
              after: 180,
            },
          })
        );
      }
    }
    
    return paragraphs;
  }
  
  // Extract paragraphs using regex to preserve structure
  // Match both <p>...</p> and handle any remaining content
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  let paragraphIndex = 0;
  let lastIndex = 0;
  
  while ((match = paragraphRegex.exec(normalizedHtml)) !== null) {
    // Handle any text between paragraphs
    if (match.index > lastIndex) {
      const betweenText = normalizedHtml.substring(lastIndex, match.index).trim();
      if (betweenText) {
        // Split by line breaks and create paragraphs
        const lines = betweenText.split(/\n\n+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            const textRuns = parseInlineFormatting(trimmed);
            if (textRuns.length > 0) {
              paragraphs.push(
                new Paragraph({
                  children: textRuns,
                  spacing: { before: 180, after: 180 },
                })
              );
            }
          }
        }
      }
    }
    const paragraphContent = match[1];
    
    // Check for scene breaks (* * *)
    const trimmedContent = paragraphContent.trim();
    if (trimmedContent === '* * *' || trimmedContent === '***') {
      // Add empty paragraph before scene break
      paragraphs.push(
        new Paragraph({
          spacing: {
            before: 180,
            after: 180,
          },
          children: [],
        })
      );
          // Scene break paragraph
          paragraphs.push(
            new Paragraph({
              spacing: {
                before: 180,
                after: 180,
              },
              children: [createTextRun({ text: '* * *' })],
            })
          );
          // Add empty paragraph after scene break
          paragraphs.push(
            new Paragraph({
              spacing: {
                before: 180,
                after: 180,
              },
              children: [],
            })
          );
      continue;
    }
    
    if (!trimmedContent) {
      // Empty paragraph for spacing
      paragraphs.push(
        new Paragraph({
          spacing: {
            before: 180,
            after: 180,
          },
          children: [],
        })
      );
      continue;
    }
    
    // Parse the paragraph content with inline formatting
    // Don't split on <br> - keep it as one paragraph
    const textRuns = parseInlineFormatting(paragraphContent);
    
    // Always create a paragraph, even if empty (for spacing)
    if (textRuns.length > 0) {
      // Use same spacing for all paragraphs (BodyText style)
      paragraphs.push(
        new Paragraph({
          children: textRuns,
          spacing: {
            before: 180, // 9pt matching BodyText style
            after: 180, // 9pt matching BodyText style
          },
        })
      );
    } else {
      // Empty paragraph for spacing
      paragraphs.push(
        new Paragraph({
          spacing: {
            before: 180,
            after: 180,
          },
          children: [],
        })
      );
    }
    
    paragraphIndex++;
    lastIndex = match.index + match[0].length;
  }
  
  // Handle any remaining content after last paragraph tag
  if (lastIndex < normalizedHtml.length) {
    const remainingText = normalizedHtml.substring(lastIndex).trim();
    if (remainingText) {
      const lines = remainingText.split(/\n\n+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const textRuns = parseInlineFormatting(trimmed);
          if (textRuns.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: textRuns,
                spacing: { before: 180, after: 180 },
              })
            );
          }
        }
      }
    }
  }
  
  // If no paragraphs were found, try parsing the whole thing
  if (paragraphs.length === 0) {
    const textRuns = parseInlineFormatting(normalizedHtml);
    if (textRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: textRuns,
          spacing: {
            before: 180,
            after: 180,
          },
        })
      );
    }
  }
  
  return paragraphs;
}

/**
 * Parse inline HTML formatting (bold, italic) into TextRun objects
 * Handles nested tags by tracking formatting state
 */
function parseInlineFormatting(html: string): TextRun[] {
  if (!html || !html.trim()) {
    return [];
  }
  
  // First, decode HTML entities
  const decodedHtml = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  
  const textRuns: TextRun[] = [];
  const segments: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  
  // Track formatting state
  let bold = false;
  let italic = false;
  let currentText = '';
  let i = 0;
  
  while (i < decodedHtml.length) {
    // Check for opening tag
    if (decodedHtml[i] === '<' && decodedHtml[i + 1] !== '/') {
      // Save current text segment
      if (currentText) {
        segments.push({ text: currentText, bold, italic });
        currentText = '';
      }
      
      // Find tag end
      const tagEnd = decodedHtml.indexOf('>', i);
      if (tagEnd === -1) break;
      
      const tagContent = decodedHtml.substring(i + 1, tagEnd);
      const tagMatch = tagContent.match(/^(\w+)/);
      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        if (tagName === 'strong' || tagName === 'b') {
          bold = true;
        } else if (tagName === 'em' || tagName === 'i') {
          italic = true;
        }
      }
      
      i = tagEnd + 1;
      continue;
    }
    
    // Check for closing tag
    if (decodedHtml[i] === '<' && decodedHtml[i + 1] === '/') {
      // Save current text segment before closing tag
      if (currentText) {
        segments.push({ text: currentText, bold, italic });
        currentText = '';
      }
      
      const tagEnd = decodedHtml.indexOf('>', i);
      if (tagEnd === -1) break;
      
      const tagContent = decodedHtml.substring(i + 2, tagEnd);
      const tagMatch = tagContent.match(/^(\w+)/);
      if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        if (tagName === 'strong' || tagName === 'b') {
          bold = false;
        } else if (tagName === 'em' || tagName === 'i') {
          italic = false;
        }
      }
      
      i = tagEnd + 1;
      continue;
    }
    
    // Regular character
    currentText += decodedHtml[i];
    i++;
  }
  
  // Add any remaining text
  if (currentText) {
    segments.push({ text: currentText, bold, italic });
  }
  
  // Merge adjacent segments with same formatting, then build TextRuns
  const merged: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  for (const segment of segments) {
    if (merged.length === 0) {
      merged.push({ ...segment });
    } else {
      const last = merged[merged.length - 1];
      if (last.bold === segment.bold && last.italic === segment.italic) {
        last.text += segment.text;
      } else {
        merged.push({ ...segment });
      }
    }
  }
  for (const seg of merged) {
    textRuns.push(
      createTextRun({
        text: seg.text,
        bold: seg.bold,
        italics: seg.italic,
      })
    );
  }
  
  // If no formatting was found, return plain text
  if (textRuns.length === 0) {
    const plainText = decodedHtml.replace(/<[^>]+>/g, '').trim();
    if (plainText) {
      textRuns.push(createTextRun({ text: plainText }));
    }
  }
  
  return textRuns;
}

/**
 * Parse ProseMirror JSON structure directly to Paragraph objects
 */
function parseProseMirrorToParagraphs(node: any, isFirstParagraph: boolean = false): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  if (!node || typeof node !== 'object') {
    return paragraphs;
  }
  
  if (node.type === 'doc' && node.content && Array.isArray(node.content)) {
    let paragraphIndex = 0;
    for (const child of node.content) {
      if (child.type === 'paragraph') {
        const textRuns = parseProseMirrorNodeToTextRuns(child);
        if (textRuns.length > 0) {
          // Check for scene breaks (get plain text from node to avoid depending on TextRun API)
          const text = getTextFromProseMirrorNode(child);
          if (text.trim() === '* * *' || text.trim() === '***') {
            paragraphs.push(
              new Paragraph({
                spacing: {
                  before: 180,
                  after: 180,
                },
                children: [],
              })
            );
            paragraphs.push(
              new Paragraph({
                spacing: {
                  before: 180,
                  after: 180,
                },
                children: [createTextRun({ text: '* * *' })],
              })
            );
            paragraphs.push(
              new Paragraph({
                spacing: {
                  before: 180,
                  after: 180,
                },
                children: [],
              })
            );
          } else {
            // Use BodyText spacing for all paragraphs
            paragraphs.push(
              new Paragraph({
                children: textRuns,
                spacing: {
                  before: 180, // 9pt matching BodyText style
                  after: 180, // 9pt matching BodyText style
                },
              })
            );
          }
        } else {
          // Empty paragraph for spacing
          paragraphs.push(
            new Paragraph({
              spacing: {
                before: 180,
                after: 180,
              },
              children: [],
            })
          );
        }
        paragraphIndex++;
      } else if (child.type === 'heading') {
        const textRuns = parseProseMirrorNodeToTextRuns(child);
        const level = child.attrs?.level || 1;
        paragraphs.push(
          new Paragraph({
            children: textRuns,
            heading: level === 1 ? HeadingLevel.HEADING_1 : undefined,
            spacing: {
              before: level === 1 ? 360 : 180,
              after: level === 1 ? 80 : 180,
            },
          })
        );
      } else if (child.content && Array.isArray(child.content)) {
        // Recursively process nested content
        const nestedParagraphs = parseProseMirrorToParagraphs({ content: child.content }, false);
        paragraphs.push(...nestedParagraphs);
      }
    }
  }
  
  return paragraphs;
}

/**
 * Get plain text from a ProseMirror node (for scene-break checks etc.)
 */
function getTextFromProseMirrorNode(node: any): string {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map((c: any) => getTextFromProseMirrorNode(c)).join('');
  }
  return '';
}

/**
 * Parse a ProseMirror node into TextRun objects with formatting
 */
function parseProseMirrorNodeToTextRuns(node: any): TextRun[] {
  const textRuns: TextRun[] = [];
  
  if (!node || typeof node !== 'object') {
    return textRuns;
  }
  
  if (node.type === 'text') {
    const text = node.text || '';
    const marks = node.marks || [];
    
    let bold = false;
    let italic = false;
    
    for (const mark of marks) {
      if (mark.type === 'bold' || mark.type === 'strong') {
        bold = true;
      }
      if (mark.type === 'italic' || mark.type === 'em') {
        italic = true;
      }
    }
    
    if (text) {
      textRuns.push(
        createTextRun({
          text,
          bold,
          italics: italic,
        })
      );
    }
  } else if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      const childRuns = parseProseMirrorNodeToTextRuns(child);
      textRuns.push(...childRuns);
    }
  }
  
  return textRuns;
}

/**
 * Legacy function for backward compatibility
 */
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
