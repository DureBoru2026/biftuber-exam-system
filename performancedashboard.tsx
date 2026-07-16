import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  Award, 
  Clock, 
  BookOpen, 
  Activity, 
  ChevronRight, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle, 
  AlertCircle,
  TrendingDown,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Crown,
  BookOpenCheck,
  ListTodo,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExamAttempt } from '../types';
import { normalizeSubject } from '../constants';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface PerformanceDashboardProps {
  attempts: ExamAttempt[];
  role?: 'student' | 'staff' | 'admin' | string;
  userName?: string;
  grade?: string;
  stream?: string;
}

export default function PerformanceDashboard({ 
  attempts = [], 
  role = 'student', 
  userName = 'Student',
  grade = '',
  stream = '' 
}: PerformanceDashboardProps) {
  
  const { language, t } = useLanguage();
  const [timeRange, setTimeRange] = useState<'all' | '10' | '30'>('all');
  const [activeChartTab, setActiveChartTab] = useState<'trends' | 'subjects' | 'distribution'>('trends');
  const [targetLevel, setTargetLevel] = useState<number>(85);

  // Filter and sort completed attempts
  const completedAttempts = useMemo(() => {
    return [...attempts]
      .filter(a => a.status === 'completed' && a.score !== undefined && a.totalPoints !== undefined)
      .sort((a, b) => {
        const dateA = a.finishedAt?.toDate ? a.finishedAt.toDate() : new Date(a.finishedAt);
        const dateB = b.finishedAt?.toDate ? b.finishedAt.toDate() : new Date(b.finishedAt);
        return dateA.getTime() - dateB.getTime();
      });
  }, [attempts]);

  // Apply time range filter
  const filteredAttempts = useMemo(() => {
    let result = [...completedAttempts];
    if (timeRange === '10') {
      result = result.slice(-10);
    } else if (timeRange === '30') {
      result = result.slice(-30);
    }
    return result;
  }, [completedAttempts, timeRange]);

  // --- COMPUTE ADVANCED STATS ---
  const stats = useMemo(() => {
    if (filteredAttempts.length === 0) return null;

    let totalScore = 0;
    let totalMax = 0;
    let passingCount = 0;
    let totalViolations = 0;

    filteredAttempts.forEach(a => {
      totalScore += a.score || 0;
      totalMax += a.totalPoints || 100;
      const scorePercent = ((a.score || 0) / (a.totalPoints || 100)) * 100;
      if (scorePercent >= 50) passingCount++;
      totalViolations += a.violations || 0;
    });

    const averageScorePercent = Math.round((totalScore / totalMax) * 100);
    const passRatePercent = Math.round((passingCount / filteredAttempts.length) * 100);

    return {
      totalAttemptsCount: filteredAttempts.length,
      averageScorePercent,
      passRatePercent,
      totalViolations,
      hasViolations: totalViolations > 0
    };
  }, [filteredAttempts]);

  // --- SUBJECT PROFICIENCY COMPILING ---
  const subjectProficiencyData = useMemo(() => {
    const subjectScoresMap: { [key: string]: { sum: number; count: number; totalMax: number } } = {};
    
    filteredAttempts.forEach(a => {
      const origSubject = a.examSubject || 'Other';
      const subject = normalizeSubject(origSubject);
      
      if (!subjectScoresMap[subject]) {
        subjectScoresMap[subject] = { sum: 0, count: 0, totalMax: 0 };
      }
      subjectScoresMap[subject].sum += a.score || 0;
      subjectScoresMap[subject].totalMax += a.totalPoints || 100;
      subjectScoresMap[subject].count += 1;
    });

    return Object.keys(subjectScoresMap).map(subject => {
      const data = subjectScoresMap[subject];
      const avgPercent = Math.round((data.sum / data.totalMax) * 100);
      
      // Determine diagnostic feedback label
      let recommendation = 'No Recommendations';
      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
      if (avgPercent >= 88) {
        recommendation = language === 'om' ? '🎯 Giddu-gala Qormaata EAES irratti dandeettii olaanaadha!' : '🎯 Outstanding mastery! Exceeds national pass limits.';
        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
      } else if (avgPercent >= 70) {
        recommendation = language === 'om' ? '⚡ Gahumsa gaarii qabda, shaakala dabalataa mirkaneessi.' : '⚡ Strong core aptitude. Continue refining complex modules.';
        badgeColor = 'bg-blue-50 text-blue-750 border-blue-100';
      } else if (avgPercent >= 50) {
        recommendation = language === 'om' ? '📝 Gahumsi kee madaalawaadha. Shaakala beekumsaa cimsi.' : '📝 Moderate status. Dedicated reviews of syllabus recommended.';
        badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
      } else {
        recommendation = language === 'om' ? '⚠️ Deggarsa barumsaa dabalataa yeroo gabaabaa keessatti barbaada.' : '⚠️ Immediate remedy required. Link to remedial schedule.';
        badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
      }

      return {
        subject,
        proficiency: avgPercent,
        count: data.count,
        recommendation,
        badgeColor
      };
    }).sort((a, b) => b.proficiency - a.proficiency);
  }, [filteredAttempts, language]);

  // --- TIME-SERIES CHRONOLOGY FOR FIRST CHART ---
  const chronologicalTrendData = useMemo(() => {
    return filteredAttempts.map((item, index) => {
      const scorePercent = Math.round(((item.score || 0) / (item.totalPoints || 100)) * 100);
      const isPass = scorePercent >= 50;
      const date = item.finishedAt?.toDate ? item.finishedAt.toDate() : new Date(item.finishedAt);
      
      const formattedDate = date instanceof Date && !isNaN(date.getTime()) 
        ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
        : `Attempt ${index + 1}`;

      return {
        index: index + 1,
        name: `A-${index + 1}`,
        score: scorePercent,
        subject: normalizeSubject(item.examSubject || 'Other'),
        title: item.examTitle || 'Mock Exam',
        dateStr: formattedDate,
        violations: item.violations || 0,
        userName: item.userName || 'Anonymous Classmate'
      };
    });
  }, [filteredAttempts]);

  // --- DISTRIBUTION METRICS (For score bins) ---
  const scoreDistributionData = useMemo(() => {
    const bins = {
      '90-100 (Elite)': 0,
      '75-89 (High)': 0,
      '50-74 (Pass)': 0,
      '0-49 (Remedial)': 0
    };

    filteredAttempts.forEach(item => {
      const scorePercent = Math.round(((item.score || 0) / (item.totalPoints || 100)) * 100);
      if (scorePercent >= 90) bins['90-100 (Elite)']++;
      else if (scorePercent >= 75) bins['75-89 (High)']++;
      else if (scorePercent >= 50) bins['50-74 (Pass)']++;
      else bins['0-49 (Remedial)']++;
    });

    return Object.keys(bins).map(bin => ({
      name: bin,
      count: bins[bin as keyof typeof bins],
      fill: bin.includes('Elite') ? '#10B981' : bin.includes('High') ? '#3B82F6' : bin.includes('Pass') ? '#F59E0B' : '#EF4444'
    }));
  }, [filteredAttempts]);

  // --- CLASSROOM TOP PERFORMERS (If Teacher / Admin accessing compiled scores) ---
  const topPerformers = useMemo(() => {
    if (role !== 'admin' && role !== 'staff') return [];
    
    // Aggregate by student
    const studentAverages: { [userId: string]: { name: string; sum: number; totalMax: number; count: number } } = {};
    completedAttempts.forEach(a => {
      const uid = a.userId;
      if (!uid) return;
      const uName = a.userName || 'Anonymous Student';
      
      if (!studentAverages[uid]) {
        studentAverages[uid] = { name: uName, sum: 0, totalMax: 0, count: 0 };
      }
      studentAverages[uid].sum += a.score || 0;
      studentAverages[uid].totalMax += a.totalPoints || 100;
      studentAverages[uid].count += 1;
    });

    return Object.keys(studentAverages).map(uid => {
      const data = studentAverages[uid];
      return {
        userId: uid,
        name: data.name,
        average: Math.round((data.sum / data.totalMax) * 100),
        attempts: data.count
      };
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);
  }, [completedAttempts, role]);

  const handlePrint = () => {
    window.print();
  };

  // Safe checks for empty data state
  if (completedAttempts.length === 0) {
    return (
      <div className="bg-slate-50 p-12 rounded-[40px] border border-slate-200 border-dashed text-center space-y-4 max-w-[1600px] mx-auto w-full">
        <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Activity className="text-slate-350 animate-pulse" size={28} />
        </div>
        <div className="space-y-1">
          <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">
            {language === 'om' ? 'Koreen Qabxii Duudaadha' : 'No Performance Insights Yet'}
          </h4>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
            {language === 'om'
              ? 'Qormaata yaalii kamiyyuu xumuruun gabaasa qabxii fi xiinxala meeshichaa asirratti argadhu.'
              : 'Complete custom mock exams to automatically compile visual progress trajectory curves and subject proficiencies.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-fade-in text-left">
      {/* 1. Header Banner Area */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />
        
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border border-slate-800 shadow-sm flex items-center gap-1.5">
              <Sparkles size={11} className="text-amber-400 animate-pulse" />
              Biftu Beri Analytics Hub
            </span>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border border-indigo-150">
              {role === 'student' ? 'Student Workspace' : 'Staff Diagnostic Terminal'}
            </span>
          </div>

          <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-blue-600" size={26} />
            {role === 'student' 
              ? (language === 'om' ? 'Agarsiisa Gabaasa Kiyya' : 'My Performance Trajectory Profile')
              : (language === 'om' ? 'Gabaasa Gahumsa Barattootaa' : 'Academic Cohort Performance Hub')}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            {role === 'student'
              ? `Reviewing profile dataset matching ${userName} (${grade} ${stream})`
              : `Aggregating system-wide logs for Biftu Beri High School teachers`}
          </p>
        </div>

        {/* Filters and export settings */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                timeRange === 'all' 
                  ? 'bg-white text-slate-950 shadow-md border border-slate-200/80 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('10')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                timeRange === '10' 
                  ? 'bg-white text-slate-950 shadow-md border border-slate-200/80 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Last 10
            </button>
            <button
              onClick={() => setTimeRange('30')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                timeRange === '30' 
                  ? 'bg-white text-slate-950 shadow-md border border-slate-200/80 font-black' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Last 30
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="p-3 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 hover:text-slate-950 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Key High-level Performance Metrics Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Exams Completed */}
          <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Exams Completed</p>
              <p className="text-3xl font-black text-slate-950 tracking-tight">{stats.totalAttemptsCount}</p>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 leading-none pt-1">
                <CheckCircle size={10} />
                <span>100% Submission Accuracy</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition-transform duration-300">
              <BookOpenCheck size={20} />
            </div>
          </div>

          {/* Card 2: Average Score Percentage */}
          <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Average Score</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-black text-slate-950 tracking-tight">{stats.averageScorePercent}%</p>
                <p className="text-[10px] font-slate-500 font-bold uppercase">Accuracy</p>
              </div>
              <p className={`text-[10px] font-bold flex items-center gap-1 leading-none pt-1 ${
                stats.averageScorePercent >= 75 ? 'text-emerald-600' : 'text-blue-600'
              }`}>
                <Activity size={10} />
                <span>{stats.averageScorePercent >= 50 ? 'Compliant with standards' : 'Action plan suggested'}</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform duration-300">
              <Award size={20} />
            </div>
          </div>

          {/* Card 3: Class Pass Rate */}
          <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Pass Rate Index</p>
              <p className="text-3xl font-black text-slate-950 tracking-tight">{stats.passRatePercent}%</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none pt-1">
                Threshold: Scores &ge; 50%
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform duration-300">
              <TrendingUp size={20} />
            </div>
          </div>

          {/* Card 4: Security Violation Logs */}
          <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Security Flag Logs</p>
              <p className="text-3xl font-black text-slate-950 tracking-tight">{stats.totalViolations}</p>
              <p className={`text-[10px] font-black flex items-center gap-1 leading-none pt-1 uppercase ${
                stats.totalViolations > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'
              }`}>
                {stats.totalViolations > 0 ? '⚠️ High Switch-Tab Rate' : '✅ Pristine Integrity Profile'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300 ${
              stats.totalViolations > 0 
                ? 'bg-rose-50 border border-rose-100 text-rose-600' 
                : 'bg-slate-50 border border-slate-100 text-slate-400'
            }`}>
              <ShieldAlert size={20} />
            </div>
          </div>
        </div>
      )}

      {/* GRADE TARGET LEVELS CALIBRATION ENGINE */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[40px] border border-slate-850 shadow-xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-amber-500/5 rounded-full blur-[90px] pointer-events-none -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-800/80">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 bg-amber-500/25 text-amber-300 rounded-lg text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
              {language === 'om' ? 'Koreen Gahumsaa' : 'Target calibration'}
            </span>
            <h4 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Crown className="text-amber-400 shrink-0 animate-pulse" size={18} />
              {language === 'om' ? 'Sagantaa madaallii safartuu gahumsa qabxii (Grade Target Levels)' : 'National Grade Target Levels Calibration'}
            </h4>
            <p className="text-[10px] font-bold text-slate-405 uppercase tracking-widest leading-none mt-1">
              {language === 'om' ? 'Gahumsa qabxii seensa qormaata biyyoolessaaf safartuu benchmark filadhu' : 'Configure and evaluate mock readiness against standard EAES passing cohorts'}
            </p>
          </div>
          
          {/* Target Selector Buttons */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {[
              { level: 85, label: language === 'om' ? 'A (Olaanaa: 85%)' : 'Elite (85%)' },
              { level: 75, label: language === 'om' ? 'B (Gaarii: 75%)' : 'Superior (75%)' },
              { level: 55, label: language === 'om' ? 'C (Darbaa: 55%)' : 'Qualified (55%)' }
            ].map(btn => (
              <button
                key={btn.level}
                onClick={() => setTargetLevel(btn.level)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 border ${
                  targetLevel === btn.level 
                    ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-md font-black scale-105' 
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic target math analysis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-[24px] flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Passed Targets Enrolled</span>
            <div className="py-2.5">
              <strong className="text-3xl font-black text-white block font-mono">
                {subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length} <span className="text-xs font-normal text-slate-500">/ {subjectProficiencyData.length}</span>
              </strong>
              <span className="text-[9px] font-bold text-slate-400 block uppercase mt-0.5 tracking-wider">
                Subjects currently matching target {targetLevel}%
              </span>
            </div>
            {/* simple micro progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1 mt-2">
              <div 
                className="h-1 bg-amber-500 rounded-full transition-all duration-500" 
                style={{ width: `${(subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length / (subjectProficiencyData.length || 1)) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-[24px] flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Diagnostic Outlook</span>
            <div className="py-2.5">
              <strong className="text-sm font-black text-amber-400 block uppercase tracking-wide">
                {subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length === subjectProficiencyData.length
                  ? (language === 'om' ? '🎯 Guutummatti gahumsa qabda!' : '🎯 Target Fully Mastered!')
                  : subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length >= Math.ceil(subjectProficiencyData.length / 2)
                    ? (language === 'om' ? '⚡ Gahumsa Gaarii' : '⚡ On-Track with Core Focus')
                    : (language === 'om' ? '⚠️ Gargaarsa dabalataa barbaada' : '⚠️ Critical Support Needed')}
              </strong>
              <p className="text-[9px] font-bold text-slate-400 leading-normal mt-1.5">
                {subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length === subjectProficiencyData.length
                  ? (language === 'om' ? 'Barnoota hundaan gahumsa target kee garmalee galmeessiteetta. Itti fufi!' : 'Excellent! Your subject diagnostics exceed the calibrated target limits across all subjects.')
                  : (language === 'om' ? `Barnoota ${subjectProficiencyData.length - subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length} irratti dandeettii dabalataa dhiyeessi.` : `Improve scores in remaining ${subjectProficiencyData.length - subjectProficiencyData.filter(sub => sub.proficiency >= targetLevel).length} subjects to fulfill full target metrics.`)}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-[24px] relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-2 bottom-2 text-slate-800/20 font-black text-6xl pointer-events-none select-none">EAES</div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none font-mono">Interactive Benchmarking</span>
            <div className="py-2">
              <span className="text-[10px] font-bold text-slate-350 block leading-relaxed">
                {language === 'om' ? 'Gilgaalli qabxii dabalataa fi haalli qophii kee qabatamaan qorachuuf, sararri yaalii target irratti dabalamee jira.' : 'Your Chronological Curve visualizer now automatically embeds this orange target baseline for easy real-time accuracy analysis!'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Graphical Display Grid (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main interactive visualizer panel */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between min-h-[450px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-0.5">
              <h4 className="font-black text-slate-900 uppercase text-sm tracking-wide">Interactive Analytics Engine</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toggle visualizations dynamically to examine focus structures</p>
            </div>

            {/* Visualizer Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveChartTab('trends')}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeChartTab === 'trends' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                Chronology Curve
              </button>
              <button
                onClick={() => setActiveChartTab('subjects')}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeChartTab === 'subjects' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                Subject Proficiency
              </button>
              <button
                onClick={() => setActiveChartTab('distribution')}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  activeChartTab === 'distribution' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                Distribution
              </button>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartTab === 'trends' ? (
                // 1. CHRONOLOGY AREA CHART
                <AreaChart data={chronologicalTrendData} margin={{ top: 10, right: 30, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="dateStr" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: '800' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: '800' }}
                  />
                  <ReferenceLine 
                    y={targetLevel} 
                    stroke="#D97706" 
                    strokeDasharray="6 4" 
                    strokeWidth={2}
                    label={{ 
                      value: language === 'om' ? `Target: ${targetLevel}%` : `Target: ${targetLevel}%`, 
                      fill: '#D97706', 
                      fontSize: 9, 
                      fontWeight: '900', 
                      position: 'insideBottomRight',
                      offset: 12
                    }} 
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 shadow-2xl text-left text-xs font-bold space-y-1.5">
                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{data.dateStr}</p>
                            <p className="font-extrabold text-slate-100">{data.title}</p>
                            <div className="flex items-center gap-4 text-[10px] text-slate-300 pt-1 border-t border-slate-800">
                              <span>Subject: <strong className="text-white uppercase">{data.subject}</strong></span>
                              <span>Score: <strong className="text-white">{data.score}%</strong></span>
                            </div>
                            {role !== 'student' && (
                              <p className="text-[9px] text-slate-400 border-t border-slate-800/50 pt-1">By: {data.userName}</p>
                            )}
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
                    formatter={() => <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chronological Score trajectory (%)</span>}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#2563EB" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#scoreColor)" 
                    dot={{ fill: '#FFFFFF', stroke: '#2563EB', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#1E3A8A' }}
                  />
                </AreaChart>
              ) : activeChartTab === 'subjects' ? (
                // 2. RADAR CHART FOR SUBJECTS
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={subjectProficiencyData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: '900' }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={{ fill: '#94A3B8', fontSize: 8 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 text-white p-3 rounded-xl border border-slate-800 text-xs font-bold font-mono">
                            <span className="uppercase text-blue-400">{data.subject}</span>: {data.proficiency}%
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Radar 
                    name="Proficiency Level" 
                    dataKey="proficiency" 
                    stroke="#4F46E5" 
                    fill="#4F46E5" 
                    fillOpacity={0.35} 
                  />
                </RadarChart>
              ) : (
                // 3. SCORE DISTRIBUTION BARS
                <BarChart data={scoreDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: '800' }}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: '800' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 text-xs font-black">
                            {data.name}: {data.count} {data.count === 1 ? 'Exam' : 'Exams'}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {scoreDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-bold text-slate-500 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-2">
            <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
            <span>Interactive Tooltips enabled. Hover your pointer or tap nodes on mobile screens to review precise accuracy indicators.</span>
          </div>
        </div>

        {/* Small column: Right-Side Subject Proficiencies Breakdown */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-0.5 border-b border-slate-100 pb-4">
            <h4 className="font-black text-slate-900 uppercase text-sm tracking-wide">
              {language === 'om' ? 'Gahumsa Barnootaa' : 'Subject Diagnostics'}
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Syllabus level progress tracking
            </p>
          </div>

          <div className="space-y-4 max-h-[340px] overflow-y-auto no-scrollbar pr-1">
            {subjectProficiencyData.map((item, idx) => (
              <div key={idx} className="space-y-2 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-[10px] uppercase shrink-0">
                      {item.subject.substring(0, 2)}
                    </span>
                    <span className="text-xs font-black uppercase text-slate-800 truncate">{item.subject}</span>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-950 shrink-0">{item.proficiency}%</span>
                </div>

                {/* Simulated Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${item.proficiency}%`,
                      backgroundColor: item.proficiency >= 88 ? '#10B981' : item.proficiency >= 70 ? '#3B82F6' : item.proficiency >= 50 ? '#F59E0B' : '#EF4444'
                    }}
                  />
                </div>

                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-slate-400 capitalize">{item.count} {item.count === 1 ? 'attempt' : 'attempts'} completed</span>
                  <span>
                    {item.proficiency >= targetLevel ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-[6px] text-[7px] font-black uppercase tracking-wider">
                        {language === 'om' ? 'Target Gaar' : 'On Track'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-105 text-rose-700 border border-rose-100 rounded-[6px] text-[7px] font-black uppercase tracking-wider">
                        {language === 'om' ? `Gap: -${targetLevel - item.proficiency}%` : `Gap: -${targetLevel - item.proficiency}%`}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-5 rounded-[24px] shadow-lg border border-blue-950 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none -z-10" />
            <div className="flex items-center gap-2">
              <Sparkles className="text-yellow-400 shrink-0 animate-bounce" size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Study Strategy Recommendation</span>
            </div>
            <p className="text-[11px] font-bold text-slate-100 leading-normal">
              {stats && stats.averageScorePercent >= 75 
                ? (language === 'om' ? 'Gahumsi kee baay\'ee gaariidha! Qormaata biyaalessaa qoramuuf qophaa\'aa dha.' : 'Exceptional baseline performance. Prioritize Grade 12 National Mock exam scenarios to cement your confidence!')
                : (language === 'om' ? 'Maree fi shaakala haaraa dabalataatii beekumsa dabali.' : 'Boost scores by targeting subjects below 50%. Create an auxiliary focus schedule on our Remedial dashboard.')}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Subject Diagnostics Action table list */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-0.5">
            <h4 className="font-black text-slate-900 uppercase text-sm tracking-wide">Detailed Curriculum Recommendations</h4>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Subject mastery analysis mapped to remedial actions
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200">
            <ListTodo size={18} className="text-slate-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                <th className="p-4 rounded-l-2xl">Subject / Barnoota</th>
                <th className="p-4 text-center">Attempts</th>
                <th className="p-4 text-center">Score Average</th>
                <th className="p-4">Action Recommendation Status</th>
                <th className="p-4 text-center">Target Status ({targetLevel}%)</th>
                <th className="p-4 rounded-r-2xl">Recommended Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              {subjectProficiencyData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-extrabold uppercase">
                    No individual subject data compiled.
                  </td>
                </tr>
              ) : (
                subjectProficiencyData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-black text-slate-950 uppercase animate-fade-in">
                      {item.subject}
                    </td>
                    <td className="p-4 text-center text-slate-500 font-mono">
                      {item.count}
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center gap-1.5 font-black text-slate-950">
                        <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                          item.proficiency >= 88 ? 'bg-emerald-500' : item.proficiency >= 70 ? 'bg-blue-500' : item.proficiency >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        {item.proficiency}%
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1.5 border rounded-xl text-[10px] font-black uppercase tracking-wider ${item.badgeColor}`}>
                        {item.proficiency >= 88 ? 'EXCELLENT' : item.proficiency >= 70 ? 'STRENGTH' : item.proficiency >= 50 ? 'COMPLIANT' : 'CRITICAL WARNING'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {item.proficiency >= targetLevel ? (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider">
                          <CheckCircle size={11} className="text-emerald-600" />
                          <span>{language === 'om' ? 'Kore' : 'Achieved'}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider">
                          <AlertCircle size={11} className="text-rose-500" />
                          <span>-{targetLevel - item.proficiency}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {item.recommendation}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Cohort Analytics Grid (Optional for Admin/Teachers/Staff) */}
      {role !== 'student' && topPerformers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Top Performers Card */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 border border-amber-100">
                <Crown size={20} />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-slate-900 uppercase text-sm tracking-wide">Top Star Performers</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leading students of the current cohort</p>
              </div>
            </div>

            <div className="space-y-3.5 divide-y divide-slate-100">
              {topPerformers.map((student, idx) => (
                <div key={student.userId} className="flex items-center justify-between gap-4 pt-3.5 first:pt-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-black text-slate-905">{student.name}</span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{student.attempts} completed exams</p>
                    </div>
                  </div>
                  <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 font-black text-xs font-mono">
                    {student.average}% Avg
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Academic Integrity Distribution */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <ShieldAlert size={20} />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-slate-900 uppercase text-sm tracking-wide">Tab Compliance Distribution</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking security infractions during examinations</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Exam browser compliance keeps our mock platform fully authoritative & validated by Biftu Beri Secondary School academic councils.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block">Total Secure Exams</span>
                  <span className="text-2xl font-black text-slate-900">{completedAttempts.filter(a => (a.violations || 0) === 0).length}</span>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">Perfect Focus Compliance</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block">Failed Compliance Exams</span>
                  <span className="text-2xl font-black text-red-600">{completedAttempts.filter(a => (a.violations || 0) > 0).length}</span>
                  <p className="text-[9px] text-red-600 font-bold uppercase">Violation Log Recorded</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
