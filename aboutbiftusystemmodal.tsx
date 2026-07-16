import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Info, GraduationCap, Layers, ArrowRight, CheckCircle2, 
  Cpu, Database, ShieldCheck, Activity, Award, Check, Sparkles, AlertCircle
} from 'lucide-react';
import biftuExamBlueprint from '@/src/assets/images/biftu_exam_blueprint_1783272362738.jpg';

interface AboutBiftuSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'om';
}

export default function AboutBiftuSystemModal({ isOpen, onClose, language }: AboutBiftuSystemModalProps) {
  const [activeSegment, setActiveSegment] = useState<'mission' | 'flow' | 'architecture' | 'analytics'>('mission');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
        />

        {/* Modal Shell Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative bg-white w-full max-w-5xl rounded-[36px] overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[90vh] z-10"
        >
          {/* Header */}
          <div className="border-b border-slate-200 bg-slate-50 p-6 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 font-black">
                B
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">
                  {language === 'en' ? 'Biftu Beri Systems Blueprint' : 'Biftuu Barii Blueprint Ijaarsa'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {language === 'en' ? 'OPERATIONAL SPECIFICATIONS & FLOWS' : 'FAYIDAMA & YAALII SIISTEMAA'}
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-3 bg-white border-2 border-slate-200 hover:border-red-500 hover:text-red-500 hover:scale-105 active:scale-95 text-slate-500 rounded-full transition-all cursor-pointer shadow-sm"
              id="close_about_blueprint_modal_btn"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Segments / Tabs Header */}
          <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap gap-2 justify-center items-center">
            <button 
              onClick={() => setActiveSegment('mission')}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSegment === 'mission' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <GraduationCap size={14} />
              {language === 'en' ? '1. Academic Goals & Curriculums' : '1. Galma Barnootaa & Sagantaa'}
            </button>
            <button 
              onClick={() => setActiveSegment('flow')}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSegment === 'flow' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Activity size={14} />
              {language === 'en' ? '2. EAES Preparation Live Flow' : '2. Yaalii Qormaata EAES'}
            </button>
            <button 
              onClick={() => setActiveSegment('architecture')}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSegment === 'architecture' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Layers size={14} />
              {language === 'en' ? '3. Decoupled Architecture' : '3. Gurmaahina Dabarsa Kee'}
            </button>
            <button 
              onClick={() => setActiveSegment('analytics')}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeSegment === 'analytics' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Activity size={14} />
              {language === 'en' ? '4. Parent Portal & Analytics' : '4. Galmee Warraa & Xiinxala'}
            </button>
          </div>

          {/* Scrolling Content Shell */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            <AnimatePresence mode="wait">
              {activeSegment === 'mission' && (
                <motion.div
                  key="mission"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 text-left"
                >
                  {/* Mission Intro and Context */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-100 p-6 rounded-3xl space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                      <Sparkles size={12} />
                      {language === 'en' ? 'Grades 9 - 12 National Alignment' : 'Galma Barnoota Kutaa 9 - 12'}
                    </div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {language === 'en' 
                        ? 'Ethiopian Secondary School Grading & Mocks Goals' 
                        : 'Sagantaa Mookii fi Qabxii Qormaata Biyyoolessaa'}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                      {language === 'en'
                        ? 'The Biftu Beri portal was engineered to eliminate standard structural barriers in secondary high school monitoring systems. By implementing a standardized bilingual testing dashboard paired with auto-calculated report compilers, we secure optimal national assessment outcomes.'
                        : 'Siistemiin Biftuu Barii gufuulee qabxii qabuufi qorannoo barattootaa salphisuuf kan ijaarameedha. Faayiloota Afaan Oromoo bilisa ta\'aniin hojjetaman qabxii mookii barsiistota dandeettii qoraniif humna guddaa uuma.'}
                    </p>
                  </div>

                  {/* High school division cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="border-2 border-slate-900 rounded-3xl p-5 space-y-3 bg-white">
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                        {language === 'en' ? 'Grades 9 & 10 (General Foundation)' : 'Kutaa 9 & 10 (Sagantaa Bu\'uraa)'}
                      </span>
                      <h5 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">Syllabus Practice Accents</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Prepares students with core concept evaluations in basic sciences (Biology, Chemistry, Physics) and languages (Afaan Oromoo, English). Establishes basic exam time-management disciplines with general high-frequency MCQ structures.
                      </p>
                      <ul className="text-[11px] text-slate-500 space-y-2 font-medium">
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Basic assessment metrics & key rationales.</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Unified bilingual dictionary alignment tags.</li>
                      </ul>
                    </div>

                    <div className="border-2 border-slate-900 rounded-3xl p-5 space-y-3 bg-white">
                      <span className="text-[10px] bg-red-100 text-red-800 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                        {language === 'en' ? 'Grades 11 & 12 (Natural & Social Streams)' : 'Kutaa 11 & 12 (Sayinsii Saayinsii & Haasawaa)'}
                      </span>
                      <h5 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">National Examination (EAES) Target Readiness</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Renders hyper-realistic mocks designed exactly after official Ethiopian National Assessment templates (30 Mid points / 70 Final points). Embeds real-time behavioral alerts like focus loss detection.
                      </p>
                      <ul className="text-[11px] text-slate-500 space-y-2 font-medium">
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Automatic score scaling from 100 points down to match transcripts.</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Natural & Social academic streams custom subjects sets.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Scholastic Promotional Rules Banner */}
                  <div className="border border-slate-200 p-4.5 rounded-2xl bg-slate-50 text-xs text-slate-700 leading-relaxed text-left flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 flex items-center justify-center font-extrabold text-slate-700">
                      I
                    </div>
                    <div className="space-y-1">
                      <strong className="block text-slate-900 font-extrabold uppercase tracking-tight">Oromia Standard Scholastic Promotion Schema</strong>
                      <span>
                        Semester marks are calculated dynamically using the <strong>30-point evaluation (Mid) + 70-point evaluation (Final)</strong> parameters. An annual average score <code>&gt;= 50%</code> combined with passing a majority of subjects results in an overall <strong>PROMOTED / DARBE</strong> standing. Otherwise, the status is flagged as <strong>RETAINED / KUFE</strong>.
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSegment === 'flow' && (
                <motion.div
                  key="flow"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8 text-left"
                >
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {language === 'en' ? 'Interactive EAES Preparation Pipeline' : 'Garaa Yaalii Qormaata EAES'}
                    </h4>
                    <p className="text-xs text-slate-700 leading-normal font-semibold">
                      This interactive sequential flowchart illustrates the robust lifecycle of an exam - from initial AI administrative synthesis down to security-stamped student report compiling.
                    </p>
                  </div>

                  {/* FLOW DIAGRAM (VISUAL TIMELINE CONTAINER) */}
                  <div className="border-2 border-slate-900 rounded-3xl p-6 md:p-8 bg-slate-950 text-white space-y-8 shadow-inner overflow-x-auto">
                    <div className="flex items-center justify-between min-w-[750px]">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest font-mono">BIFTU SYS STAGES</span>
                        <h5 className="font-extrabold text-sm uppercase tracking-tight text-white leading-none mt-1">Lifecycle Funnel (5-Phase Pipeline)</h5>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg animate-pulse">
                        Synchronized
                      </span>
                    </div>

                    {/* Step Map Stepper Grid */}
                    <div className="grid grid-cols-5 gap-4 min-w-[780px] pt-4 relative">
                      
                      {/* Connector Line across elements */}
                      <div className="absolute top-11 inset-x-8 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 -z-10" />

                      {/* Phase 1: Generation */}
                      <div className="space-y-3 text-center flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-blue-500 flex items-center justify-center font-black text-base text-blue-400 shadow-lg shadow-blue-500/10 hover:scale-105 duration-200">
                          AI
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-blue-400 uppercase font-mono">PHASE 1</p>
                          <h6 className="font-extrabold text-[11px] uppercase tracking-tight leading-none text-white">AI Forge</h6>
                          <p className="text-[9px] text-slate-400 line-clamp-3">Teacher builds test forms securely via Gemini API</p>
                        </div>
                      </div>

                      {/* Phase 2: Playing */}
                      <div className="space-y-3 text-center flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-indigo-500 flex items-center justify-center font-black text-base text-indigo-400 shadow-lg shadow-indigo-500/10 hover:scale-105 duration-200">
                          120'
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-indigo-400 uppercase font-mono">PHASE 2</p>
                          <h6 className="font-extrabold text-[11px] uppercase tracking-tight leading-none text-white">Live Simulator</h6>
                          <p className="text-[9px] text-slate-400 line-clamp-3">Student plays exam under interactive timer monitors</p>
                        </div>
                      </div>

                      {/* Phase 3: Telemetry Submission */}
                      <div className="space-y-3 text-center flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-violet-500 flex items-center justify-center font-black text-base text-violet-400 shadow-lg shadow-violet-500/10 hover:scale-105 duration-200">
                          SUB
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-violet-400 uppercase font-mono">PHASE 3</p>
                          <h6 className="font-extrabold text-[11px] uppercase tracking-tight leading-none text-white">Live Attempt</h6>
                          <p className="text-[9px] text-slate-400 line-clamp-3">Submission triggers instant grading with specific rationales</p>
                        </div>
                      </div>

                      {/* Phase 4: Live Compiler Compilation */}
                      <div className="space-y-3 text-center flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-amber-500 flex items-center justify-center font-black text-base text-amber-400 shadow-lg shadow-amber-500/10 hover:scale-105 duration-200">
                          SYNC
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-amber-400 uppercase font-mono">PHASE 4</p>
                          <h6 className="font-extrabold text-[11px] uppercase tracking-tight leading-none text-white">Report Compile</h6>
                          <p className="text-[9px] text-slate-400 line-clamp-3">Attempts list scales & maps proportionally to report cards</p>
                        </div>
                      </div>

                      {/* Phase 5: Result / Stamp Verification */}
                      <div className="space-y-3 text-center flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-emerald-500 flex items-center justify-center font-black text-base text-emerald-400 shadow-lg shadow-emerald-500/10 hover:scale-105 duration-200">
                          PDF
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-emerald-400 uppercase font-mono">PHASE 5</p>
                          <h6 className="font-extrabold text-[11px] uppercase tracking-tight leading-none text-white">Sealed Report</h6>
                          <p className="text-[9px] text-slate-400 line-clamp-3">Parents download certified PDF transcripts with seals</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Sync logic explanation banner */}
                  <div className="bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl flex items-start gap-3.5 text-xs text-blue-800 font-medium">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Dynamic Offline-to-Online Compiler Note:</strong> Standard classroom 30/70 grades are recorded manually or imported via CSV templates by subject teachers. If a student sits for an online mock exam or national practice item, our compilers automatically fetch their attempt doc, identify the Term slot by checking for keywords (e.g. <em>Term 2</em>, <em>Semester 2</em>), scale the score proportionally, and display it seamlessly on report cards without redundant manual updates.
                    </p>
                  </div>
                </motion.div>
              )}

              {activeSegment === 'architecture' && (
                <motion.div
                  key="architecture"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 text-left"
                >
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {language === 'en' ? 'Decoupled Systems Architecture Overview' : 'Haala Gurmaahina Decoupled'}
                    </h4>
                    <p className="text-xs text-slate-700 leading-normal font-semibold">
                      Ensures maximum credential privacy and resilient performance over Oromia high school networks.
                    </p>
                  </div>

                  {/* System Architecture Blueprint Visual */}
                  <div className="border-4 border-slate-900 rounded-[30px] p-2 bg-white shadow-md overflow-hidden">
                    <img 
                      src={biftuExamBlueprint} 
                      alt="Biftu Beri Exam System Blueprint"
                      className="w-full rounded-[22px] select-none pointer-events-none hover:scale-[1.01] transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Architecture Diagram Graph */}
                  <div className="border-4 border-slate-900 rounded-[30px] p-6 bg-slate-50 space-y-6">
                    <div className="text-center">
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest font-mono">BIFTU BERI LOGICAL DATA FLOWS</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                      
                      {/* Client View Container (React Frontend) */}
                      <div className="border border-slate-300 rounded-2xl bg-white p-4.5 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Cpu size={16} className="text-blue-600 shrink-0" />
                          <h6 className="font-extrabold text-[12px] uppercase text-slate-900 leading-none">Vite React Frontend</h6>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Handles responsive layout rendering on <strong>Port 3000</strong>. Features instant Afaan Oromoo/English translations, timed test components with timer modules, and printable PDF transcript generation.
                        </p>
                      </div>

                      {/* Decoupled Express Server Proxy Container */}
                      <div className="border border-slate-300 rounded-2xl bg-white p-4.5 space-y-3 relative shadow-sm">
                        <div className="absolute right-[-14px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-slate-300 bg-white flex items-center justify-center font-bold text-xs shadow-sm z-10 hidden md:flex">
                          &rarr;
                        </div>
                        <div className="absolute left-[-14px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-slate-300 bg-white flex items-center justify-center font-bold text-xs shadow-sm z-10 hidden md:flex">
                          &larr;
                        </div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                          <h6 className="font-extrabold text-[12px] uppercase text-slate-900 leading-none">Express Runtime Proxy</h6>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Bypasses direct client-browser vulnerability for Gemini API lines. Relays proxy requests securely and masks access keys so students cannot access administrative credentials.
                        </p>
                      </div>

                      {/* Firebase / Cloud database container */}
                      <div className="border border-slate-300 rounded-2xl bg-white p-4.5 space-y-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Database size={16} className="text-emerald-600 shrink-0" />
                          <h6 className="font-extrabold text-[12px] uppercase text-emerald-900 leading-none">Cloud Firestore DB</h6>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Synchronizes double-semester records mapped directly under <code>/users</code>, <code>/exams</code>, <code>/attempts</code>, and <code>/marks</code> collections. Encures student grades are securely backed up.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* File Collections Matrix */}
                  <div className="space-y-3 pt-2">
                    <h5 className="font-black text-sm text-slate-900 uppercase tracking-tight">Structured Firebase Collections Mapping:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50 space-y-1 text-xs">
                        <strong className="block text-slate-900 uppercase font-extrabold tracking-wider">/users (Student Profiles)</strong>
                        <p className="text-slate-500 text-[11px]">
                          Stores student identifiers (SID), full names, grade levels (9–12), and active natural/social academic stream values. Correctly indexes authentication variables.
                        </p>
                      </div>

                      <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50 space-y-1 text-xs">
                        <strong className="block text-slate-900 uppercase font-extrabold tracking-wider">/marks (Classroom Gradebook)</strong>
                        <p className="text-slate-500 text-[11px]">
                          Stores manual or CSV-uploaded classroom evaluations. Distinguishes assessments as 30-point Mid exams and 70-point Finals mapped per semester term (term_1 / term_2).
                        </p>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}

              {activeSegment === 'analytics' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8 text-left"
                >
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {language === 'en' ? 'Parent Transparency & Real-time Analytics' : 'Xiinxala fi Gabaasa Warraa'}
                    </h4>
                    <p className="text-xs text-slate-700 leading-normal font-semibold">
                      Bridging the gap between school assessments and home monitoring through automated data pipelines.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 space-y-4 shadow-sm">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                        <Activity size={24} />
                      </div>
                      <h5 className="font-black text-sm uppercase tracking-tight text-slate-900">Domain Mastery Tracking</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Parents can view which specific subjects or syllabus domains (e.g., Quantum Physics vs Mechanics) their child is excelling in or needs more focus on, based on recent mock exam behavioral telemetry.
                      </p>
                    </div>

                    <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 space-y-4 shadow-sm">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                        <Award size={24} />
                      </div>
                      <h5 className="font-black text-sm uppercase tracking-tight text-slate-900">Certified Digital Transcripts</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Automatic generation of semester report cards in PDF format. Includes school stamps, teacher comments, and GPA calculations scaled exactly to the Oromia Educational Bureau standards.
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-100 p-5 rounded-3xl flex items-start gap-4">
                    <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Automated Notification System</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Whenever a new national mock exam is published or a final semester grade is compiled, the system triggers real-time status updates on the parent dashboard, ensuring no student is left behind due to communication delays.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer controls */}
          <div className="border-t border-slate-200 bg-slate-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
            <div className="text-left font-sans flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {language === 'en' ? 'BIFTU BERI WEB DEPLOYMENT SECURE' : 'MALLITTOO BIFTUU BARII SECURE'}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-950 hover:bg-slate-800 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md"
              id="confirm_system_blueprint_close_btn"
            >
              {language === 'en' ? 'Acknowledge & Close' : 'Hubadheera & Cufi'}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
