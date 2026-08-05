import { Building2, Shield, Users, CreditCard, Layers } from 'lucide-react';

export function EnterpriseDashboardView() {
  const departments = [
    { name: 'Engineering', code: 'ENG', members: 32 },
    { name: 'Product & Design', code: 'PROD', members: 14 },
    { name: 'Customer Success', code: 'CS', members: 8 },
  ];

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" /> Enterprise Governance
          </h1>
          <p className="text-sm text-slate-400">Organization-wide management, departments, security policies, and subscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-blue-950 text-blue-400 border border-blue-500/30 rounded-lg font-mono uppercase font-semibold">
            Enterprise Plan Tier
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400">Licensed Seats</span>
            <h3 className="text-xl font-bold text-white">54 / 100</h3>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-600/20 text-purple-400 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400">Departments</span>
            <h3 className="text-xl font-bold text-white">3 Active</h3>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400">SSO & SCIM</span>
            <h3 className="text-xl font-bold text-emerald-400">SAML Active</h3>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-600/20 text-amber-400 rounded-lg">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400">Billing Cycle</span>
            <h3 className="text-xl font-bold text-white">Annual Auto-renew</h3>
          </div>
        </div>
      </div>

      {/* Departments Overview */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-6">
        <h3 className="font-bold text-slate-100 text-sm mb-4">Organization Departments</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div key={dept.code} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-100 text-sm">{dept.name}</h4>
                <span className="text-xs text-slate-400 font-mono">Code: {dept.code}</span>
              </div>
              <span className="text-xs font-semibold bg-slate-800 text-blue-400 px-2 py-1 rounded">
                {dept.members} members
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
