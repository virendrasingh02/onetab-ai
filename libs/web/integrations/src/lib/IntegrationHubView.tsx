import { useState } from 'react';
import { Share2, Check, ExternalLink, MessageSquare, Calendar, HardDrive, Video, Webhook, FileText } from 'lucide-react';

export interface IntegrationCard {
  id: string;
  name: string;
  category: string;
  description: string;
  connected: boolean;
}

const integrationsList: IntegrationCard[] = [
  { id: 'github', name: 'GitHub', category: 'Dev Tools', description: 'PR code reviews, issue sync, and commit webhooks.', connected: true },
  { id: 'gitlab', name: 'GitLab', category: 'Dev Tools', description: 'Merge request checks and pipeline notifications.', connected: false },
  { id: 'jira', name: 'Jira', category: 'Dev Tools', description: 'Two-way task and sprint synchronization.', connected: true },
  { id: 'linear', name: 'Linear', category: 'Dev Tools', description: 'Fast issue tracking and workspace linking.', connected: false },
  { id: 'gdrive', name: 'Google Drive', category: 'Storage', description: 'Embed files, preview docs, and search attachments.', connected: true },
  { id: 'gcal', name: 'Google Calendar', category: 'Calendar', description: 'Auto-schedule meetings and event reminders.', connected: false },
  { id: 'outlook', name: 'Outlook / MS 365', category: 'Calendar', description: 'Sync meetings, contacts, and emails.', connected: false },
  { id: 'slack', name: 'Slack Import', category: 'Importer', description: 'Import full Slack workspace JSON exports.', connected: true },
  { id: 'discord', name: 'Discord', category: 'Messaging', description: 'Bridge channels and post automated updates.', connected: false },
  { id: 'zoom', name: 'Zoom', category: 'Video', description: 'Auto-generate video conference links.', connected: false },
  { id: 'teams', name: 'Microsoft Teams', category: 'Messaging', description: 'Connect MS Teams channels to Matrix.', connected: false },
  { id: 'dropbox', name: 'Dropbox', category: 'Storage', description: 'Browse and share Dropbox file links.', connected: false },
  { id: 'onedrive', name: 'OneDrive', category: 'Storage', description: 'Attach Microsoft cloud documents.', connected: false },
  { id: 'notion', name: 'Notion Import', category: 'Importer', description: 'Convert Notion pages and databases to Docs.', connected: true },
  { id: 'webhooks', name: 'Webhooks Hub', category: 'API', description: 'Incoming and outgoing custom webhooks.', connected: true },
];

export function IntegrationHubView() {
  const [cards, setCards] = useState<IntegrationCard[]>(integrationsList);

  const toggleConnection = (id: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, connected: !c.connected } : c));
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="w-6 h-6 text-blue-400" /> Integration Ecosystem Hub
          </h1>
          <p className="text-sm text-slate-400">Connect 16 external developer tools, cloud storage, calendars, and communications</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
                    {card.category === 'Dev Tools' && <Share2 className="w-5 h-5" />}
                    {card.category === 'Storage' && <HardDrive className="w-5 h-5 text-emerald-400" />}
                    {card.category === 'Calendar' && <Calendar className="w-5 h-5 text-amber-400" />}
                    {card.category === 'Messaging' && <MessageSquare className="w-5 h-5 text-purple-400" />}
                    {card.category === 'Video' && <Video className="w-5 h-5 text-pink-400" />}
                    {card.category === 'Importer' && <FileText className="w-5 h-5 text-cyan-400" />}
                    {card.category === 'API' && <Webhook className="w-5 h-5 text-red-400" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">{card.name}</h3>
                    <span className="text-[11px] text-slate-400">{card.category}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">{card.description}</p>
            </div>

            <button
              onClick={() => toggleConnection(card.id)}
              className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                card.connected
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
              }`}
            >
              {card.connected ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              {card.connected ? 'Connected' : 'Connect Account'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
