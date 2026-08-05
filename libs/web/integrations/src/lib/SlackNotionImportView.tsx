import { useState } from 'react';
import { UploadCloud, CheckCircle, FileText, MessageSquare, ArrowRight } from 'lucide-react';

export function SlackNotionImportView() {
  const [importStatus, setImportStatus] = useState<'IDLE' | 'SUCCESS'>('IDLE');

  const handleStartImport = () => {
    setImportStatus('SUCCESS');
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-cyan-400" /> Slack & Notion Data Migration
        </h1>
        <p className="text-sm text-slate-400">Import channels, messages, attachments, Notion pages, and databases into OneTab AI</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slack Import */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-purple-600/20 text-purple-400 rounded-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Import Slack Workspace</h3>
                <span className="text-xs text-slate-400">JSON Zip export package</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Upload your Slack export zip file to automatically recreate public channels, message history, user profiles, and file attachments in OneTab Matrix.
            </p>
          </div>

          <button
            onClick={handleStartImport}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition"
          >
            Upload Slack Export Zip <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Notion Import */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-cyan-600/20 text-cyan-400 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">Import Notion Workspace</h3>
                <span className="text-xs text-slate-400">Markdown & HTML export package</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Convert your Notion pages, inline databases, and wiki hierarchies seamlessly into OneTab WorkDocuments and Kanban boards.
            </p>
          </div>

          <button
            onClick={handleStartImport}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition"
          >
            Upload Notion Export Zip <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {importStatus === 'SUCCESS' && (
        <div className="mt-6 p-4 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>Migration job started successfully! Channels and WorkDocuments are being populated in the background.</span>
        </div>
      )}
    </div>
  );
}
