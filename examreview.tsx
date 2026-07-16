import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Exam, Question } from '../types';
import { ArrowLeft, CheckCircle2, XCircle, Info, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

export default function ExamReview() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!examId) return;
      try {
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (examDoc.exists()) {
          setExam({ id: examDoc.id, ...examDoc.data() } as Exam);
          const qSnapshot = await getDocs(query(collection(db, 'exams', examId, 'questions'), orderBy('orderIndex', 'asc')));
          setQuestions(qSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
        }
      } catch (error) {
        console.error("Error loading review:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [examId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f5fc] flex items-center justify-center text-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-black text-xs uppercase tracking-widest text-slate-500">Preparing Review...</p>
        </div>
      </div>
    );
  }

  if (!exam) return <div>Exam not found</div>;

  return (
    <div className="min-h-screen bg-[#f0f5fc]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-6 flex items-center justify-between h-24">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-[0.2em] transition-all px-6 py-3 rounded-2xl border-2 border-slate-100 hover:border-slate-200"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="text-center group">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{exam.title}</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-1">{exam.subject} • Grade {exam.grade}</p>
          </div>
          <div className="hidden sm:flex items-center gap-4">
             <div className="px-5 py-2.5 bg-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">
               {questions.length} Items
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[48px] p-12 text-white shadow-2xl shadow-blue-500/15 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,#2563eb_0%,transparent_50%)] opacity-20"></div>
          <div className="relative z-10 text-center md:text-left">
            <h2 className="text-5xl font-black mb-4 tracking-tighter">Answer Key</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-sm">Detailed breakdown of correct answers and educational explanations.</p>
          </div>
          <div className="p-8 bg-white/10 backdrop-blur-xl rounded-[32px] border border-white/10 relative z-10">
            <Trophy size={64} className="text-amber-400" />
          </div>
        </div>

        {exam.description && (
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Exam Instructions</h3>
            <p className="text-slate-600 font-medium leading-relaxed">{exam.description}</p>
          </div>
        )}

        <div className="space-y-8">
          {questions.map((q, idx) => (
            <motion.div 
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-2xl font-black text-sm">
                  {idx + 1}
                </div>
                <div className="space-y-6 flex-grow">
                  <h3 className="text-xl font-black text-slate-900 leading-tight">{q.text}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => (
                      <div 
                        key={oIdx}
                        className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between gap-4 ${
                          oIdx === q.correctOptionIndex 
                            ? 'bg-green-50 border-green-200 text-green-900' 
                            : 'bg-slate-50 border-transparent text-slate-500 opacity-60'
                        }`}
                      >
                        <span className="font-bold">{opt}</span>
                        {oIdx === q.correctOptionIndex && (
                          <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                        )}
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4">
                      <Info className="text-amber-500 flex-shrink-0" size={20} />
                      <div>
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Explanation</p>
                        <p className="text-amber-900 text-sm font-bold leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
