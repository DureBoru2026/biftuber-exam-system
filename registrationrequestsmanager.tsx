import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  UserPlus, 
  UserX, 
  CheckCircle2, 
  Clock, 
  Search, 
  Mail, 
  Shield, 
  GraduationCap, 
  Trash2,
  MoreVertical,
  Activity,
  User,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

export default function RegistrationRequestsManager() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed' | 'rejected'>('all');

  useEffect(() => {
    const q = query(collection(db, 'registrationRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'processed' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'registrationRequests', id), { status });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this request permanently?")) return;
    try {
      await deleteDoc(doc(db, 'registrationRequests', id));
    } catch (error) {
      console.error("Error deleting request:", error);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || req.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-600 rounded-2xl text-white shadow-lg shadow-rose-500/20">
              <UserPlus size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Registration Requests</h2>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Manage incoming requests for new user accounts from the landing page.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <div className="flex bg-white border border-slate-200 p-1 rounded-2xl">
            {(['all', 'pending', 'processed', 'rejected'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-100 rounded-[32px] animate-pulse" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 p-20 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto">
            <Filter size={32} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No registration requests found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRequests.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group relative"
              >
                {/* Status Badge */}
                <div className="absolute top-6 right-6">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                    req.status === 'processed' ? 'bg-emerald-100 text-emerald-600' :
                    req.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {req.status === 'processed' ? <CheckCircle2 size={10} /> :
                     req.status === 'rejected' ? <UserX size={10} /> :
                     <Clock size={10} />}
                    {req.status}
                  </span>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                      req.registerType === 'Teacher' ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-blue-600 text-white shadow-blue-200'
                    }`}>
                      {req.registerType === 'Teacher' ? <Shield size={24} /> : <GraduationCap size={24} />}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight line-clamp-1">{req.fullName}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {req.registerType} • {req.gender} • {req.age} Yrs
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Grade Level</p>
                      <p className="text-xs font-black text-slate-900 uppercase">Grade {req.gradeLevel}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Department</p>
                      <p className="text-xs font-black text-slate-900 uppercase line-clamp-1">{req.department}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Message</p>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] font-medium text-slate-600 line-clamp-3">
                      "{req.message || 'No additional message provided.'}"
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       {req.status === 'pending' && (
                         <>
                           <button 
                             onClick={() => handleUpdateStatus(req.id, 'processed')}
                             className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                             title="Mark as Processed"
                           >
                             <CheckCircle2 size={18} />
                           </button>
                           <button 
                             onClick={() => handleUpdateStatus(req.id, 'rejected')}
                             className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                             title="Reject Request"
                           >
                             <UserX size={18} />
                           </button>
                         </>
                       )}
                       <button 
                         onClick={() => handleDelete(req.id)}
                         className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                         title="Delete Request"
                       >
                         <Trash2 size={18} />
                       </button>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'MMM dd, HH:mm') : 'Recently'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
