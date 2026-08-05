import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, MapPin } from 'lucide-react';

export interface EventItem {
  id: string;
  title: string;
  startAt: string;
  location?: string;
  category: 'MEETING' | 'TASK_DUE' | 'MILESTONE';
}

const sampleEvents: EventItem[] = [
  { id: '1', title: 'Sprint Review & Demo', startAt: '10:00 AM', location: 'Matrix Room #general', category: 'MEETING' },
  { id: '2', title: 'Qdrant Vector Pipeline Migration', startAt: '02:00 PM', location: 'Dev Sync', category: 'TASK_DUE' },
  { id: '3', title: 'Phase 5 Release Milestone', startAt: '05:00 PM', category: 'MILESTONE' },
];

export function CalendarView() {
  const [events] = useState<EventItem[]>(sampleEvents);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-emerald-400" /> Calendar & Event Schedule
          </h1>
          <p className="text-sm text-slate-400">Integrated meetings, tasks, and milestone schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-sm font-semibold text-slate-200">August 2026</span>
            <button className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white shadow">
            <Plus className="w-4 h-4" /> Schedule Event
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Calendar Days */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-400">
            {days.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {dates.map((d) => (
              <div
                key={d}
                className={`min-h-[70px] p-2 rounded-lg border text-xs flex flex-col justify-between transition ${
                  d === 5
                    ? 'border-emerald-500 bg-emerald-950/30 font-bold text-emerald-400'
                    : 'border-slate-800/80 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{d}</span>
                {d === 5 && <span className="w-2 h-2 rounded-full bg-emerald-400 self-end"></span>}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Agenda */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col">
          <h2 className="font-bold text-slate-200 mb-4 text-sm pb-2 border-b border-slate-800">Today's Agenda (Aug 5)</h2>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {events.map((evt) => (
              <div key={evt.id} className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-mono text-emerald-400"><Clock className="w-3 h-3" /> {evt.startAt}</span>
                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] uppercase font-semibold">{evt.category}</span>
                </div>
                <h3 className="font-semibold text-sm text-slate-100">{evt.title}</h3>
                {evt.location && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> {evt.location}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
