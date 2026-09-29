import { describe, it, expect } from 'vitest';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { HashtagNode } from '@lexical/hashtag';
import { $generateNodesFromDOM } from '@lexical/html';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { $convertToMarkdownString } from '@lexical/markdown';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $getRoot, createEditor } from 'lexical';
import { CHAT_TRANSFORMERS } from './lexical-markdown.js';
import { CommandNode, MentionNode } from './lexical-nodes.js';
import { sanitizePasteDom } from './paste-sanitizer.js';

const SPAN =
  'font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;';
const bold = (text: string) =>
  `<span style="${SPAN}font-weight:700;">${text}</span>`;
const plain = (text: string) =>
  `<span style="${SPAN}font-weight:400;">${text}</span>`;
const mono = (text: string) =>
  `<span style="font-size:11pt;font-family:'Roboto Mono',monospace;color:#188038;font-weight:400;">${text}</span>`;
const item = (...runs: string[]) =>
  `<li dir="ltr" style="list-style-type:disc;font-weight:400;" aria-level="1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation">${runs.join('')}</p></li>`;
const para = (...runs: string[]) =>
  `<p dir="ltr" style="line-height:1.38;margin-top:12pt;margin-bottom:4pt;">${runs.join('')}</p>`;

/** Shape of what Google Docs puts on the clipboard: the whole selection sits
 *  inside a `<b style="font-weight:normal">`, and real emphasis is carried by
 *  per-run `font-weight` styles. */
const GOOGLE_DOCS_HTML =
  '<meta charset="utf-8">' +
  '<b style="font-weight:normal;" id="docs-internal-guid-1a2b3c4d-7fff-0000-1111-abcdef012345">' +
  para(bold('Data/assets needed:')) +
  '<ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;">' +
  item(plain('Named customer permission')) +
  item(plain('Before/after baseline')) +
  '</ul>' +
  para(bold('Developer notes:')) +
  '<ul style="margin-top:0;margin-bottom:0;">' +
  item(plain("Don't publish empty "), mono('[X]'), plain(' values')) +
  item(
    plain('If a metric cannot be sourced, '),
    bold('remove the card rather than publish the placeholder'),
  ) +
  '</ul>' +
  para(bold('Priority:'), plain(' P1')) +
  '</b>';

function sanitize(html: string): Document {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  sanitizePasteDom(dom, dom.body);
  return dom;
}

function pasteToMarkdown(html: string): string {
  const editor = createEditor({
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
      HashtagNode,
      HorizontalRuleNode,
      MentionNode,
      CommandNode,
    ],
    onError: (error) => {
      throw error;
    },
  });
  const dom = sanitize(html);
  let markdown = '';
  editor.update(
    () => {
      $getRoot()
        .clear()
        .append(...$generateNodesFromDOM(editor, dom));
      markdown = $convertToMarkdownString(CHAT_TRANSFORMERS, undefined, true);
    },
    { discrete: true },
  );
  return markdown;
}

describe('sanitizePasteDom', () => {
  it("unwraps Google Docs' whole-document <b style=font-weight:normal> wrapper", () => {
    const dom = sanitize(GOOGLE_DOCS_HTML);
    expect(dom.body.querySelector('b')).toBeNull();
    expect(dom.body.firstElementChild?.tagName).toBe('P');
  });

  it('keeps only the runs that were actually bold', () => {
    const dom = sanitize(GOOGLE_DOCS_HTML);
    const bolded = Array.from(dom.body.querySelectorAll('strong')).map(
      (el) => el.textContent,
    );
    expect(bolded).toEqual([
      'Data/assets needed:',
      'Developer notes:',
      'remove the card rather than publish the placeholder',
      'Priority:',
    ]);
  });

  it('turns a monospace run into inline code', () => {
    const dom = sanitize(GOOGLE_DOCS_HTML);
    expect(
      Array.from(dom.body.querySelectorAll('code')).map((el) => el.textContent),
    ).toEqual(['[X]']);
  });

  it('keeps a semantic <b> with no weight override (Word, web pages)', () => {
    const dom = sanitize(
      `<p><b style="mso-bidi-font-weight:normal">Heads up</b> team</p>`,
    );
    expect(dom.body.querySelector('b')?.textContent).toBe('Heads up');
  });

  it('drops emphasis tags whose own style switches them off', () => {
    const dom = sanitize(
      '<p><i style="font-style:normal">a</i><u style="text-decoration:none">b</u><strong style="font-weight:400">c</strong></p>',
    );
    expect(dom.body.innerHTML).toBe('<p>abc</p>');
  });

  it('does not wrap text that is already inside <pre> in inline code', () => {
    const dom = sanitize(
      `<pre><span style="font-family:Consolas,monospace">npm run dev</span></pre>`,
    );
    expect(dom.body.innerHTML).toBe('<pre>npm run dev</pre>');
  });

  it('strips unsafe link targets but keeps safe ones', () => {
    const dom = sanitize(
      '<p><a href="javascript:alert(1)">x</a><a href="https://example.com" style="color:red">y</a></p>',
    );
    expect(dom.body.innerHTML).toBe(
      '<p><a>x</a><a href="https://example.com">y</a></p>',
    );
  });
});

describe('Google Docs paste → message markdown', () => {
  const markdown = pasteToMarkdown(GOOGLE_DOCS_HTML);

  it('bolds only the headings and the emphasised phrase', () => {
    expect(markdown).toContain('**Data/assets needed:**');
    expect(markdown).toContain('**Developer notes:**');
    expect(markdown).toContain('**Priority:** P1');
    expect(markdown).toContain(
      '**remove the card rather than publish the placeholder**',
    );
    expect(markdown).not.toContain('**Named customer permission');
  });

  it('keeps the bullet lists and the inline code', () => {
    expect(markdown).toContain('- Named customer permission');
    expect(markdown).toContain('- Before/after baseline');
    expect(markdown).toContain("- Don't publish empty `[X]` values");
  });
});
