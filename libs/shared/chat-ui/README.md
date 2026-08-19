# @org/chat-ui

Presentational chat components. Props in, callbacks out, no data fetching.

## Design

Same contract as `@org/ui`, but in its own library because these components speak
the chat domain model from `@org/types` — general-purpose UI should not depend on
it. Nothing here fetches, subscribes or holds session state; `@org/web-chat`
supplies the data.

## Surface

- `<ChatLayout>`, `<ChatHeader>` — the three-column shell (timeline, thread
  panel, member list).
- `<MessageList>` / `buildRows` — virtualised timeline with date separators.
- `<ChatBubble>`, `<DateSeparator>` — a message with reactions and the
  edit/delete/react/reply actions.
- `<Composer>`, `<LexicalComposerInput>`, `<EmojiPicker>` — the rich-text
  message box: markdown shortcuts as you type, plus `@` mention, `/` command
  and `:` emoji menus.
- `<MarkdownMessage>` — renders a message body's markdown. The read side of the
  composer; keep the two in step.
- `<ChannelWelcome>` — the block that introduces a channel at the top of its
  timeline, with the setup actions the host wires up.
- `<ThreadPanel>` — a thread root and its replies.
- `<AttachmentCard>`, `<AttachmentRenderer>`, `<ImagePreview>`,
  `<VideoPreview>`, `<VoiceMessage>` — media by kind.
- `<MemberList>`, `<PresenceBadge>`, `<TypingIndicator>`,
  `<ConnectionBanner>`, `<EncryptionBadge>` — presence and status.
- `<ChatSearchPlaceholder>` — the search affordance, ahead of the search backend.

## Notes

**The timeline is virtualised** with `@tanstack/react-virtual`. Rows are measured
after mount rather than assumed, because message heights vary with content.

**Scroll behaviour is the hard part**, and it is deliberate: the view sticks to
the bottom for new messages only when the reader is already near the bottom, so
it never yanks someone away from history they are reading. Loading older messages
preserves the scroll offset, so the content under the cursor stays put instead of
jumping.

**`buildRows` is exported separately** from the component so the message/separator
grouping can be unit-tested without rendering.

**Markdown is the wire format.** The composer edits a real rich-text document
and serialises it to markdown on send; `<MarkdownMessage>` parses that markdown
back into the same shapes. Both directions go through `CHAT_TRANSFORMERS`, so
adding a construct means teaching both sides about it — otherwise a message
looks one way while being typed and another once sent. Message bodies are never
injected as HTML, and only `http(s)`/`mailto` links survive as links.

## Commands

```sh
nx lint @org/chat-ui
nx typecheck @org/chat-ui
```
