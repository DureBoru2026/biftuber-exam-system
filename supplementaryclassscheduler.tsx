import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, BookOpen, Clock, MapPin, Plus, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Send, X, Users, Activity } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, getDocs, where } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { Exam, ExamAttempt } from '@/src/types';

interface SupplementaryClassSchedulerProps {
  exams: Exam[];
  allAttempts: ExamAttempt[];
  onClose?: () => void;
  initialGrade?: string;
}

export function SupplementaryClassScheduler({ exams, allAttempts, onClose, initialGrade }: SupplementaryClassSchedulerProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade || '');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Identify Critical Subjects from Analytics
  const criticalInsights = useMemo(() => {
    const grades = ['9', '10', '11', '12'];
    const insights: { grade: string; subjects: string[] }[] = [];

    grades.forEach(grade => {
      const gradeExams = exams.filter(e => e.grade === grade);
      const subjects: Set<string> = new Set();

      gradeExams.forEach(exam => {
        const examAttempts = allAttempts.filter(a => a.examId === exam.id);
        if (examAttempts.length > 0) {
          const totalPct = examAttempts.reduce((sum, att) => {
            return sum + ((att.score || 0) / (att.totalPoints || 1) * 100);
          }, 0);
          const avgScore = totalPct / examAttempts.length;
          
          if (avgScore < 50) {
            subjects.add(exam.subject);
          }
        }
      });

      if (subjects.size > 0) {
        insights.push({ grade, subjects: Array.from(subjects) });
      }
    });

    return insights;
  }, [exams, allAttempts]);

  const handleAutoDraft = (grade: string, subject: string) => {
    setSelectedGrade(grade);
    setSelectedSubject(subject);
    
    // Set some defaults
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
    setStartTime('14:30');
    setEndTime('16:00');
    setLocation('Room 01 / Smart Lab');
    setNotes(`Supplementary session for Grade ${grade} students to reinforce key concepts in ${subject} based on recent mock results.`);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'classes'), {
        grade: selectedGrade,
        subject: selectedSubject,
        teacherId: user.uid,
        teacherName: profile.fullName || profile.name,
        date,
        startTime,
        endTime,
        location,
        notes: notes.trim(),
        status: 'draft',
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onClose) onClose();
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
      {/* Header with Dashboard Context */}
      <div className="bg-slate-900 rounded-[40px] p-8 border-4 border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('admin.scheduler')}</h2>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest max-w-xl">
              Automatically identify academic gaps and schedule remedial sessions to ensure student excellence.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Today</p>
              <p className="text-sm font-black text-white uppercase tracking-tight">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: AI Support Insights */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('admin.gaps')}</h3>
            </div>

            <div className="space-y-4">
              {criticalInsights.length === 0 ? (
                <div className="text-center py-12 px-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">All performance levels are currently within stable range.</p>
                </div>
              ) : (
                criticalInsights.map(insight => (
                  <div key={insight.grade} className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Grade {insight.grade} • Kutaa {insight.grade}</p>
                    <div className="grid grid-cols-1 gap-2">
                       {insight.subjects.map(subject => (
                         <button
                           key={subject}
                           onClick={() => handleAutoDraft(insight.grade, subject)}
                           className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-900 rounded-2xl border border-slate-100 hover:border-slate-900 transition-all text-left"
                         >
                           <div>
                             <p className="text-sm font-black text-slate-900 group-hover:text-white uppercase tracking-tight">{subject}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Needs Intervention</p>
                           </div>
                           <Plus size={18} className="text-slate-400 group-hover:text-blue-400" />
                         </button>
                       ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Scheduling Form */}
        <div className="lg:col-span-2">
          <motion.form 
            onSubmit={handleSchedule}
            className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm space-y-8"
          >
            {success ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-4"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={40} />
                </div>
                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Draft Generated!</h4>
                <p className="text-sm font-medium text-slate-500">The remedial class schedule has been drafted and saved to the portal directory.</p>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Grade Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Target Grade</label>
                    <div className="relative group">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                      <select
                        required
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[28px] text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      >
                        <option value="">Select Grade</option>
                        <option value="9">Grade 9</option>
                        <option value="10">Grade 10</option>
                        <option value="11">Grade 11</option>
                        <option value="12">Grade 12</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Subject Domain</label>
                    <div className="relative group">
                      <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                      <input
                        required
                        list="subjects"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        placeholder="e.g. Physics, Biology..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[28px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                      <datalist id="subjects">
                        {Array.from(new Set(exams.map(e => e.subject))).map(s => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Proposed Date</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                      <input
                        required
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[28px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                   {/* Location Selection */}
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Classroom / Location</label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                      <input
                        required
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Room 01, Lab..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[28px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Time Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Start Time</label>
                    <div className="relative group">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                      <input
                        required
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[28px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">End Time</label>
                    <div className="relative group">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                      <input
                        required
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-[28px] text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Administrative Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter additional instructions for students or staff..."
                    className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-32 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      Generate Schedule Draft
                    </>
                  )}
                </button>
              </>
            )}
          </motion.form>
        </div>
      </div>
    </div>
  );
}
