import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Users, User, Shield, Circle, Clock } from 'lucide-react';

export function OnlineMonitor() {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time online monitor for admins
    // Note: We use a 5-minute inactivity threshold for "online"
    const q = query(collection(db, 'users'), orderBy('lastSeen', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const activeThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const active = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(u => {
          const lastSeen = u.lastSeen?.toDate ? u.lastSeen.toDate() : (u.lastSeen ? new Date(u.lastSeen) : null);
          return lastSeen && lastSeen > activeThreshold;
        });
      setOnlineUsers(active);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-150 flex items-center gap-1.5 animate-pulse">
              <Circle size={8} fill="currentColor" />
              Live System Pulse
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Users className="text-blue-600" size={28} />
            Active Participants Monitor
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Real-time synchronization of users currently interacting with the portal
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-5 rounded-[24px] border border-slate-800 shadow-2xl">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Active</span>
            <span className="text-3xl font-black text-white leading-none">
              {onlineUsers.length < 10 ? `0${onlineUsers.length}` : onlineUsers.length}
            </span>
          </div>
          <div className="w-px h-10 bg-slate-800" />
          <div className="p-3 bg-blue-600/20 rounded-xl">
            <Users className="text-blue-400" size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {onlineUsers.map((u, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.05 }}
              key={u.id}
              className="group p-5 bg-slate-50 rounded-[24px] border border-slate-200 hover:border-blue-500 hover:bg-white hover:shadow-xl hover:shadow-blue-900/5 transition-all flex items-start gap-4"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-black uppercase shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {(u.fullName || u.name || 'U')[0]}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
              </div>
              
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900 uppercase truncate">
                    {u.fullName || u.name || 'Anonymous User'}
                  </h4>
                  {u.role === 'admin' && (
                    <Shield size={12} className="text-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  ID: <span className="text-slate-600 font-black">{u.sid || (u.role === 'admin' ? 'ADMIN' : u.id.slice(0, 8))}</span>
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border ${
                    u.role === 'admin' ? 'bg-amber-50 text-amber-600 border-amber-150' : 
                    u.role === 'staff' ? 'bg-indigo-50 text-indigo-600 border-indigo-150' : 
                    'bg-slate-200 text-slate-700 border-slate-300'
                  }`}>
                    {u.role}
                  </span>
                  <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase">
                    <Clock size={10} />
                    Active
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {onlineUsers.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <Users className="text-slate-300" size={32} />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">
                No active participants detected in system hub.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
