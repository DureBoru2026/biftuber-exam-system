import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Presentation, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Layout, 
  Type, 
  FileText,
  Monitor,
  Printer,
  FileCode
} from 'lucide-react';

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  notes: string;
}

const DEFAULT_SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Biftu Beri Secondary School Examination and Grading Portal',
    subtitle: 'Biftu Beri Secondary School Portal',
    bullets: ['Centralized Grade Management', 'Real-time Student Insights', 'Automated Assessment Workflows'],
    notes: 'Introductory slide for the school administration.'
  },
  {
    id: '2',
    title: 'The Core Educational Bottlenecks',
    subtitle: 'Current Challenges in Grading',
    bullets: ['Manual Error Rates', 'Slow Result Processing', 'Low Transparency'],
    notes: 'Defining the problem space.'
  },
  {
    id: '3',
    title: 'The Modern Decoupled Architecture',
    subtitle: 'System Design Overview',
    bullets: ['Cloud-Native Backend', 'Biftu Beri Integration Engine', 'Real-time Sync'],
    notes: 'Technical structure of the platform.'
  },
  {
    id: '4',
    title: 'The 30/70 Scholastic Schema',
    subtitle: 'National Grading Standards',
    bullets: ['Continuous Assessment (30%)', 'Final Examination (70%)', 'Automated Weighting'],
    notes: 'How the grading logic is implemented.'
  },
  {
    id: '5',
    title: 'Functional Roles Matrix & Live Demo',
    subtitle: 'Permissions and Access Control',
    bullets: ['Admin: Master Control', 'Student: Assessment View', 'Parent: Insight Dashboard'],
    notes: 'Explaining the user ecosystem.'
  },
  {
    id: '6',
    title: 'Technical Excellence & Deployment Gain',
    subtitle: 'Future-Proofing Education',
    bullets: ['99.9% Result Accuracy', 'Zero Paper Waste', 'Instant Analytics'],
    notes: 'Conclusion and benefits.'
  }
];

