import React, { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, AlertTriangle, Zap, Rocket } from 'lucide-react';
import { Exam } from '../types';

interface CountdownTimerProps {
  exams: Exam[];
}

export function CountdownTimer({ exams }: CountdownTimerProps) {
  const [nextMock, setNextMock] = useState<Exam | null>(null);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const findNextMock = () => {
      const now = new Date();
      const upcomingMocks = exams
        .filter(exam => {
          if (exam.type !== 'eaes_mock' || !exam.dueDate) return false;
          const dueDate = exam.dueDate?.toDate ? exam.dueDate.toDate() : new Date(exam.dueDate);
          return isAfter(dueDate, now);
        })
        .sort((a, b) => {
          const dateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
          const dateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
          return dateA.getTime() - dateB.getTime();
        });

      if (upcomingMocks.length > 0) {
        setNextMock(upcomingMocks[0]);
      } else {
        setNextMock(null);
      }
    };

    findNextMock();
    const interval = setInterval(findNextMock, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [exams]);

  useEffect(() => {
    if (!nextMock) return;

    const timer = setInterval(() => {
      const now = new Date();
      const dueDate = nextMock.dueDate?.toDate ? nextMock.dueDate.toDate() : new Date(nextMock.dueDate);
      
      if (isAfter(now, dueDate)) {
        setTimeLeft(null);
        setNextMock(null); // It passed
        return;
      }

      const days = differenceInDays(dueDate, now);
      const hours = differenceInHours(dueDate, now) % 24;
      const minutes = differenceInMinutes(dueDate, now) % 60;
      const seconds = differenceInSeconds(dueDate, now) % 60;

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextMock]);

  if (!nextMock || !timeLeft) {
    return (
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-8 text-center space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-[80px] opacity-10 pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <Rocket className="mx-auto text-emerald-500 mb-4" size={32} />
          <h3 className="text-xl font-black text-white uppercase tracking-tight">National EAES Engine Ready</h3>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
            No upcoming scheduled mock exams detected. Continue practicing with active model tutorials.
          </p>
        </div>
      </div>
    );
  }

  const isCritical = timeLeft.days === 0 && timeLeft.hours < 24;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-slate-900 rounded-[32px] border-4 ${isCritical ? 'border-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.2)]' : 'border-slate-800'} p-8 relative overflow-hidden group`}
    >
      <div className={`absolute top-0 right-0 w-64 h-64 ${isCritical ? 'bg-rose-600' : 'bg-blue-600'} rounded-full blur-[120px] opacity-10 pointer-events-none transition-colors duration-1000`} />
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10 text-center lg:text-left">
        <div className="space-y-3">
          <div className="flex items-center justify-center lg:justify-start gap-2">
            <span className={`px-3 py-1 ${isCritical ? 'bg-rose-600' : 'bg-blue-600'} text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse`}>
              Next EAES National Mock
            </span>
            {isCritical && (
              <span className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase tracking-widest">
                <AlertTriangle size={12} />
                Critical Window
              </span>
            )}
          </div>
          <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight max-w-md">
            {nextMock.title}
          </h3>
          <div className="flex items-center justify-center lg:justify-start gap-4 text-slate-500">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
              <Zap size={14} className="text-amber-500" />
              {nextMock.subject}
            </div>
            <div className="w-1 h-1 bg-slate-700 rounded-full" />
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
              <Timer size={14} className="text-blue-500" />
              {nextMock.durationMinutes} Minutes
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'D', value: timeLeft.days },
            { label: 'H', value: timeLeft.hours },
            { label: 'M', value: timeLeft.minutes },
            { label: 'S', value: timeLeft.seconds },
          ].map((item, idx) => (
            <div key={item.label} className="flex flex-col items-center">
              <div className={`w-16 h-20 md:w-20 md:h-24 ${isCritical ? 'bg-rose-950/30' : 'bg-slate-800/50'} rounded-2xl border border-slate-700 backdrop-blur-xl flex flex-col items-center justify-center space-y-1 relative group-hover:border-slate-500 transition-colors`}>
                <span className={`text-2xl md:text-3xl font-black ${isCritical ? 'text-rose-500' : 'text-blue-500'}`}>
                  {String(item.value).padStart(2, '0')}
                </span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                {idx < 3 && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-slate-700 font-bold hidden md:block">:</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-lg text-center md:text-left">
          Ensure all prerequisite continuous assessments are synchronized before the deadline. The system will automatically lock entry when the timer reaches zero.
        </p>
        <div className="flex items-center gap-4 shrink-0">
          <button className="px-6 py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95">
            View Syllabus
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-900/20">
            Study Guide
          </button>
        </div>
      </div>
    </motion.div>
  );
}
