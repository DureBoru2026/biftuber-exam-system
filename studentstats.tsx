import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { ExamAttempt } from '@/src/types';
import { 
  TrendingUp, 
  Award, 
  Clock, 
  Target, 
  ChevronRight,
  TrendingDown,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

export default function StudentStats() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'attempts'),
          where('userId', '==', user.uid),
          where('status', '==', 'completed'),
          orderBy('finishedAt', 'asc')
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamAttempt));
        setAttempts(list);
      } catch (error) {
        console.error("Error fetching student stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [user]);

  const chartData = attempts.slice(-10).map((att, index) => {
    const score = att.score || 0;
    const total = att.totalPoints || 1;
    const percentage = Math.round((score / total) * 100);
    const date = att.finishedAt?.toDate ? att.finishedAt.toDate() : new Date(att.finishedAt);
    
    return {
      name: `T-${attempts.length - 10 + index + 1}`,
      score: percentage,
      fullDate: format(date, 'MMM d, HH:mm'),
      subject: att.examSubject || 'Exam'
    };
  });

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm animate-pulse h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity size={40} className="text-slate-200 animate-spin" />
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Loading Stat Directory...</p>
        </div>
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
          <TrendingUp size={32} className="text-slate-300" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 uppercase">No Performance Data Yet</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Complete exams to see your learning trajectory visualized</p>
        </div>
      </div>
    );
  }

  const avgScore = Math.round(attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / attempts.reduce((acc, curr) => acc + (curr.totalPoints || 1), 0) * 100);
  const bestAttempt = [...attempts].sort((a, b) => ((b.score || 0) / (b.totalPoints || 1)) - ((a.score || 0) / (a.totalPoints || 1)))[0];
  const lastAttempt = attempts[attempts.length - 1];
  const secondLastAttempt = attempts.length > 1 ? attempts[attempts.length - 2] : null;

  const getTrend = () => {
    if (!secondLastAttempt) return { label: 'Baseline', color: 'text-blue-600', icon: TrendingUp };
    const curr = (lastAttempt.score || 0) / (lastAttempt.totalPoints || 1);
    const prev = (secondLastAttempt.score || 0) / (secondLastAttempt.totalPoints || 1);
    const diff = Math.round((curr - prev) * 100);
    if (diff > 0) return { label: `+${diff}% Higher`, color: 'text-emerald-600', icon: TrendingUp };
    if (diff < 0) return { label: `${diff}% Lower`, color: 'text-rose-600', icon: TrendingDown };
    return { label: 'Stable', color: 'text-slate-600', icon: Target };
  };

  const trend = getTrend();
  const TrendIcon = trend.icon;

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-[100px] -z-10 opacity-60" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-700 shadow-sm">
              Intelligence Node: 001
            </span>
            <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-800">
              Live Monitoring
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mt-2">
            <Activity className="text-blue-600" size={24} />
            Study Master Performance Engine
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
            Mapping {attempts.length} historical attempt data-points against school curriculum standards
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Global Mastery</p>
            <p className="text-2xl font-black text-slate-900">{avgScore}%</p>
          </div>
          <div className="w-px h-10 bg-slate-100 hidden sm:block" />
          <button 
            className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-2"
          >
            Detailed Analytics
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100">
              <Award className="text-amber-500" size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Target Peak</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">All-Time High Score</p>
            <p className="text-2xl font-black text-slate-900">
              {bestAttempt ? Math.round((bestAttempt.score || 0) / (bestAttempt.totalPoints || 1) * 100) : 0}%
            </p>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 truncate">{bestAttempt?.examSubject}</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100">
              <TrendIcon className={trend.color} size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Momentum</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Recent Velocity Trend</p>
            <p className={`text-2xl font-black ${trend.color}`}>{trend.label}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">vs. previous assessment</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-6 bg-blue-600 rounded-3xl border border-blue-700 shadow-xl shadow-blue-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <Clock className="text-white" size={20} />
            </div>
            <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.1em]">Checkpoint</span>
          </div>
          <div className="text-white">
            <p className="text-[10px] font-black text-white/70 uppercase tracking-widest leading-none mb-1">Latest Attempt Score</p>
            <p className="text-2xl font-black">{lastAttempt ? Math.round((lastAttempt.score || 0) / (lastAttempt.totalPoints || 1) * 100) : 0}%</p>
            <p className="text-[10px] text-white/80 font-bold uppercase mt-1 truncate">{lastAttempt?.examSubject}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-xs font-black text-slate-900 uppercase">Learning Curvature Graph</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Chronological mastery tracking for the last 10 attempts</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Score %</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full bg-slate-50/30 rounded-[32px] border border-slate-100 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 'black', fill: '#94A3B8' }} 
                dy={10}
              />
              <YAxis 
                domain={[0, 100]} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94A3B8' }} 
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl space-y-2 border border-slate-800">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{data.fullDate}</p>
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px] font-black uppercase">Result</span>
                        </div>
                        <p className="text-xs font-black text-white uppercase truncate">{data.subject}</p>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <TrendingUp size={14} className="text-blue-400" />
                          <span className="text-sm font-black text-white">{data.score}% Accuracy</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#2563EB" 
                strokeWidth={4} 
                fillOpacity={1} 
                fill="url(#scoreGradient)" 
                dot={{ r: 6, fill: '#2563EB', strokeWidth: 3, stroke: '#fff' }}
                activeDot={{ r: 8, stroke: '#2563EB', strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8 py-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[18px] font-black text-slate-900">{attempts.length}</span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Sessions</span>
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[18px] font-black text-emerald-600">
            {attempts.filter(a => ((a.score || 0) / (a.totalPoints || 1)) >= 0.5).length}
          </span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pass Records</span>
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[18px] font-black text-rose-600">
            {attempts.filter(a => ((a.score || 0) / (a.totalPoints || 1)) < 0.5).length}
          </span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Growth Needs</span>
        </div>
      </div>
    </div>
  );
}