export const SlideBuilder: React.FC = () => {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [theme, setTheme] = useState<'cosmic' | 'academic'>('cosmic');
  const [editMode, setEditMode] = useState(true);
  const [presentMode, setPresentMode] = useState(false);

  const addSlide = () => {
    const newSlide: Slide = {
      id: Date.now().toString(),
      title: 'New Academic Slide Topic',
      subtitle: 'Biftu Beri Secondary School Subtitle',
      bullets: ['First primary academic benchmark line entry.', 'Second custom indicator or evaluation metric.'],
      notes: 'Speaker guide notes for presenting this newly generated custom slide.'
    };
    setSlides([...slides, newSlide]);
    setCurrentIndex(slides.length);
  };

  const removeSlide = (id: string) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter(s => s.id !== id);
    setSlides(newSlides);
    if (currentIndex >= newSlides.length) setCurrentIndex(newSlides.length - 1);
  };

  const updateSlide = (field: keyof Slide, value: any) => {
    const newSlides = [...slides];
    newSlides[currentIndex] = { ...newSlides[currentIndex], [field]: value };
    setSlides(newSlides);
  };

  const currentSlide = slides[currentIndex];

  const exportMD = () => {
    const content = slides.map(s => `# ${s.title}\n## ${s.subtitle}\n\n${s.bullets.map(b => `- ${b}`).join('\n')}\n\n---\n`).join('\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation_bbs2.md';
    a.click();
  };

  if (presentMode) {
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black`}>
        <div className={`w-full h-full max-w-7xl max-h-screen rounded-[40px] shadow-2xl overflow-hidden relative border-4 border-white/5 ${theme === 'cosmic' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
          <div className="absolute top-8 right-8 flex items-center gap-4 z-[110]">
            <button 
              onClick={() => setPresentMode(false)}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all font-black text-[10px] uppercase tracking-widest border border-white/20"
            >
              Exit Presentation (ESC)
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100, filter: 'blur(20px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -100, filter: 'blur(20px)' }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-0 p-12 md:p-32 flex flex-col justify-center"
            >
              {theme === 'cosmic' && (
                <div className="absolute inset-0 opacity-40 pointer-events-none">
                  <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600 rounded-full blur-[160px]" />
                  <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600 rounded-full blur-[160px]" />
                </div>
              )}

              <div className="relative z-10 space-y-12">
                <div className="flex items-center gap-6 text-blue-500 font-black uppercase tracking-[0.4em] text-xs">
                  <span className="w-16 h-1 bg-current rounded-full" />
                  Biftu Beri Scholastic Schema
                </div>
                <h1 className={`text-6xl md:text-8xl font-black uppercase tracking-tight leading-[0.85] max-w-5xl ${theme === 'cosmic' ? 'text-white' : 'text-slate-900'}`}>
                  {currentSlide.title}
                </h1>
                <p className={`text-2xl md:text-4xl font-medium opacity-60 italic ${theme === 'cosmic' ? 'text-blue-100' : 'text-slate-500'}`}>
                  {currentSlide.subtitle}
                </p>
                <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {currentSlide.bullets.map((bullet, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + (0.1 * idx) }}
                      key={idx} 
                      className={`flex items-start gap-6 p-8 rounded-[32px] ${theme === 'cosmic' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}
                    >
                      <div className="mt-2 w-3 h-3 rounded-full bg-blue-500 shrink-0 shadow-lg shadow-blue-500/50" />
                      <span className="text-xl font-bold leading-tight opacity-90">{bullet}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-12 left-12 right-12 flex justify-between items-center opacity-40 text-xs font-black uppercase tracking-[0.3em]">
                 <span>© BIFTU BERI SECONDARY SCHOOL 2026</span>
                 <span>PAGINA 0{currentIndex + 1} / 0{slides.length}</span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="absolute inset-x-0 bottom-24 flex justify-between px-12 pointer-events-none">
            <button 
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className={`p-6 bg-white/10 backdrop-blur-xl rounded-full text-white hover:bg-white/20 transition-all border border-white/20 pointer-events-auto disabled:opacity-0 ${currentIndex === 0 ? 'pointer-events-none' : ''}`}
            >
              <ChevronLeft size={32} />
            </button>
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(slides.length - 1, prev + 1))}
              disabled={currentIndex === slides.length - 1}
              className={`p-6 bg-white/10 backdrop-blur-xl rounded-full text-white hover:bg-white/20 transition-all border border-white/20 pointer-events-auto disabled:opacity-0 ${currentIndex === slides.length - 1 ? 'pointer-events-none' : ''}`}
            >
              <ChevronRight size={32} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Generator Workspace</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Digital Slide Deck Builder</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setPresentMode(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Monitor size={14} /> Present Live
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button 
            onClick={() => setTheme('cosmic')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'cosmic' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
          >
            Dark Cosmic
          </button>
          <button 
            onClick={() => setTheme('academic')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'academic' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            Light Academic
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Slide List Sidebar */}
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slides Registry ({slides.length})</span>
              <button 
                onClick={addSlide}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-full group relative p-4 rounded-2xl text-left border transition-all cursor-pointer ${currentIndex === idx ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                >
                  <span className="text-[8px] font-bold opacity-40 uppercase mb-1 block">#0{idx + 1}</span>
                  <span className="text-[11px] font-black uppercase tracking-tight line-clamp-1">{slide.title}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeSlide(slide.id); }}
                    className="absolute right-2 top-2 p-1.5 opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-[32px] p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-500/20 rounded-xl">
                 <Download size={18} className="text-blue-400" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest">Export Live Files</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={exportMD} className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
                <span className="text-[10px] font-bold opacity-80 uppercase">Marp Slide Pitch (.md)</span>
                <FileCode size={14} className="text-blue-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
                <span className="text-[10px] font-bold opacity-80 uppercase">Interactive HTML Deck</span>
                <Monitor size={14} className="text-emerald-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10">
                <span className="text-[10px] font-bold opacity-80 uppercase">Print Landscape PDF</span>
                <Printer size={14} className="text-purple-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview / Canvas */}
        <div className="xl:col-span-9 space-y-8">
          <div className={`aspect-video w-full rounded-[40px] shadow-2xl overflow-hidden relative border-4 border-slate-900/5 group ${theme === 'cosmic' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900 border-slate-200'}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 1.05 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0 p-12 md:p-20 flex flex-col justify-center"
              >
                {/* Background Decorations */}
                {theme === 'cosmic' && (
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-600 rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-600 rounded-full blur-[120px]" />
                  </div>
                )}

                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-4 text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">
                    <span className="w-12 h-0.5 bg-current rounded-full" />
                    Biftu Beri Academic Research Core
                  </div>
                  <h1 className={`text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95] max-w-4xl ${theme === 'cosmic' ? 'text-white' : 'text-slate-900'}`}>
                    {currentSlide.title}
                  </h1>
                  <p className={`text-lg md:text-xl font-medium opacity-60 italic ${theme === 'cosmic' ? 'text-blue-100' : 'text-slate-500'}`}>
                    {currentSlide.subtitle}
                  </p>
                  <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentSlide.bullets.map((bullet, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * idx }}
                        key={idx} 
                        className={`flex items-start gap-4 p-4 rounded-2xl ${theme === 'cosmic' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200 shadow-sm'}`}
                      >
                        <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-sm font-bold leading-tight opacity-80">{bullet}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-8 left-12 right-12 flex justify-between items-center opacity-40 text-[10px] font-black uppercase tracking-widest">
                   <span>© BIFTU BERI SCHOLASTIC SCHEMA 2026</span>
                   <span>SLIDE 0{currentIndex + 1} / 0{slides.length}</span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Overlay */}
            <div className="absolute inset-x-0 bottom-12 flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all">
               <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
               >
                 <ChevronLeft size={24} />
               </button>
               <button 
                onClick={() => setCurrentIndex(prev => Math.min(slides.length - 1, prev + 1))}
                className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/20"
               >
                 <ChevronRight size={24} />
               </button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-xl space-y-10">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Layout size={24} />
               </div>
               <div>
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Slide Workbench</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Edit Layout & Parameters</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Type size={12} /> Slide Title
                  </label>
                  <input
                    type="text"
                    value={currentSlide.title}
                    onChange={(e) => updateSlide('title', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm uppercase tracking-tight focus:bg-white transition-all outline-none text-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Type size={12} /> Slide Subtitle
                  </label>
                  <input
                    type="text"
                    value={currentSlide.subtitle}
                    onChange={(e) => updateSlide('subtitle', e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm focus:bg-white transition-all outline-none text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={12} /> Slide Bullets (separate by line)
                  </label>
                  <textarea
                    value={currentSlide.bullets.join('\n')}
                    onChange={(e) => updateSlide('bullets', e.target.value.split('\n').filter(b => b.trim()))}
                    rows={4}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm focus:bg-white transition-all outline-none text-slate-600 resize-none"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={12} /> Speaker Script / Note
                  </label>
                  <textarea
                    value={currentSlide.notes}
                    onChange={(e) => updateSlide('notes', e.target.value)}
                    rows={12}
                    placeholder="Enter private notes for this slide..."
                    className="w-full px-5 py-4 bg-slate-900 border border-slate-800 rounded-3xl font-mono text-[11px] leading-relaxed text-indigo-300/80 focus:bg-slate-950 transition-all outline-none resize-none shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
