import { useState } from 'react';
import { HardDrive, UploadCloud, File, Download, Trash2 } from 'lucide-react';

export interface FileEntry {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

const sampleFiles: FileEntry[] = [
  { id: '1', name: 'onetab-architecture-spec.pdf', size: '2.4 MB', type: 'PDF Document', uploadedAt: 'Today 2:30 PM' },
  { id: '2', name: 'qdrant-vector-schema.json', size: '142 KB', type: 'JSON', uploadedAt: 'Yesterday' },
  { id: '3', name: 'system-diagram-v2.png', size: '4.1 MB', type: 'PNG Image', uploadedAt: 'Aug 3, 2026' },
];

export function FileManagerView() {
  const [files, setFiles] = useState<FileEntry[]>(sampleFiles);

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-cyan-400" /> File Manager & Attachments
          </h1>
          <p className="text-sm text-slate-400">MinIO S3 integrated object storage & file directory</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium text-white shadow">
          <UploadCloud className="w-4 h-4" /> Upload File
        </button>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex-1 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-slate-800/40 transition">
                <td className="px-4 py-3 font-medium text-slate-200 flex items-center gap-2">
                  <File className="w-4 h-4 text-cyan-400" /> {file.name}
                </td>
                <td className="px-4 py-3 text-slate-400">{file.type}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{file.size}</td>
                <td className="px-4 py-3 text-slate-400">{file.uploadedAt}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Download className="w-4 h-4" /></button>
                    <button onClick={() => setFiles(files.filter(f => f.id !== file.id))} className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
