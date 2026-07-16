import React, { useState } from 'react';
import { Sparkles, X, Loader2, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateQuestionsFromTopic, ExtractedQuestion } from '../services/aiService';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface AIGeneratorProps {
  onGenerated: (questions: ExtractedQuestion[]) => void;
  onClose: () => void;
  initialSubject?: string;
  initialGrade?: string;
}

export default function AIGenerator({ onGenerated, onClose, initialSubject = 'General', initialGrade = '12' }: AIGeneratorProps) {
  const { t } = useLanguage();
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [grade, setGrade] = useState(initialGrade);
  const [difficulty, setDifficulty] = useState('Medium');
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadingMessage, setLoadingMessage] = useState('Generating focus...');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    
    // Rotate messages to improve perceived speed
    const messages = ['Analyzing academic standards...', 'Crafting pedagogical distractors...', 'Verifying factual integrity...', 'Balancing difficulty weights...', 'Formatting digital output...'];
    let msgIdx = 0;
    const interval = setInterval(() => {
      setLoadingMessage(messages[msgIdx++ % messages.length]);
    }, 2500);

    try {
      const questions = await generateQuestionsFromTopic(topic, count, subject, grade, difficulty);
      onGenerated(questions);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      clearInterval(interval);
      setLoadingMessage('Generating focus...');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white"
      >
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-200">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">AI Question Engine</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Generate Academic Content instantly</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6 md:col-span-2">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Target Topic / Chapter</label>
                <div className="relative">
                  <BrainCircuit className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Nervous System, Quadratic Equations, Industrial Revolution..."
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-purple-500/10 outline-none font-bold text-slate-900 transition-all"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Subject Area</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Biology"
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-purple-500/10 outline-none font-bold text-slate-900 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Grade Level</label>
                <select 
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-purple-500/10 outline-none font-bold text-slate-900"
                >
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">{t('admin.questionsCount')}</label>
                <select 
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-purple-500/10 outline-none font-bold text-slate-900"
                >
                  {[5, 10, 20, 30, 40, 50, 60].map(n => (
                    <option key={n} value={n}>{n} {t('nav.exams')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">{t('admin.difficulty')}</label>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-1">
                  {['Easy', 'Medium', 'Hard'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setDifficulty(lvl)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        difficulty === lvl 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {t(`admin.${lvl.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  disabled={generating || !topic.trim() || !subject.trim()}
                  onClick={handleGenerate}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 h-[60px]"
                >
                  {generating ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-purple-400" />
                      {loadingMessage}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="text-purple-400" />
                      Run AI Engine
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100"
            >
              {error}
            </motion.div>
          )}
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-100 flex items-center justify-center gap-8">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model: Gemini 1.5 Flash</p>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-blue-500"></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode: Academic Precision</p>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
