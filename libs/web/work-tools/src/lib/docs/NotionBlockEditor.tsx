import {
  Badge,
  Button,
  CodeBlock,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Textarea,
  toast,
} from '@org/ui';
import { cn, generateId } from '@org/utils';
import {
  CheckSquare,
  ChevronRight,
  Code,
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
import { aiApi } from '@org/api-client';
import React, { useState } from 'react';
import type { BlockType, NotionBlock } from './doc-types.js';

interface NotionBlockEditorProps {
  blocks: NotionBlock[];
  onUpdateBlocks: (blocks: NotionBlock[]) => void;
  /** Needed for the AI actions; without it they report that no workspace is open. */
  workspaceId?: string;
}

const AI_ACTION_PROMPTS = {
  summarize:
    "Summarize the user's text in one or two concise sentences. Reply with the summary only.",
  expand:
    "Expand the user's text with relevant detail, keeping its meaning and tone. Reply with the expanded text only.",
  formal:
    "Rewrite the user's text in a professional tone without changing its meaning. Reply with the rewritten text only.",
  action_items:
    "Extract the action items from the user's text as a short list, one per line, each starting with '• '. If there are none, reply 'No action items found.'",
} as const;

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
    icon: <Heading2 className="size-4 text-accent-violet" />,
  },
  {
    type: 'h3',
    label: 'Heading 3',
    description: 'Small section header',
    icon: <Heading3 className="size-4 text-accent-green" />,
  },
  {
    type: 'checklist',
    label: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: <CheckSquare className="size-4 text-accent-green" />,
  },
  {
    type: 'bullet_list',
    label: 'Bulleted list',
    description: 'Simple bullet point list',
    icon: <List className="size-4 text-accent-amber" />,
  },
  {
    type: 'numbered_list',
    label: 'Numbered list',
    description: 'Numbered ordered list',
    icon: <ListOrdered className="size-4 text-accent-blue" />,
  },
  {
    type: 'toggle',
    label: 'Toggle block',
    description: 'Expandable details content',
    icon: <ChevronRight className="size-4 text-accent-cyan" />,
  },
  {
    type: 'callout',
    label: 'Callout box',
    description: 'Highlighted note box with icon',
    icon: <Info className="size-4 text-accent-indigo" />,
  },
  {
    type: 'code',
    label: 'Code snippet',
    description: 'Formatted code block with syntax copy',
    icon: <Code className="size-4 text-accent-teal" />,
  },
  {
    type: 'quote',
    label: 'Quote',
    description: 'Styled quotation block',
    icon: <Quote className="size-4 text-accent-pink" />,
  },
  {
    type: 'table',
    label: 'Database Table',
    description: 'Editable grid table with rows & columns',
    icon: <TableIcon className="size-4 text-accent-amber" />,
  },
  {
    type: 'ai_prompt',
    label: 'AI Copilot Block',
    description: 'Generate, summarize, or rewrite text with AI',
    icon: <Sparkles className="size-4 text-accent-violet" />,
  },
];

