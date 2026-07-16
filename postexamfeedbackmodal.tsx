import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Smile, Meh, Frown, AlertCircle, Sparkles } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';

interface PostExamFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  attemptId: string;
  subject: string;
}

type DifficultyLevel = 'very-easy' | 'easy' | 'average' | 'hard' | 'very-hard';

export function PostExamFeedbackModal({ 
  isOpen, 
  onClose, 
  examId, 
  attemptId, 
  subject 
}: PostExamFeedbackModalProps) {
  const { user } = useAuth();
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const options: { level: DifficultyLevel; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { 
      level: 'very-easy', 
      label: "Baay'ee Salphaa", 
      icon: <Sparkles size={20} />, 
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    { 
      level: 'easy', 
      label: "Salphaa", 
      icon: <Smile size={20} />, 
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    { 
      level: 'average', 
      label: "Giddu-galeessa", 
      icon: <Meh size={20} />, 
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    { 
      level: 'hard', 
      label: "Ulfaataa", 
      icon: <Frown size={20} />, 
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    { 
      level: 'very-hard', 
      label: "Baay'ee Ulfaataa", 
      icon: <AlertCircle size={20} />, 
      color: 'text-rose-600',
      bg: 'bg-rose-50'
    },
  ];

  const handleSubmit = async () => {
    if (!selectedDifficulty || !user) return;

    setSubmitting(true);
    try {
      const feedbackPath = `attempts/${attemptId}/feedback`;
      const feedbackPayload = {
        userId: user.uid,
        userEmail: user.email || '',
        examId,
        attemptId,
        subject,
        difficulty: selectedDifficulty,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      };

      // Save top-level feedback copy for easy admin reporting
      await addDoc(collection(db, 'feedbacks'), feedbackPayload);

      // Save nested attempt-specific feedback
      await addDoc(collection(db, feedbackPath), feedbackPayload);
      
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        // Reset after modal closes
        setTimeout(() => {
            setSubmitted(false);
            setSelectedDifficulty(null);
            setComment('');
        }, 300);
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `attempts/${attemptId}/feedback`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl shadow-slate-900/10 overflow-hidden border border-slate-100"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Yaada Keessan Qoodaa</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    Post-Exam Difficulty Feedback • {subject}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 pt-4 space-y-8">
              {submitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 text-center space-y-4"
                >
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={40} />
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Galatoomaa!</h4>
                  <p className="text-sm font-medium text-slate-500">Yaanni keessan milkaa'inaan nu ga'eera. Kun barsiisotni keenya qophii dabalataaf akka nu gargaaru nun gargaara.</p>
                </motion.div>
              ) : (
                <>
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      Qormaanni kun dandeettii keetiif akkam ture?
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {options.map((opt) => (
                        <button
                          key={opt.level}
                          onClick={() => setSelectedDifficulty(opt.level)}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                            selectedDifficulty === opt.level
                              ? `border-blue-600 ${opt.bg} shadow-md`
                              : 'border-slate-100 hover:border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl border ${selectedDifficulty === opt.level ? 'bg-white border-blue-200 text-blue-600' : `bg-slate-50 border-slate-100 ${opt.color}`} group-hover:scale-110 transition-transform`}>
                              {opt.icon}
                            </div>
                            <span className={`text-sm font-black uppercase tracking-tight ${selectedDifficulty === opt.level ? 'text-blue-700' : 'text-slate-600'}`}>
                              {opt.label}
                            </span>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedDifficulty === opt.level ? 'border-blue-600 bg-blue-600' : 'border-slate-200'
                          }`}>
                            {selectedDifficulty === opt.level && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Yaada dabalataa (Optional / Filannoo)
                    </p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Maaloo yaada dabalataa yoo qabaattan asitti barreessaa..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[24px] text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none h-24 font-medium"
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!selectedDifficulty || submitting}
                    className={`w-full py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                      !selectedDifficulty || submitting
                        ? 'bg-slate-100 text-slate-400 shadow-none grayscale cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10 active:scale-95'
                    }`}
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        Ergaa Ergi
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Yaanni keessi bifa iccitii ta'een barsiisotaaf qoodama.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
