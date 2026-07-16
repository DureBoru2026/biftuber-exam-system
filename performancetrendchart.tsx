import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, Award, Clock, Printer, BookOpen, Activity, Compass } from 'lucide-react';
import { motion } from 'motion/react';
import { ExamAttempt } from '../types';
import { normalizeSubject } from '../constants';

interface PerformanceTrendChartProps {
  attempts: ExamAttempt[];
}

export function PerformanceTrendChart({ attempts }: PerformanceTrendChartProps) {
  const [viewMode, setViewMode] = useState<'overall' | 'subjects'>('overall');

  const handlePrint = () => {
    window.print();
  };

  // Process completed attempts in chronological order
  const allCompletedAttempts = [...attempts]
    .filter(a => a.status === 'completed' && a.score !== undefined && a.totalPoints !== undefined)
    .sort((a, b) => {
      const dateA = a.finishedAt?.toDate ? a.finishedAt.toDate() : new Date(a.finishedAt);
      const dateB = b.finishedAt?.toDate ? b.finishedAt.toDate() : new Date(b.finishedAt);
      return dateA.getTime() - dateB.getTime();
    });

  if (allCompletedAttempts.length === 0) {
    return (
      <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 border-dashed text-center space-y-3">
        <Clock className="mx-auto text-slate-300 animate-pulse" size={32} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No completed exam attempts found to generate trend analytics.</p>
      </div>
    );
  }

  // overall data (last 5 attempts)
  const overallChartData = allCompletedAttempts
    .slice(-5)
    .map((item, index) => {
      const percentage = Math.round((item.score! / item.totalPoints!) * 100);
      const date = item.finishedAt?.toDate ? item.finishedAt.toDate() : new Date(item.finishedAt);
      
      return {
        name: `Attempt ${index + 1}`,
        score: percentage,
        fullDate: format(date, 'MMM d, HH:mm'),
        subject: item.examSubject || 'Exam',
        title: item.examTitle || 'Practice'
      };
    });

  // subject-wise trend data (all chronologically up to last 10 attempts to show clean lines)
  const subjectTrendData = allCompletedAttempts
    .slice(-10)
    .map((item, index) => {
      const percentage = Math.round((item.score! / item.totalPoints!) * 100);
      const date = item.finishedAt?.toDate ? item.finishedAt.toDate() : new Date(item.finishedAt);
      const rawSubj = item.examSubject || '';
      const normSubj = normalizeSubject(rawSubj);
      
      return {
        name: `A-${index + 1}`,
        rawDate: date,
        dateStr: format(date, 'MMM d'),
        title: item.examTitle || 'Practice Exam',
        subject: rawSubj,
        Mathematics: normSubj === 'Mathematics' ? percentage : undefined,
        Physics: normSubj === 'Physics' ? percentage : undefined,
        Others: (normSubj !== 'Mathematics' && normSubj !== 'Physics') ? percentage : undefined,
        overall: percentage
      };
    });

  const averageScore = Math.round(overallChartData.reduce((acc, curr) => acc + curr.score, 0) / overallChartData.length);
  const latestScore = overallChartData[overallChartData.length - 1].score;
  const improvement = overallChartData.length > 1 ? latestScore - overallChartData[0].score : 0;

  // Counts of attempts across primary subjects
  const mathAttemptsCount = allCompletedAttempts.filter(a => normalizeSubject(a.examSubject || '') === 'Mathematics').length;
  const physicsAttemptsCount = allCompletedAttempts.filter(a => normalizeSubject(a.examSubject || '') === 'Physics').length;

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 printable-report-card">
      {/* Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-750 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-100">
              Personal Progress Tracker
            </span>
            {improvement > 0 && (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                <TrendingUp size={10} />
                +{improvement}% Improvement
              </span>
            )}
            <button 
              onClick={handlePrint}
              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors print:hidden ml-auto md:ml-2"
              title="Print Performance Analysis"
            >
              <Printer size={14} />
            </button>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Academic Performance Engine</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {viewMode === 'overall' 
              ? `Analytics showing overall accuracy of last ${overallChartData.length} exams`
              : `Tracking learning trajectories in key subject streams (Math, Physics, Others)`}
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-center">
          <button
            onClick={() => setViewMode('overall')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
              viewMode === 'overall' 
                ? 'bg-white text-slate-900 shadow-md border border-slate-200' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Overall Chronology
          </button>
          <button
            onClick={() => setViewMode('subjects')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
              viewMode === 'subjects' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity size={12} className={viewMode === 'subjects' ? 'animate-pulse' : ''} />
            Subject Progress (Math & Physics)
          </button>
        </div>
      </div>

      {/* Visualizer Display Stage */}
      <div className="h-72 w-full pt-2">
        {viewMode === 'overall' ? (
          // Standard Bar Chart Visualizer
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overallChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94A3B8' }} 
              />
              <YAxis 
                domain={[0, 100]} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'medium', fill: '#94A3B8' }} 
              />
              <Tooltip 
                cursor={{ fill: '#F8FAFC' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xl space-y-2 text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.fullDate}</p>
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-900 uppercase truncate max-w-[200px]">{data.title}</p>
                          <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">{data.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <Award size={14} className="text-amber-500" />
                          <span className="text-sm font-black text-slate-900">{data.score}% Accuracy</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="score" 
                radius={[6, 6, 0, 0]} 
                barSize={32}
              >
                {overallChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === overallChartData.length - 1 ? '#2563EB' : '#E2E8F0'} 
                    className="hover:fill-blue-400 transition-colors cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          // Subject-Wise Line Chart displaying Math & Physics progress curves side-by-side
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={subjectTrendData} margin={{ top: 15, right: 15, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94A3B8' }} 
              />
              <YAxis 
                domain={[0, 100]} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 'medium', fill: '#94A3B8' }} 
              />
              <Tooltip 
                cursor={{ stroke: '#64748B', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl space-y-2 text-left border border-slate-800">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                          {data.dateStr} • Attempt Details
                        </p>
                        <p className="text-xs font-black text-white uppercase truncate max-w-[190px]">{data.title}</p>
                        <p className="text-[10px] text-blue-400 font-bold uppercase">{data.subject}</p>
                        
                        <div className="pt-2 border-t border-slate-850 space-y-1">
                          {data.Mathematics !== undefined && (
                            <div className="flex items-center justify-between text-xs gap-6">
                              <span className="text-slate-400 font-bold">Mathematics:</span>
                              <span className="font-extrabold text-blue-400">{data.Mathematics}%</span>
                            </div>
                          )}
                          {data.Physics !== undefined && (
                            <div className="flex items-center justify-between text-xs gap-6">
                              <span className="text-slate-400 font-bold">Physics:</span>
                              <span className="font-extrabold text-amber-400">{data.Physics}%</span>
                            </div>
                          )}
                          {(data.Mathematics === undefined && data.Physics === undefined) && (
                            <div className="flex items-center justify-between text-xs gap-6">
                              <span className="text-slate-400 font-bold">Score:</span>
                              <span className="font-extrabold text-emerald-450">{data.overall}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              />
              <Line 
                name="Mathematics" 
                type="monotone" 
                dataKey="Mathematics" 
                stroke="#2563EB" 
                strokeWidth={3} 
                connectNulls 
                dot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#FFF' }}
                activeDot={{ r: 7, strokeWidth: 2 }}
              />
              <Line 
                name="Physics" 
                type="monotone" 
                dataKey="Physics" 
                stroke="#D97706" 
                strokeWidth={3} 
                connectNulls 
                dot={{ r: 5, fill: '#D97706', strokeWidth: 2, stroke: '#FFF' }}
                activeDot={{ r: 7, strokeWidth: 2 }}
              />
              <Line 
                name="Other Subjects" 
                type="monotone" 
                dataKey="Others" 
                stroke="#8B5CF6" 
                strokeWidth={2} 
                strokeDasharray="4 4" 
                connectNulls 
                dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 1, stroke: '#FFF' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Auxiliary Learning Stream Insights and Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric card left */}
        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-4 text-left">
          <div className="p-2.5 bg-white rounded-xl border border-blue-100 shrink-0">
            <BookOpen className="text-blue-600" size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider mb-1">Subject Mastery Velocity</p>
            <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
              {mathAttemptsCount > 0 || physicsAttemptsCount > 0 
                ? `You have logged ${mathAttemptsCount} Mathematics and ${physicsAttemptsCount} Physics exam records. Focus on targeted drills to flatten performance valleys.`
                : 'Take dynamic mini-mock challenges specifically in Mathematics & Physics to populate interactive learning stream timelines.'}
            </p>
          </div>
        </div>

        {/* Metric card right */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4 text-left">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shrink-0">
            <Compass className="text-slate-500" size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Curriculum Benchmarking</p>
            <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
              Each attempt maps to standard EAES (Educational Assessment and Examination Services) patterns, helping track the standard deviation of your scores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
