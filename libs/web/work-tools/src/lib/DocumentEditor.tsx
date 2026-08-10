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
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    companies,
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    addCompany,
    renameCompany,
    deleteCompany,
    moveDocToCompany,
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
      const newId = createDoc();
      setSearchParams({ doc: newId });
    }
  }, [searchParams, docs, setActiveDocId, createDoc, setSearchParams]);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const currentDoc = activeDoc || docs[0];

  return (
    <Page width="full">
      <PageHeader
        title="Docs & Knowledge Base"
        description="Notion-style interactive workspace documentation with company-wise tree navigation, multi-block editing, custom covers, and AI Copilot."
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

            {currentDoc && (
              <DocToolsDrawer
                doc={currentDoc}
                onAddComment={(author, text) => addComment(currentDoc.id, author, text)}
              />
            )}

            <Button leadingIcon={<Save />} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        }
      />

      <div className="gap-6 md:flex-row flex flex-1 flex-col items-start w-full">
        {/* Left Notion Docs Tree Sidebar */}
        <DocSidebar
          companies={companies}
          docs={docs}
          activeDocId={activeDocId}
          onSelectDoc={(id) => {
            setActiveDocId(id);
            setSearchParams({ doc: id });
          }}
          onAddCompany={addCompany}
          onRenameCompany={renameCompany}
          onDeleteCompany={deleteCompany}
          onCreateDoc={(cId, t, cat, temp, pId) => {
            const newId = createDoc(cId, t, cat, temp, pId);
            setSearchParams({ doc: newId });
          }}
          onMoveDocToCompany={moveDocToCompany}
          onDuplicateDoc={duplicateDoc}
          onToggleFavorite={toggleFavorite}
          onDeleteDoc={deleteDoc}
          onUpdateTitle={(id, title) => updateDocTitle(id, title)}
        />

        {/* Main Workspace Area */}
        <Panel className="flex-1 flex flex-col min-h-160 w-full">
          {currentDoc ? (
            /* Single Notion Document Editor Area */
            <>
              {/* Notion Document Header */}
              <DocHeader
                doc={currentDoc}
                onUpdateTitle={(title) => updateDocTitle(currentDoc.id, title)}
                onUpdateIcon={(icon, color) => updateDocIcon(currentDoc.id, icon, color)}
                onUpdateCover={(cover) => updateDocCover(currentDoc.id, cover)}
                onUpdateStatus={(status) => updateDocStatus(currentDoc.id, status)}
                onUpdateCategory={(category) => updateDocCategory(currentDoc.id, category)}
                onToggleFavorite={() => toggleFavorite(currentDoc.id)}
              />

              {/* Interactive Notion Block Editor */}
              <div className="flex-1 rounded-xl border border-border bg-surface p-4 md:p-6 shadow-xs">
                <NotionBlockEditor
                  key={currentDoc.id}
                  blocks={currentDoc.blocks || []}
                  onUpdateBlocks={(blocks) => updateDocBlocks(currentDoc.id, blocks)}
                />
              </div>
            </>
          ) : null}
        </Panel>
      </div>
    </Page>
  );
}