export function NotionBlockEditor({
  blocks,
  onUpdateBlocks,
  workspaceId,
}: NotionBlockEditorProps) {
  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);
  const [slashSearch, setSlashSearch] = useState('');

  const handleBlockChange = (
    id: string,
    updatedFields: Partial<NotionBlock>,
  ) => {
    const updated = blocks.map((b) =>
      b.id === id ? { ...b, ...updatedFields } : b,
    );
    onUpdateBlocks(updated);
  };

  // Only a lone "/" typed into an empty block opens the block menu. Matching
  // any "/" stripped it from URLs, dates and "and/or" on every keystroke.
  const handleTextInput = (id: string, index: number, value: string) => {
    if (value === '/') {
      setSlashMenuIndex(index);
      handleBlockChange(id, { content: '' });
      return;
    }
    handleBlockChange(id, { content: value });
  };

  const handleAddBlock = (index: number, type: BlockType = 'paragraph') => {
    const newBlock: NotionBlock = {
      id: generateId('b'),
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

  // AI Assistant Action Handlers
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);

  const handleAiAction = async (
    id: string,
    actionType: 'summarize' | 'expand' | 'formal' | 'action_items',
  ) => {
    const targetBlock = blocks.find((b) => b.id === id);
    if (!targetBlock || aiBusyId) return;
    const source = targetBlock.content.trim();
    if (!source) {
      toast.error('Write something in this block first');
      return;
    }
    if (!workspaceId) {
      toast.error('Open a workspace to use AI actions');
      return;
    }
    setAiBusyId(id);
    try {
      const res = await aiApi.chat(workspaceId, {
        messages: [
          { role: 'system', content: AI_ACTION_PROMPTS[actionType] },
          { role: 'user', content: source },
        ],
        temperature: 0.4,
      });
      const result = res.message.content.trim();
      if (!result) throw new Error('Empty response');
      handleBlockChange(id, { content: result });
    } catch {
      toast.error('AI action failed. Your text was not changed.');
    } finally {
      setAiBusyId(null);
    }
  };

  const filteredBlockTypes = BLOCK_TYPES_CONFIG.filter(
    (b) =>
      b.label.toLowerCase().includes(slashSearch.toLowerCase()) ||
      b.description.toLowerCase().includes(slashSearch.toLowerCase()),
  );

  return (
    <div className="space-y-3 py-2 w-full">
      {blocks.map((block, index) => {
        return (
          <div
            key={block.id}
            className="group gap-2 p-1.5 relative flex items-start rounded-lg transition-colors hover:bg-accent/20"
          >
            {/* Notion Drag & Action Handle Controls */}
            <div className="gap-0.5 pt-1.5 flex shrink-0 items-center opacity-0 transition-opacity select-none group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 rounded cursor-pointer text-subtle hover:bg-accent hover:text-foreground"
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
                    className="p-1 rounded cursor-pointer text-subtle hover:bg-accent hover:text-accent-blue"
                    title="Insert block below"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2">
                  <div className="px-2 py-1.5 mb-1 border-b border-border">
                    <Input
                      placeholder="Type / or search block..."
                      value={slashSearch}
                      onChange={(e) => setSlashSearch(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  {/*
                    Only the list scrolls: the search box scrolling away with it
                    is what the old `overflow-y-auto` on the whole popover did,
                    and it left you typing into a field you could no longer see.
                  */}
                  <ScrollArea
                    className="max-h-72"
                    contentClassName="space-y-0.5"
                  >
                    {filteredBlockTypes.map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleAddBlock(index, item.type)}
                        className="gap-2.5 p-2 flex w-full cursor-pointer items-start rounded-md text-left transition-colors hover:bg-accent"
                      >
                        <div className="mt-0.5 p-1 rounded border border-border bg-surface-raised">
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {item.label}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-subtle">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {/* Block Body Rendering */}
            <div className="min-w-0 flex-1">
              {/* Heading 1 */}
              {block.type === 'h1' && (
                <Textarea
                  value={block.content}
                  onChange={(e) =>
                    handleTextInput(block.id, index, e.target.value)
                  }
                  placeholder="Heading 1..."
                  rows={1}
                  className="text-2xl font-extrabold tracking-tight p-0 min-h-9 h-auto resize-none overflow-hidden border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                />
              )}

              {/* Heading 2 */}
              {block.type === 'h2' && (
                <Textarea
                  value={block.content}
                  onChange={(e) =>
                    handleTextInput(block.id, index, e.target.value)
                  }
                  placeholder="Heading 2..."
                  rows={1}
                  className="text-xl font-bold tracking-tight p-0 min-h-8 h-auto resize-none overflow-hidden border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                />
              )}

              {/* Heading 3 */}
              {block.type === 'h3' && (
                <Textarea
                  value={block.content}
                  onChange={(e) =>
                    handleTextInput(block.id, index, e.target.value)
                  }
                  placeholder="Heading 3..."
                  rows={1}
                  className="text-lg font-semibold p-0 min-h-7 h-auto resize-none overflow-hidden border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                />
              )}

              {/* Text Paragraph */}
              {block.type === 'paragraph' && (
                <Textarea
                  value={block.content}
                  onChange={(e) =>
                    handleTextInput(block.id, index, e.target.value)
                  }
                  placeholder="Type '/' for commands..."
                  rows={1}
                  className="text-sm leading-relaxed p-0 min-h-6 h-auto resize-none overflow-hidden border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                />
              )}

              {/* Checklist / Todo */}
              {block.type === 'checklist' && (
                <div className="gap-2 py-0.5 flex items-center">
                  <input
                    type="checkbox"
                    checked={block.checked || false}
                    onChange={(e) =>
                      handleBlockChange(block.id, { checked: e.target.checked })
                    }
                    className="size-4 rounded cursor-pointer border-border text-accent-blue focus:ring-accent-blue"
                  />
                  <Input
                    value={block.content}
                    onChange={(e) =>
                      handleBlockChange(block.id, { content: e.target.value })
                    }
                    placeholder="Task item..."
                    className={cn(
                      'text-sm h-7 p-0 border-none bg-transparent text-foreground shadow-none focus-visible:ring-0',
                      block.checked &&
                        'text-muted-foreground line-through opacity-70',
                    )}
                  />
                </div>
              )}

              {/* Bulleted List */}
              {block.type === 'bullet_list' && (
                <div className="gap-2 flex items-start">
                  <span className="size-2 mt-2 shrink-0 rounded-full bg-accent-blue" />
                  <Input
                    value={block.content}
                    onChange={(e) =>
                      handleBlockChange(block.id, { content: e.target.value })
                    }
                    placeholder="List item..."
                    className="text-sm h-7 p-0 border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                  />
                </div>
              )}

              {/* Numbered List */}
              {block.type === 'numbered_list' && (
                <div className="gap-2 flex items-start">
                  <span className="text-xs font-semibold mt-1 shrink-0 text-accent-blue">
                    {index + 1}.
                  </span>
                  <Input
                    value={block.content}
                    onChange={(e) =>
                      handleBlockChange(block.id, { content: e.target.value })
                    }
                    placeholder="Ordered list item..."
                    className="text-sm h-7 p-0 border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                  />
                </div>
              )}

              {/* Toggle Block */}
              {block.type === 'toggle' && (
                <div className="p-2.5 space-y-2 rounded-lg border border-border bg-surface-raised/40">
                  <div className="gap-2 flex items-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleBlockChange(block.id, { isOpen: !block.isOpen })
                      }
                      className="p-1 rounded text-muted-foreground transition-transform hover:bg-accent"
                    >
                      <ChevronRight
                        className={cn(
                          'size-4 transition-transform',
                          block.isOpen && 'rotate-90',
                        )}
                      />
                    </button>
                    <Input
                      value={block.content}
                      onChange={(e) =>
                        handleBlockChange(block.id, { content: e.target.value })
                      }
                      placeholder="Toggle section title..."
                      className="font-semibold text-sm p-0 h-6 border-none bg-transparent text-foreground shadow-none focus-visible:ring-0"
                    />
                  </div>
                  {block.isOpen ? (
                    <div className="pl-6 pt-1">
                      <Textarea
                        value={block.aiPrompt || ''}
                        onChange={(e) =>
                          handleBlockChange(block.id, {
                            aiPrompt: e.target.value,
                          })
                        }
                        placeholder="Expanded toggle details content..."
                        className="text-xs p-2 rounded-md border border-border/80 bg-surface text-muted-foreground"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* Callout Box */}
              {block.type === 'callout' && (
                <div
                  className={cn(
                    'p-3 gap-3 flex items-start rounded-lg border transition-colors',
                    block.variant === 'warning'
                      ? 'border-accent-amber/30 bg-accent-amber-soft text-accent-amber'
                      : block.variant === 'tip'
                        ? 'border-accent-green/30 bg-accent-green-soft text-accent-green'
                        : 'border-accent-blue/30 bg-accent-blue/10 text-foreground',
                  )}
                >
                  <span className="text-xl select-none">
                    {block.icon || '💡'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={block.content}
                      onChange={(e) =>
                        handleBlockChange(block.id, { content: e.target.value })
                      }
                      placeholder="Callout information message..."
                      rows={2}
                      className="text-xs leading-relaxed p-0 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
              )}

              {/* Code Snippet */}
              {block.type === 'code' && (
                <div className="my-1 w-full">
                  <CodeBlock
                    code={block.content || '// Write code snippet here...'}
                    language={block.language || 'typescript'}
                    editable={true}
                    showLineNumbers={true}
                    onSave={(newCode) =>
                      handleBlockChange(block.id, { content: newCode })
                    }
                    onEdit={(newCode) =>
                      handleBlockChange(block.id, { content: newCode })
                    }
                  />
                </div>
              )}

              {/* Quote Block */}
              {block.type === 'quote' && (
                <div className="pl-4 py-1 rounded-r-md border-l-4 border-accent-blue bg-surface-raised/40 text-muted-foreground italic">
                  <Textarea
                    value={block.content}
                    onChange={(e) =>
                      handleBlockChange(block.id, { content: e.target.value })
                    }
                    placeholder="Quote text..."
                    rows={1}
                    className="text-sm p-0 resize-none border-none bg-transparent italic shadow-none focus-visible:ring-0"
                  />
                </div>
              )}

              {/* Interactive Database Table Block */}
              {block.type === 'table' && (
                <div className="p-3 space-y-3 overflow-x-auto rounded-lg border border-border bg-surface">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold gap-1.5 flex items-center text-foreground">
                      <TableIcon className="size-3.5 text-accent-blue" />
                      Notion Database Grid
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newRows = [...(block.rows || [])];
                        const colCount = block.headers
                          ? block.headers.length
                          : 3;
                        newRows.push(Array(colCount).fill('New Value'));
                        handleBlockChange(block.id, { rows: newRows });
                      }}
                      className="h-6 gap-1 text-[11px]"
                    >
                      <Plus className="size-3" />
                      <span>Add Row</span>
                    </Button>
                  </div>

                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-raised">
                        {(block.headers || ['Col 1', 'Col 2', 'Col 3']).map(
                          (h, colIdx) => (
                            <th
                              key={colIdx}
                              className="p-2 font-semibold text-left text-foreground"
                            >
                              <Input
                                value={h}
                                onChange={(e) => {
                                  const newHeaders = [...(block.headers || [])];
                                  newHeaders[colIdx] = e.target.value;
                                  handleBlockChange(block.id, {
                                    headers: newHeaders,
                                  });
                                }}
                                className="h-6 text-xs font-bold p-0 border-none bg-transparent shadow-none focus-visible:ring-0"
                              />
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(block.rows || []).map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-border/50 hover:bg-accent/30"
                        >
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-2">
                              <Input
                                value={cell}
                                onChange={(e) => {
                                  const newRows = [...(block.rows || [])];
                                  newRows[rowIdx][cellIdx] = e.target.value;
                                  handleBlockChange(block.id, {
                                    rows: newRows,
                                  });
                                }}
                                className="h-6 text-xs p-0 border-none bg-transparent text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0"
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
                <div className="p-3 space-y-2 rounded-xl border border-accent-violet/30 bg-gradient-to-r from-accent-violet-soft to-accent-indigo-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold gap-1.5 flex items-center text-accent-violet">
                      <Sparkles className="size-3.5 text-accent-violet" />
                      AI Copilot Assistant
                    </span>
                    <Badge
                      variant="outline"
                      className="border-accent-violet/30 text-[10px] text-accent-violet"
                    >
                      GPT-4o Ready
                    </Badge>
                  </div>
                  <Textarea
                    value={block.content}
                    onChange={(e) =>
                      handleBlockChange(block.id, { content: e.target.value })
                    }
                    placeholder="AI generated content or prompt result..."
                    rows={2}
                    className="text-xs p-2 rounded-lg border border-accent-violet/30 bg-surface/60 text-foreground"
                  />
                  <div className="gap-1.5 pt-1 flex flex-wrap items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'summarize')}
                      disabled={aiBusyId !== null}
                      className="h-6 text-[10px] text-accent-violet hover:bg-accent-violet-soft"
                    >
                      Summarize Doc
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'expand')}
                      disabled={aiBusyId !== null}
                      className="h-6 text-[10px] text-accent-violet hover:bg-accent-violet-soft"
                    >
                      Expand Content
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'formal')}
                      disabled={aiBusyId !== null}
                      className="h-6 text-[10px] text-accent-violet hover:bg-accent-violet-soft"
                    >
                      Make Professional
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAiAction(block.id, 'action_items')}
                      disabled={aiBusyId !== null}
                      className="h-6 text-[10px] text-accent-violet hover:bg-accent-violet-soft"
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
          className="text-xs gap-2 h-9 w-full justify-start rounded-lg border border-dashed border-border/60 text-subtle hover:text-foreground"
        >
          <Plus className="size-3.5" />
          <span>Click to add block or type '/'...</span>
        </Button>
      </div>
    </div>
  );
}
