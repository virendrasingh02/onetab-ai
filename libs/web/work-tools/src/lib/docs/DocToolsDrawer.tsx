import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  List,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { DocItem } from './doc-types.js';

interface DocToolsDrawerProps {
  doc: DocItem;
  /** The author is the signed-in user, resolved by the caller. */
  onAddComment: (text: string) => void;
}

export function DocToolsDrawer({ doc, onAddComment }: DocToolsDrawerProps) {
  const [commentInput, setCommentInput] = useState('');
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null);

  // Extract Heading Outline
  const headingBlocks = doc.blocks
    ? doc.blocks.filter((b) => ['h1', 'h2', 'h3'].includes(b.type))
    : [];

  const handlePostComment = () => {
    if (!commentInput.trim()) return;
    onAddComment(commentInput.trim());
    setCommentInput('');
  };

  const generateExportContent = (format: 'markdown' | 'html' | 'json') => {
    if (format === 'json') {
      return JSON.stringify(doc, null, 2);
    }
    if (format === 'html') {
      let htmlStr = `<!DOCTYPE html>\n<html>\n<head><title>${doc.title}</title></head>\n<body style="font-family:sans-serif;padding:2rem;">\n`;
      htmlStr += `<h1>${doc.title}</h1>\n`;
      doc.blocks.forEach((b) => {
        if (b.type === 'h1') htmlStr += `<h1>${b.content}</h1>\n`;
        else if (b.type === 'h2') htmlStr += `<h2>${b.content}</h2>\n`;
        else if (b.type === 'h3') htmlStr += `<h3>${b.content}</h3>\n`;
        else if (b.type === 'checklist')
          htmlStr += `<div><input type="checkbox" ${b.checked ? 'checked' : ''}/> ${b.content}</div>\n`;
        else if (b.type === 'callout')
          htmlStr += `<blockquote style="background:#f0f4f8;padding:1rem;">${b.icon || ''} ${b.content}</blockquote>\n`;
        else if (b.type === 'code')
          htmlStr += `<pre style="background:#1e293b;color:#fff;padding:1rem;"><code>${b.content}</code></pre>\n`;
        else htmlStr += `<p>${b.content}</p>\n`;
      });
      htmlStr += `</body>\n</html>`;
      return htmlStr;
    }

    // Markdown default
    let mdStr = `# ${doc.title}\n\n`;
    doc.blocks.forEach((b) => {
      if (b.type === 'h1') mdStr += `# ${b.content}\n\n`;
      else if (b.type === 'h2') mdStr += `## ${b.content}\n\n`;
      else if (b.type === 'h3') mdStr += `### ${b.content}\n\n`;
      else if (b.type === 'checklist')
        mdStr += `- [${b.checked ? 'x' : ' '}] ${b.content}\n`;
      else if (b.type === 'bullet_list') mdStr += `- ${b.content}\n`;
      else if (b.type === 'numbered_list') mdStr += `1. ${b.content}\n`;
      else if (b.type === 'callout') mdStr += `> ${b.icon || '💡'} ${b.content}\n\n`;
      else if (b.type === 'code')
        mdStr += `\`\`\`${b.language || 'typescript'}\n${b.content}\n\`\`\`\n\n`;
      else if (b.type === 'quote') mdStr += `> ${b.content}\n\n`;
      else if (b.type === 'table') {
        if (b.headers) mdStr += `| ${b.headers.join(' | ')} |\n| ${b.headers.map(() => '---').join(' | ')} |\n`;
        if (b.rows) {
          b.rows.forEach((r) => {
            mdStr += `| ${r.join(' | ')} |\n`;
          });
        }
        mdStr += `\n`;
      } else mdStr += `${b.content}\n\n`;
    });
    return mdStr;
  };

  const handleDownload = (format: 'markdown' | 'html' | 'json') => {
    const content = generateExportContent(format);
    const ext = format === 'markdown' ? 'md' : format;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadedFormat(format);
    setTimeout(() => setDownloadedFormat(null), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Export Modal */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Download className="size-3.5" />
            <span>Export</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-4 text-accent-blue" />
              Export Document
            </DialogTitle>
            <DialogDescription>
              Download your Notion page into Markdown, HTML, or raw JSON format.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-3">
            <button
              type="button"
              onClick={() => handleDownload('markdown')}
              className="p-3 rounded-lg border border-border bg-surface-raised hover:border-accent-blue hover:bg-accent/40 text-center transition-all flex flex-col items-center gap-2 cursor-pointer"
            >
              <FileText className="size-6 text-accent-blue" />
              <span className="text-xs font-bold text-foreground">
                {downloadedFormat === 'markdown' ? 'Downloaded!' : 'Markdown (.md)'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('html')}
              className="p-3 rounded-lg border border-border bg-surface-raised hover:border-accent-green/30 hover:bg-accent/40 text-center transition-all flex flex-col items-center gap-2 cursor-pointer"
            >
              <FileCode className="size-6 text-accent-green" />
              <span className="text-xs font-bold text-foreground">
                {downloadedFormat === 'html' ? 'Downloaded!' : 'HTML (.html)'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('json')}
              className="p-3 rounded-lg border border-border bg-surface-raised hover:border-accent-violet/30 hover:bg-accent/40 text-center transition-all flex flex-col items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="size-6 text-accent-violet" />
              <span className="text-xs font-bold text-foreground">
                {downloadedFormat === 'json' ? 'Downloaded!' : 'JSON (.json)'}
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tools Drawer Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
            <List className="size-3.5" />
            <span>Outline & Comments</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-80 sm:w-96 p-4">
          <SheetHeader className="pb-3 border-b border-border">
            <SheetTitle className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-accent-blue" />
              Page Tools & Discussions
            </SheetTitle>
            <SheetDescription className="text-xs">
              Table of contents outline and discussion comments.
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="outline" className="mt-4 flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 w-full h-8">
              <TabsTrigger value="outline" className="text-xs">
                Outline ({headingBlocks.length})
              </TabsTrigger>
              <TabsTrigger value="comments" className="text-xs">
                Comments ({doc.comments ? doc.comments.length : 0})
              </TabsTrigger>
            </TabsList>

            {/* Document Table of Contents Outline */}
            <TabsContent value="outline" className="py-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase text-subtle">
                Page Headings Outline
              </p>
              {headingBlocks.length === 0 ? (
                <p className="text-xs text-subtle italic">No heading blocks in this page yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {headingBlocks.map((hb) => (
                    <li
                      key={hb.id}
                      className={cn(
                        'text-xs rounded-md p-1.5 hover:bg-accent cursor-pointer transition-colors text-foreground line-clamp-1',
                        hb.type === 'h1' && 'font-bold pl-2 text-foreground',
                        hb.type === 'h2' && 'font-semibold pl-4 text-muted-foreground',
                        hb.type === 'h3' && 'font-medium pl-6 text-subtle',
                      )}
                    >
                      • {hb.content || 'Untitled Section'}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* Discussion & Comments */}
            <TabsContent value="comments" className="py-3 flex-1 flex flex-col justify-between">
              <ScrollArea className="max-h-96" contentClassName="space-y-3 pr-1">
                {doc.comments && doc.comments.length > 0 ? (
                  doc.comments.map((cm) => (
                    <div
                      key={cm.id}
                      className="p-2.5 rounded-lg border border-border bg-surface-raised space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="size-5">
                            {cm.avatar && <AvatarImage src={cm.avatar} />}
                            <AvatarFallback className="text-[9px]">
                              {cm.author.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-foreground">
                            {cm.author}
                          </span>
                        </div>
                        <span className="text-[10px] text-subtle">{cm.createdAt}</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">{cm.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-subtle italic">No comments yet. Start a discussion!</p>
                )}
              </ScrollArea>

              <div className="pt-3 border-t border-border mt-3 space-y-2">
                <Input
                  placeholder="Write a comment..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePostComment();
                  }}
                  className="text-xs h-8"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePostComment}
                  className="w-full text-xs h-7 gap-1"
                >
                  <Send className="size-3" />
                  <span>Post Comment</span>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
