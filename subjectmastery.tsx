import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, AlertCircle, CheckCircle2, TrendingDown, Target, Brain } from 'lucide-react';
import { ExamAttempt } from '../types';

interface SubjectMasteryProps {
  attempts: ExamAttempt[];
}

interface SubjectStats {
  subject: string;
  avgScore: number;
  attemptsCount: number;
  masteryLevel: 'excellent' | 'good' | 'average' | 'weak';
}

export function SubjectMastery({ attempts }: SubjectMasteryProps) {
  // Aggregate data by subject
  const subjectMap: Record<string, { totalScore: number; totalPoints: number; count: number }> = {};

  attempts
    .filter(a => a.status === 'completed' && a.score !== undefined && a.totalPoints !== undefined && a.examSubject)
    .forEach(attempt => {
      const sub = attempt.examSubject!;
      if (!subjectMap[sub]) {
        subjectMap[sub] = { totalScore: 0, totalPoints: 0, count: 0 };
      }
      subjectMap[sub].totalScore += attempt.score!;
      subjectMap[sub].totalPoints += attempt.totalPoints!;
      subjectMap[sub].count += 1;
    });

  const subjects: SubjectStats[] = Object.entries(subjectMap).map(([subject, data]) => {
    const avg = Math.round((data.totalScore / data.totalPoints) * 100);
    let level: SubjectStats['masteryLevel'] = 'weak';
    if (avg >= 85) level = 'excellent';
    else if (avg >= 70) level = 'good';
    else if (avg >= 50) level = 'average';

    return {
      subject,
      avgScore: avg,
      attemptsCount: data.count,
      masteryLevel: level
    };
  }).sort((a, b) => a.avgScore - b.avgScore); // Weakest first as requested

  if (subjects.length === 0) {
    return null; // Don't show if no data
  }

  const getLevelStyles = (level: SubjectStats['masteryLevel']) => {
    switch (level) {
      case 'excellent': return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle2 size={16} />, label: 'Cicciibsaa' };
      case 'good': return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: <Target size={16} />, label: 'Gaarii' };
      case 'average': return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: <BookOpen size={16} />, label: 'Giddu-galeessa' };
      default: return { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: <AlertCircle size={16} />, label: 'Laafaa' };
    }
  };

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Brain className="text-blue-600" size={28} />
            Madallii Bilchina Barnootaa
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
            Xiinxala qabxii barnoota adda addaa hubachuuf gargaaru <br className="hidden md:block" />
            <span className="text-slate-300">(Subject Mastery Matrix)</span>
          </p>
        </div>
        <div className="px-4 py-2 bg-slate-900 rounded-2xl border border-slate-800">
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
            {subjects.length} Barnoota Xiinxalame
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {subjects.map((item, idx) => {
          const styles = getLevelStyles(item.masteryLevel);
          return (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={item.subject}
              className={`p-5 rounded-3xl border-2 ${styles.bg} ${styles.border} flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group`}
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 rounded-2xl bg-white border ${styles.border} ${styles.color} shadow-sm group-hover:scale-110 transition-transform`}>
                  {styles.icon}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{item.subject}</h4>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 bg-slate-400 rounded-full" />
                    {item.attemptsCount} attempts / yaaliiwwan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 relative z-10">
                <div className="space-y-1 text-right">
                  <span className={`text-2xl font-black ${styles.color}`}>{item.avgScore}%</span>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${styles.color}`}>
                      Bilchina {styles.label}
                    </span>
                  </div>
                </div>
                
                <div className="w-24 h-2.5 bg-white rounded-full overflow-hidden border border-slate-100 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.avgScore}%` }}
                    className={`h-full rounded-full ${item.masteryLevel === 'excellent' ? 'bg-emerald-500' : item.masteryLevel === 'good' ? 'bg-blue-500' : item.masteryLevel === 'average' ? 'bg-amber-500' : 'bg-rose-500'}`}
                  />
                </div>
              </div>

              {item.masteryLevel === 'weak' && (
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingDown size={48} className="text-rose-600" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
        <div className="flex gap-4">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 h-fit">
            <Target className="text-blue-600" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Gorsa Xiinxalaa (Diagnostic Guidance)</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Barnootni oli irratti tarreeffaman bakka ati <span className="text-rose-600 font-black">hir'ina jaabaa (vulnerabilities)</span> qabdu waan ta'aniif, qormaata modeliiwwan barnoota kanaan walqabatan irratti xiyyeeffannoo dabalataa kenni.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
