import { ShieldAlert } from 'lucide-react';

export function AuditLogView() {
  const logs = [
    { id: 'log_1', actor: 'admin@acme.com', action: 'SSO_CONFIG_UPDATED', target: 'SAML 2.0 Identity Provider', ip: '192.168.1.42', time: '10 mins ago' },
    { id: 'log_2', actor: 'scim-service@okta.com', action: 'USER_PROVISIONED', target: 'john.doe@acme.com', ip: '52.14.88.10', time: '45 mins ago' },
    { id: 'log_3', actor: 'sec-lead@acme.com', action: 'AGENT_PERMISSIONS_CHANGED', target: 'Agile Sprint Manager', ip: '192.168.1.100', time: '2 hours ago' },
  ];

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-400" /> Enterprise Security Audit Trail
          </h1>
          <p className="text-sm text-slate-400">Immutable security events, SCIM syncs, SSO logins, and permission changes</p>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Event Action</th>
              <th className="px-4 py-3">Target Resource</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/40 transition">
                <td className="px-4 py-3 font-semibold text-slate-200">{log.actor}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-400">{log.action}</td>
                <td className="px-4 py-3 text-slate-300">{log.target}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ip}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
