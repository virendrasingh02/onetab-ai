import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  CheckSquare,
  ChevronRight,
  Code,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListOrdered,
  Plus,
  Quote,
  Sparkles,
  Table as TableIcon,
  Type,
} from 'lucide-react';
import React, { useState } from 'react';
import type { BlockType, NotionBlock } from './docs-hook.js';

interface NotionBlockEditorProps {
  blocks: NotionBlock[];
  onUpdateBlocks: (blocks: NotionBlock[]) => void;
}

const BLOCK_TYPES_CONFIG: {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'paragraph',
    label: 'Text',
    description: 'Plain text paragraph block',
    icon: <Type className="size-4 text-muted-foreground" />,
  },
  {
    type: 'h1',
    label: 'Heading 1',
    description: 'Large section header',
    icon: <Heading1 className="size-4 text-accent-blue" />,
  },
  {
    type: 'h2',
    label: 'Heading 2',
    description: 'Medium section header',
    icon: <Heading2 className="size-4 text-purple-400" />,
  },
  {
    type: 'h3',
    label: 'Heading 3',
    description: 'Small section header',
    icon: <Heading3 className="size-4 text-emerald-400" />,
  },
  {
    type: 'checklist',
    label: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: <CheckSquare className="size-4 text-emerald-400" />,
  },
  {
    type: 'bullet_list',
    label: 'Bulleted list',
    description: 'Simple bullet point list',
    icon: <List className="size-4 text-amber-400" />,
  },
  {
    type: 'numbered_list',
    label: 'Numbered list',
    description: 'Numbered ordered list',
    icon: <ListOrdered className="size-4 text-blue-400" />,
  },
  {
    type: 'toggle',
    label: 'Toggle block',
    description: 'Expandable details content',
    icon: <ChevronRight className="size-4 text-sky-400" />,
  },
  {
    type: 'callout',
    label: 'Callout box',
    description: 'Highlighted note box with icon',
    icon: <Info className="size-4 text-indigo-400" />,
  },
  {
    type: 'code',
    label: 'Code snippet',
    description: 'Formatted code block with syntax copy',
    icon: <Code className="size-4 text-teal-400" />,
  },
  {
    type: 'quote',
    label: 'Quote',
    description: 'Styled quotation block',
    icon: <Quote className="size-4 text-pink-400" />,
  },
  {
    type: 'table',
    label: 'Database Table',
    description: 'Editable grid table with rows & columns',
    icon: <TableIcon className="size-4 text-amber-400" />,
  },
  {
    type: 'ai_prompt',
    label: 'AI Copilot Block',
    description: 'Generate, summarize, or rewrite text with AI',
    icon: <Sparkles className="size-4 text-violet-400" />,
  },
];

