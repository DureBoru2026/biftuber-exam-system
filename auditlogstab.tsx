import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Eye, Printer, Download, Shield, Search, Calendar, User, RefreshCw, FileText } from 'lucide-react';

interface AuditLogItem {
  id: string;
  userId: string;
  userEmail: string;
  action: 'view_report' | 'print_report' | 'export_pdf';
  targetStudentId?: string;
  targetStudentName?: string;
  component: string;
  timestamp: string;
}

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      const logsRef = collection(db, 'auditLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as any)
      })) as AuditLogItem[];
      setLogs(list);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.targetStudentName && log.targetStudentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.component.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'view_report':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-black uppercase tracking-wider">
            <Eye size={12} />
            Viewed Report
          </span>
        );
      case 'print_report':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider">
            <Printer size={12} />
            Printed Report
          </span>
        );
      case 'export_pdf':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[10px] font-black uppercase tracking-wider">
            <Download size={12} />
            Exported PDF
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-wider">
            <FileText size={12} />
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-4 border-slate-950 shadow-lg">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="p-4 bg-amber-500 text-slate-950 rounded-2xl border-2 border-slate-950 shrink-0 shadow-md">
            <Shield size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black uppercase tracking-widest text-amber-400">System Security Audit Logs</h3>
            <p className="text-xs text-slate-300 font-bold uppercase tracking-wide max-w-xl">
              Strict access logs verifying when and by whom academic reports were viewed, compiled, exported, or printed.
            </p>
          </div>
        </div>
        <button
          onClick={fetchAuditLogs}
          disabled={isLoading}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white border-2 border-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      <div className="bg-white rounded-[32px] border-4 border-slate-950 shadow-sm p-6 md:p-8 space-y-6">
        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search by Admin Email or Student Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Filter Action:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none cursor-pointer"
            >
              <option value="all">ALL ACTIVITIES</option>
              <option value="view_report">VIEWED REPORT</option>
              <option value="print_report">PRINTED REPORT</option>
              <option value="export_pdf">EXPORTED PDF</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw size={32} className="text-blue-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading compliance records...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl gap-3">
            <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
              <Shield size={24} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Compliance Audit Log Clean</p>
            <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
              No report card views, exports, or print sessions have been recorded matching your current query parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-2 border-slate-950 rounded-2xl max-h-[500px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs bg-white">
              <thead className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4 border-b-2 border-slate-950">Timestamp</th>
                  <th className="px-5 py-4 border-b-2 border-slate-950">Administrator Identity</th>
                  <th className="px-5 py-4 border-b-2 border-slate-950">Action Event</th>
                  <th className="px-5 py-4 border-b-2 border-slate-950">Target Recipient</th>
                  <th className="px-5 py-4 border-b-2 border-slate-950">Terminal / Area</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-sans font-bold text-slate-900 border-l border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        <span>{log.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap border-l border-slate-100">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-5 py-4 font-sans font-black text-slate-800 border-l border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-900 font-bold">{log.targetStudentName || 'N/A'}</span>
                        {log.targetStudentId && log.targetStudentId !== 'N/A' && (
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {log.targetStudentId}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-black text-slate-500 text-[10px] border-l border-slate-100 uppercase tracking-wider">
                      {log.component}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
