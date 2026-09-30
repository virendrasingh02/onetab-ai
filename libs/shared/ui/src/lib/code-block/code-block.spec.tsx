// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './code-block.js';
import {
  computeDiff,
  detectLanguage,
  getLanguageExtension,
  getLanguageName,
  normalizeLanguage,
  parseHighlightedLines,
  sanitizeFilename,
} from './code-block.utils.js';

describe('CodeBlock System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Utilities', () => {
    it('normalizes language aliases correctly', () => {
      expect(normalizeLanguage('js')).toBe('javascript');
      expect(normalizeLanguage('ts')).toBe('typescript');
      expect(normalizeLanguage('py')).toBe('python');
      expect(normalizeLanguage('sh')).toBe('bash');
      expect(normalizeLanguage('yml')).toBe('yaml');
      expect(normalizeLanguage('md')).toBe('markdown');
      expect(normalizeLanguage('UNKNOWN')).toBe('unknown');
      expect(normalizeLanguage()).toBe('plaintext');
    });

    it('returns human readable language display names', () => {
      expect(getLanguageName('typescript')).toBe('TypeScript');
      expect(getLanguageName('python')).toBe('Python');
      expect(getLanguageName('json')).toBe('JSON');
      expect(getLanguageName('bash')).toBe('Bash');
      expect(getLanguageName('unknown_lang')).toBe('UNKNOWN_LANG');
    });

    it('returns appropriate file extension', () => {
      expect(getLanguageExtension('typescript')).toBe('ts');
      expect(getLanguageExtension('python')).toBe('py');
      expect(getLanguageExtension('bash')).toBe('sh');
      expect(getLanguageExtension('markdown')).toBe('md');
    });

    it('sanitizes filenames and attaches proper extension', () => {
      expect(sanitizeFilename('', 'python')).toBe('snippet.py');
      expect(sanitizeFilename('my_script', 'python')).toBe('my_script.py');
      expect(sanitizeFilename('../secret/path/test.js', 'javascript')).toBe('_secret_path_test.js');
    });

    it('detects language from code heuristics', () => {
      expect(detectLanguage('{"key": "value"}')).toBe('json');
      expect(detectLanguage('<html><body>Hello</body></html>')).toBe('html');
      expect(detectLanguage('SELECT * FROM users WHERE id = 1;')).toBe('sql');
      expect(detectLanguage('npm install shiki')).toBe('bash');
      expect(detectLanguage('def calculate_sum(a, b):\n  return a + b')).toBe('python');
      expect(detectLanguage('import React from "react";\nexport const x = 1;')).toBe('javascript');
    });

    it('parses highlighted lines from array and string specifications', () => {
      const set1 = parseHighlightedLines([1, 4, 7]);
      expect(set1.has(1)).toBe(true);
      expect(set1.has(4)).toBe(true);
      expect(set1.has(7)).toBe(true);
      expect(set1.has(2)).toBe(false);

      const set2 = parseHighlightedLines('1, 3-5, 8');
      expect(set2.has(1)).toBe(true);
      expect(set2.has(3)).toBe(true);
      expect(set2.has(4)).toBe(true);
      expect(set2.has(5)).toBe(true);
      expect(set2.has(8)).toBe(true);
      expect(set2.has(2)).toBe(false);
      expect(set2.has(6)).toBe(false);
    });

    it('computes line-by-line diff with added/removed stats', () => {
      const orig = 'const a = 1;\nconst b = 2;';
      const mod = 'const a = 1;\nconst b = 3;\nconst c = 4;';
      const result = computeDiff(orig, mod);

      expect(result.addedCount).toBe(2);
      expect(result.removedCount).toBe(1);
      expect(result.lines.some((l) => l.type === 'added' && l.content === 'const b = 3;')).toBe(true);
      expect(result.lines.some((l) => l.type === 'removed' && l.content === 'const b = 2;')).toBe(true);
    });
  });

  describe('Component Rendering & Variants', () => {
    it('renders inline code variant as a compact code tag', () => {
      render(<CodeBlock variant="inline" code="npm run build" />);
      const inlineElem = screen.getByText('npm run build');
      expect(inlineElem.tagName.toLowerCase()).toBe('code');
      expect(inlineElem.className).toContain('text-info-text');
    });

    it('renders default code block with header, line numbers, and filename', async () => {
      render(
        <CodeBlock
          language="typescript"
          filename="app.ts"
          code="const message: string = 'Hello World';"
          showLineNumbers={true}
        />,
      );

      expect(screen.getByText('app.ts')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Line number 1
      expect(screen.getByText("const message: string = 'Hello World';")).toBeInTheDocument();
    });

    it('renders terminal variant with prompt prefix and terminal styling', () => {
      render(
        <CodeBlock
          variant="terminal"
          code="pnpm install @org/ui"
          showLineNumbers={false}
        />,
      );

      expect(screen.getByText('$')).toBeInTheDocument();
      expect(screen.getByText('pnpm install @org/ui')).toBeInTheDocument();
    });

    it('supports copy to clipboard with feedback', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const onCopyMock = vi.fn();
      render(
        <CodeBlock
          code="console.log('test copy');"
          onCopy={onCopyMock}
          showCopy={true}
        />,
      );

      const copyButton = screen.getByLabelText('Copy code to clipboard');
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(writeTextMock).toHaveBeenCalledWith("console.log('test copy');");
      expect(onCopyMock).toHaveBeenCalledWith("console.log('test copy');");
    });

    it('supports toggling word wrap', () => {
      render(
        <CodeBlock
          code="const veryLongLine = 'this is a long line that could wrap or scroll';"
          showWrap={true}
        />,
      );

      const wrapToggle = screen.getByLabelText('Enable word wrap');
      fireEvent.click(wrapToggle);
      expect(screen.getByLabelText('Disable word wrap')).toBeInTheDocument();
    });

    it('supports toggling line numbers', () => {
      render(
        <CodeBlock
          code="const a = 10;"
          showLineNumbers={true}
        />,
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      const lineToggle = screen.getByLabelText('Hide line numbers');
      fireEvent.click(lineToggle);
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('renders editable mode with editing, saving, and dirty tracking', () => {
      const onSaveMock = vi.fn();
      render(
        <CodeBlock
          code="initial code"
          editable={true}
          onSave={onSaveMock}
        />,
      );

      // Click Edit button
      const editButton = screen.getByLabelText('Edit code');
      fireEvent.click(editButton);

      // Now textarea should be available
      const textarea = screen.getByLabelText(/Editing .* code/i) as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toBe('initial code');

      // Edit content
      fireEvent.change(textarea, { target: { value: 'updated code' } });
      expect(textarea.value).toBe('updated code');
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      // Click Save
      const saveButton = screen.getByLabelText('Save code');
      fireEvent.click(saveButton);

      expect(onSaveMock).toHaveBeenCalledWith('updated code');
    });

    it('renders diff viewer variant with unified line differences and stats', () => {
      render(
        <CodeBlock
          variant="diff"
          originalCode="line 1\nold line 2"
          modifiedCode="line 1\nnew line 2"
        />,
      );

      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByText('-1')).toBeInTheDocument();
      expect(screen.getByText(/new line 2/)).toBeInTheDocument();
      expect(screen.getByText(/old line 2/)).toBeInTheDocument();
    });

    it('renders sandboxed preview for HTML and shows unsupported notice for non-visual code', () => {
      const { rerender } = render(
        <CodeBlock
          variant="preview"
          language="html"
          code="<h1>Preview Title</h1>"
        />,
      );

      expect(screen.getByTitle('Code Preview')).toBeInTheDocument();

      rerender(
        <CodeBlock
          variant="preview"
          language="python"
          code="print('hello')"
        />,
      );

      expect(screen.getByText(/Preview unavailable for python/i)).toBeInTheDocument();
    });

    it('renders execution-ready UI with runtime status and disabled notices when unconnected', () => {
      render(
        <CodeBlock
          code="console.log(42);"
          canExecute={true}
        />,
      );

      expect(screen.getByText('Runtime Output')).toBeInTheDocument();
      expect(screen.getByText(/Execution service required/i)).toBeInTheDocument();
      expect(screen.getByText(/Backend execution runtime is not connected/i)).toBeInTheDocument();
    });
  });
});