export function NotionBlockEditor({ blocks, onUpdateBlocks }: NotionBlockEditorProps) {
  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);
  const [slashSearch, setSlashSearch] = useState('');
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  const handleBlockChange = (id: string, updatedFields: Partial<NotionBlock>) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, ...updatedFields } : b));
    onUpdateBlocks(updated);
  };

  const handleAddBlock = (index: number, type: BlockType = 'paragraph') => {
    const newBlock: NotionBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      content: '',
      checked: false,
      isOpen: true,
      variant: 'info',
      icon: '💡',
      language: 'typescript',
      headers: ['Header 1', 'Header 2', 'Header 3'],
      rows: [
        ['Row 1 Cell 1', 'Row 1 Cell 2', 'Row 1 Cell 3'],
        ['Row 2 Cell 1', 'Row 2 Cell 2', 'Row 2 Cell 3'],
      ],
    };

    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onUpdateBlocks(newBlocks);
    setSlashMenuIndex(null);
    setSlashSearch('');
  };

  const handleDeleteBlock = (id: string) => {
    if (blocks.length <= 1) return;
    const filtered = blocks.filter((b) => b.id !== id);
    onUpdateBlocks(filtered);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onUpdateBlocks(updated);
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlockId(id);
    setTimeout(() => setCopiedBlockId(null), 2000);
  };

  // AI Assistant Action Handlers
  const handleAiAction = (id: string, actionType: 'summarize' | 'expand' | 'formal' | 'action_items') => {
    const targetBlock = blocks.find((b) => b.id === id);
    if (!targetBlock) return;

    let aiResult = '';
    if (actionType === 'summarize') {
      aiResult = '✨ AI Summary: High priority workspace architectural guidelines standardizing HSL design tokens, decoupled monorepo packages, and Notion-like interactive document blocks.';
    } else if (actionType === 'expand') {
      aiResult = targetBlock.content + ' Furthermore, all components integrate seamless keyboard navigation, accessible ARIA announcements, and instant offline client persistence.';
    } else if (actionType === 'formal') {
      aiResult = 'Professional Revision: ' + targetBlock.content.replace(/good|cool|nice/g, 'exceptional');
    } else if (actionType === 'action_items') {
      aiResult = '📋 Action Items Extracted:\n• Complete Notion block type suite\n• Connect HSL color tokens\n• Verify test coverage across monorepo';
    }

    handleBlockChange(id, { content: aiResult });
  };

  const filteredBlockTypes = BLOCK_TYPES_CONFIG.filter(
    (b) =>
      b.label.toLowerCase().includes(slashSearch.toLowerCase()) ||
      b.description.toLowerCase().includes(slashSearch.toLowerCase()),
  );

  return (
    <div className="w-full space-y-3 py-2">
      {blocks.map((block, index) => {
        return (
          <div
            key={block.id}
            className="group relative flex items-start gap-2 rounded-lg p-1.5 hover:bg-accent/20 transition-colors"
          >
            {/* Notion Drag & Action Handle Controls */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 pt-1.5 shrink-0 select-none">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded text-subtle hover:text-foreground hover:bg-accent cursor-pointer"
                    title="Block options"
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem
                    onClick={() => handleMoveBlock(index, 'up')}
                    disabled={index === 0}
                    className="text-xs"
                  >
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMoveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                    className="text-xs"
                  >
                    Move down
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteBlock(block.id)}
                    className="text-xs text-destructive focus:text-destructive"
                  >
                    Delete block
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Slash Command Trigger Popover */}
              <Popover
                open={slashMenuIndex === index}
                onOpenChange={(open) => {
                  if (!open) setSlashMenuIndex(null);
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSlashMenuIndex(index)}
                    className="p-1 rounded text-subtle hover:text-accent-blue hover:bg-accent cursor-pointer"
                    title="Insert block below"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2 max-h-80 overflow-y-auto">
                  <div className="px-2 py-1.5 mb-1 border-b border-border">
                    <Input
                      placeholder="Type / or search block..."
                      value={slashSearch}
                      onChange={(e) => setSlashSearch(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-0.5">
                    {filteredBlockTypes.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleAddBlock(index, item.type)}
                        className="w-full flex items-start gap-2.5 p-2 rounded-md hover:bg-accent text-left transition-colors cursor-pointer"
                      >
                        <div className="mt-0.5 p-1 rounded bg-surface-raised border border-border">
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-subtle line-clamp-1">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Block Body Rendering */}
            <div className="flex-1 min-w-0">
              {/* Heading 1 */}
              {block.type === 'h1' && (
                <Textarea
                  value={block.content}
                  onChange={(e) => {
                    if (e.target.value.includes('/')) setSlashMenuIndex(index);
                    handleBlockChange(block.id, { content: e.target.value.replace('/', '') });
                  }}
                  placeholder="Heading 1..."
                  rows={1}
                  className="text-2xl font-extrabold tracking-tight text-foreground bg-transparent border-none focus-visible:ring-0 p-0 shadow-none resize-none overflow-hidden h-auto min-h-9"
                />
              )}

              {/* Heading 2 */}
              {block.type === 'h2' && (
                <Textarea
                  value={block.content}
                  onChange={(e) => {
                    if (e.target.value.includes('/')) setSlashMenuIndex(index);
                    handleBlockChange(block.id, { content: e.target.value.replace('/', '') });
                  }}
                  placeholder="Heading 2..."
                  rows={1}
                  className="text-xl font-bold tracking-tight text-foreground bg-transparent border-none focus-visible:ring-0 p-0 shadow-none resize-none overflow-hidden h-auto min-h-8"
                />
              )}

              {/* Heading 3 */}
              {block.type === 'h3' && (
                <Textarea
                  value={block.content}
                  onChange={(e) => {
                    if (e.target.value.includes('/')) setSlashMenuIndex(index);
                    handleBlockChange(block.id, { content: e.target.value.replace('/', '') });
                  }}
                  placeholder="Heading 3..."
                  rows={1}
                  className="text-lg font-semibold text-foreground bg-transparent border-none focus-visible:ring-0 p-0 shadow-none resize-none overflow-hidden h-auto min-h-7"
                />
              )}

              {/* Text Paragraph */}
              {block.type === 'paragraph' && (
                <Textarea
                  value={block.content}
                  onChange={(e) => {
                    if (e.target.value.includes('/')) setSlashMenuIndex(index);
                    handleBlockChange(block.id, { content: e.target.value.replace('/', '') });
                  }}
                  placeholder="Type '/' for commands..."
                  rows={1}
                  className="text-sm leading-relaxed text-foreground bg-transparent border-none focus-visible:ring-0 p-0 shadow-none resize-none overflow-hidden h-auto min-h-6"
                />
              )}

              {/* Checklist / Todo */}
              {block.type === 'checklist' && (
                <div className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={block.checked || false}
                    onChange={(e) =>
                      handleBlockChange(block.id, { checked: e.target.checked })
                    }
                    className="size-4 rounded border-border text-accent-blue focus:ring-accent-blue cursor-pointer"
                  />
                  <Input
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                    placeholder="Task item..."
                    className={cn(
                      'text-sm bg-transparent border-none shadow-none h-7 p-0 text-foreground focus-visible:ring-0',
                      block.checked && 'line-through text-muted-foreground opacity-70',
                    )}
                  />
                </div>
              )}

              {/* Bulleted List */}
              {block.type === 'bullet_list' && (
                <div className="flex items-start gap-2">
                  <span className="size-2 rounded-full bg-accent-blue mt-2 shrink-0" />
                  <Input
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                    placeholder="List item..."
                    className="text-sm bg-transparent border-none shadow-none h-7 p-0 text-foreground focus-visible:ring-0"
                  />
                </div>
              )}

              {/* Numbered List */}
              {block.type === 'numbered_list' && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-accent-blue mt-1 shrink-0">
                    {index + 1}.
                  </span>
                  <Input
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                    placeholder="Ordered list item..."
                    className="text-sm bg-transparent border-none shadow-none h-7 p-0 text-foreground focus-visible:ring-0"
                  />
                </div>
              )}

              {/* Toggle Block */}
              {block.type === 'toggle' && (
                <div className="rounded-lg border border-border bg-surface-raised/40 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBlockChange(block.id, { isOpen: !block.isOpen })}
                      className="p-1 rounded hover:bg-accent text-muted-foreground transition-transform"
                    >
                      <ChevronRight
                        className={cn('size-4 transition-transform', block.isOpen && 'rotate-90')}
                      />
                    </button>
                    <Input
                      value={block.content}
                      onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                      placeholder="Toggle section title..."
                      className="font-semibold text-sm bg-transparent border-none shadow-none p-0 h-6 text-foreground focus-visible:ring-0"
                    />
                  </div>
                  {block.isOpen ? (
                    <div className="pl-6 pt-1">
                      <Textarea
                        value={block.aiPrompt || ''}
                        onChange={(e) => handleBlockChange(block.id, { aiPrompt: e.target.value })}
                        placeholder="Expanded toggle details content..."
                        className="text-xs text-muted-foreground bg-surface p-2 rounded-md border border-border/80"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* Callout Box */}
              {block.type === 'callout' && (
                <div
                  className={cn(
                    'p-3 rounded-lg border flex items-start gap-3 transition-colors',
                    block.variant === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : block.variant === 'tip'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-accent-blue/10 border-accent-blue/30 text-foreground',
                  )}
                >
                  <span className="text-xl select-none">{block.icon || '💡'}</span>
                  <div className="flex-1 min-w-0">
                    <Textarea
                      value={block.content}
                      onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                      placeholder="Callout information message..."
                      rows={2}
                      className="text-xs leading-relaxed bg-transparent border-none shadow-none p-0 focus-visible:ring-0 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Code Snippet */}
              {block.type === 'code' && (
                <div className="rounded-lg border border-border bg-slate-950 p-3 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <Badge variant="outline" className="text-[10px] uppercase text-cyan-400 border-cyan-800">
                      {block.language || 'typescript'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyCode(block.id, block.content)}
                      className="h-6 text-[11px] text-slate-400 hover:text-slate-100 gap-1 px-2"
                    >
                      {copiedBlockId === block.id ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                    placeholder="// Write code snippet here..."
                    rows={3}
                    className="font-mono text-xs bg-transparent border-none text-cyan-200 focus-visible:ring-0 p-0 shadow-none resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* Quote Block */}
              {block.type === 'quote' && (
                <div className="border-l-4 border-accent-blue pl-4 py-1 italic text-muted-foreground bg-surface-raised/40 rounded-r-md">
                  <Textarea
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                    placeholder="Quote text..."
                    rows={1}
                    className="text-sm bg-transparent border-none p-0 focus-visible:ring-0 shadow-none resize-none italic"
                  />
                </div>
              )}

              {/* Interactive Database Table Block */}
              {block.type === 'table' && (
                <div className="rounded-lg border border-border bg-surface p-3 space-y-3 overflow-x-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <TableIcon className="size-3.5 text-accent-blue" />
                      Notion Database Grid
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newRows = [...(block.rows || [])];
                        const colCount = block.headers ? block.headers.length : 3;
                        newRows.push(Array(colCount).fill('New Value'));
                        handleBlockChange(block.id, { rows: newRows });
                      }}
                      className="h-6 text-[11px] gap-1"
                    >
                      <Plus className="size-3" />
                      <span>Add Row</span>
                    </Button>
                  </div>

                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-raised">
                        {(block.headers || ['Col 1', 'Col 2', 'Col 3']).map((h, colIdx) => (
                          <th key={colIdx} className="p-2 text-left font-semibold text-foreground">
                            <Input
                              value={h}
                              onChange={(e) => {
                                const newHeaders = [...(block.headers || [])];
                                newHeaders[colIdx] = e.target.value;
                                handleBlockChange(block.id, { headers: newHeaders });
                              }}
                              className="h-6 text-xs bg-transparent border-none font-bold p-0 shadow-none focus-visible:ring-0"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(block.rows || []).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-border/50 hover:bg-accent/30">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-2">
                              <Input
                                value={cell}
                                onChange={(e) => {
                                  const newRows = [...(block.rows || [])];
                                  newRows[rowIdx][cellIdx] = e.target.value;
                                  handleBlockChange(block.id, { rows: newRows });
                                }}
                                className="h-6 text-xs bg-transparent border-none p-0 shadow-none focus-visible:ring-0 text-muted-foreground hover:text-foreground"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Writer & Copilot Assistant Block */}
              {block.type === 'ai_prompt' && (
                <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-950/30 to-indigo-950/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-violet-400" />
                      AI Copilot Assistant
                    </span>
                    <Badge variant="outline" className="text-[10px] border-violet-700 text-violet-300">
                      GPT-4o Ready
                    </Badge>
                  </div>
                  <Textarea
                    value={block.content}
                    onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                    placeholder="AI generated content or prompt result..."
                    rows={2}
                    className="text-xs text-foreground bg-surface/60 p-2 rounded-lg border border-violet-500/20"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'summarize')}
                      className="h-6 text-[10px] text-violet-300 hover:bg-violet-900/40"
                    >
                      Summarize Doc
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'expand')}
                      className="h-6 text-[10px] text-violet-300 hover:bg-violet-900/40"
                    >
                      Expand Content
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'formal')}
                      className="h-6 text-[10px] text-violet-300 hover:bg-violet-900/40"
                    >
                      Make Professional
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'action_items')}
                      className="h-6 text-[10px] text-violet-300 hover:bg-violet-900/40"
                    >
                      Extract Action Items
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Block Bottom Action Trigger */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAddBlock(blocks.length - 1, 'paragraph')}
          className="w-full text-xs text-subtle hover:text-foreground justify-start gap-2 border border-dashed border-border/60 rounded-lg h-9"
        >
          <Plus className="size-3.5" />
          <span>Click to add block or type '/'...</span>
        </Button>
      </div>
    </div>
  );
}
