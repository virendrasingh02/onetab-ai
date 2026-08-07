import {
  Badge,
  Button,
  Page,
  PageHeader,
  Panel,
} from '@org/ui';
import {
  CheckCircle,
  FileText,
  Save,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocHeader } from './docs/DocHeader.js';
import { useDocsState } from './docs/docs-hook.js';
import { DocSidebar } from './docs/DocSidebar.js';
import { DocToolsDrawer } from './docs/DocToolsDrawer.js';
import { NotionBlockEditor } from './docs/NotionBlockEditor.js';

export function DocumentEditor() {
  const [searchParams] = useSearchParams();
  const {
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    updateDocTitle,
    updateDocCategory,
    updateDocStatus,
    updateDocCover,
    updateDocIcon,
    toggleFavorite,
    updateDocBlocks,
    addComment,
    createDoc,
    duplicateDoc,
    deleteDoc,
  } = useDocsState();

  const [isSaved, setIsSaved] = useState(false);

  // Sync active document with URL search parameters
  useEffect(() => {
    const docParam = searchParams.get('doc');
    const newDocParam = searchParams.get('newDoc');

    if (docParam && docs.some((d) => d.id === docParam)) {
      setActiveDocId(docParam);
    }

    if (newDocParam === 'true') {
      createDoc();
    }
  }, [searchParams, docs, setActiveDocId, createDoc]);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <Page width="full">
      <PageHeader
        title="Docs & Knowledge Base"
        description="Notion-style interactive workspace documentation with multi-block editing, custom covers, database tables, and AI Copilot assistant."
        icon={<FileText className="text-accent-blue" />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            {isSaved ? (
              <Badge variant="primary" className="gap-1 px-3 py-1">
                <CheckCircle className="size-3.5" />
                Saved to Local Storage
              </Badge>
            ) : null}

            <DocToolsDrawer
              doc={activeDoc}
              onAddComment={(author, text) => addComment(activeDoc.id, author, text)}
            />

            <Button leadingIcon={<Save />} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        }
      />

      <div className="gap-6 md:flex-row flex flex-1 flex-col items-start">
        {/* Left Notion Docs Tree Sidebar */}
        <DocSidebar
          docs={docs}
          activeDocId={activeDocId}
          onSelectDoc={setActiveDocId}
          onCreateDoc={createDoc}
          onDuplicateDoc={duplicateDoc}
          onToggleFavorite={toggleFavorite}
          onDeleteDoc={deleteDoc}
          onUpdateIcon={(id, ic, col) => updateDocIcon(id, ic, col)}
          onUpdateTitle={(id, title) => updateDocTitle(id, title)}
        />

        {/* Main Notion Document Editor Area */}
        <Panel className="flex-1 flex flex-col min-h-160 w-full">
          {/* Notion Document Header */}
          <DocHeader
            doc={activeDoc}
            onUpdateTitle={(title) => updateDocTitle(activeDoc.id, title)}
            onUpdateIcon={(icon, color) => updateDocIcon(activeDoc.id, icon, color)}
            onUpdateCover={(cover) => updateDocCover(activeDoc.id, cover)}
            onUpdateStatus={(status) => updateDocStatus(activeDoc.id, status)}
            onUpdateCategory={(category) => updateDocCategory(activeDoc.id, category)}
            onToggleFavorite={() => toggleFavorite(activeDoc.id)}
          />

          {/* Interactive Notion Block Editor */}
          <div className="flex-1 rounded-xl border border-border bg-surface p-4 md:p-6 shadow-xs">
            <NotionBlockEditor
              key={activeDoc.id}
              blocks={activeDoc.blocks || []}
              onUpdateBlocks={(blocks) => updateDocBlocks(activeDoc.id, blocks)}
            />
          </div>
        </Panel>
      </div>
    </Page>
  );
}
