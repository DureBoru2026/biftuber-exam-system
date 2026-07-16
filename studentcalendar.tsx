import React, { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  isAfter,
  startOfToday
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Exam } from '../types';

interface StudentCalendarProps {
  exams: Exam[];
}

export function StudentCalendar({ exams }: StudentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getExamsForDay = (day: Date) => {
    return exams.filter(exam => {
      if (!exam.dueDate) return false;
      const dueDate = exam.dueDate?.toDate ? exam.dueDate.toDate() : new Date(exam.dueDate);
      return isSameDay(dueDate, day);
    });
  };

  const upcomingExams = exams
    .filter(exam => {
      if (!exam.dueDate) return false;
      const dueDate = exam.dueDate?.toDate ? exam.dueDate.toDate() : new Date(exam.dueDate);
      return isAfter(dueDate, startOfToday());
    })
    .sort((a, b) => {
      const dateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
      const dateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100/50">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Academic Schedule</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upcoming Exams & Assessment Cycles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            >
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
            <span className="text-sm font-black text-slate-900 uppercase tracking-widest min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            >
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px rounded-2xl overflow-hidden border border-slate-100 bg-slate-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-slate-50 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              {day}
            </div>
          ))}
          {days.map((day, i) => {
            const dayExams = getExamsForDay(day);
            const isTodayDay = isToday(day);
            const isSelectedMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={day.toString()} 
                className={`min-h-[80px] bg-white p-2 relative group transition-colors hover:bg-slate-50/50 ${
                  !isSelectedMonth ? 'opacity-40' : ''
                }`}
              >
                <span className={`text-[11px] font-bold ${
                  isTodayDay 
                    ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-lg shadow-blue-500/20' 
                    : 'text-slate-600'
                }`}>
                  {format(day, 'd')}
                </span>
                
                <div className="mt-2 space-y-1">
                  {dayExams.map((exam, idx) => (
                    <div 
                      key={exam.id}
                      className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-wider rounded-md truncate border border-blue-100"
                      title={exam.title}
                    >
                      {exam.subject}: {exam.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Deadlines Side Panel */}
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-6 flex flex-col space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[80px] opacity-20 pointer-events-none" />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2.5 bg-slate-800 text-blue-400 rounded-2xl border border-slate-700">
            <Clock size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight">Deadlines Queue</h4>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Preparation Priorities</p>
          </div>
        </div>

        <div className="space-y-4 flex-1">
          {upcomingExams.length === 0 ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={20} className="text-slate-600" />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                No active deadlines scheduled in system. Take this time to review past continuous assessments.
              </p>
            </div>
          ) : (
            upcomingExams.map((exam, idx) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={exam.id}
                className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 hover:border-slate-600 transition-colors group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-[8px] font-black uppercase tracking-widest rounded-md border border-blue-800/50">
                    {exam.subject}
                  </span>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    {format(exam.dueDate?.toDate ? exam.dueDate.toDate() : new Date(exam.dueDate), 'MMM d')}
                  </span>
                </div>
                <h5 className="text-xs font-black text-white uppercase tracking-tight mb-2 group-hover:text-blue-400 transition-colors">
                  {exam.title}
                </h5>
                <div className="flex items-center gap-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={10} className="text-blue-500" />
                    Grade {exam.grade}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-slate-400" />
                    {exam.durationMinutes}m
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl relative z-10">
          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-relaxed">
            🚀 PRO-TIP: Early preparation in models doubles success rates. Focus on your weak subject categories identified in the analytics panel.
          </p>
        </div>
      </div>
    </div>
  );
}
