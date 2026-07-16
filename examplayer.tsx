import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  increment,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { Exam, Question, ExamAttempt, Answer } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  AlertTriangle, 
  AlertCircle,
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  Sparkles,
  Circle,
  XCircle,
  Info,
  Brain,
  Loader2,
  BookOpen,
  ShieldCheck,
  LogIn,
  LogOut
} from 'lucide-react';
import { formatDuration } from '@/src/lib/utils';
import { format } from 'date-fns';
import { normalizeSubject } from '../constants';
import { generateImprovementTips } from '../services/aiService';

export default function ExamPlayer() {
  const { examId, attemptId } = useParams();
  const isReviewMode = !!attemptId || window.location.pathname.includes('/review') || new URLSearchParams(window.location.search).get('mode') === 'review';
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(attemptId || null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [showFiveMinWarning, setShowFiveMinWarning] = useState(false);
  const [fiveMinWarningTriggered, setFiveMinWarningTriggered] = useState(false);
  const [violations, setViolations] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSideNav, setShowSideNav] = useState(false);
  const [showPreSubmitReview, setShowPreSubmitReview] = useState(false);

  // Use refs for values needed in handleFinish to avoid timer resets
  const stateRef = useRef({ questions, answers, finished, attemptId: currentAttemptId, exam });
  useEffect(() => {
    stateRef.current = { questions, answers, finished, attemptId: currentAttemptId, exam };
  }, [questions, answers, finished, currentAttemptId, exam]);

  // Track if we are busy to prevent double submission
  const busyRef = useRef(false);

  const handleExit = () => {
    if (isReviewMode) {
      if (attemptId) {
        navigate(`/results/${attemptId}`);
      } else {
        navigate('/dashboard');
      }
      return;
    }
    setShowExitModal(true);
  };

  // Initialize Exam and Attempt
  useEffect(() => {
    const initExam = async () => {
      if (!examId || !user) return;
      try {
        // Parallelize fetching exam and questions for faster load
        const [examDoc, qSnapshot] = await Promise.all([
          getDoc(doc(db, 'exams', examId)),
          getDocs(collection(db, 'exams', examId, 'questions'))
        ]);

        if (!examDoc.exists()) {
          navigate('/dashboard');
          return;
        }

        const examData = { id: examDoc.id, ...examDoc.data() } as Exam;
        
        let existingOngoingAttempt: any = null;
        if (!isReviewMode) {
          const attemptsQuery = query(
            collection(db, 'attempts'),
            where('userId', '==', user.uid),
            where('examId', '==', examId)
          );
          const attemptsSnap = await getDocs(attemptsQuery);
          const studentAttempts = attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
          
          existingOngoingAttempt = studentAttempts.find(a => a.status === 'ongoing');

          // SECURITY CHECK AND RETAKE POLICY FOR STUDENTS ONLY
          if (profile?.role === 'student') {
            const matchesGrade = !examData.grade || (examData.grade as any) === 'all' || examData.grade === profile.grade;
            // For stream, matches if exam is 'general' or matches student's stream
            const matchesStream = !examData.stream || (examData.stream as any) === 'all' || examData.stream === 'general' || examData.stream === profile.stream;
            
            if (!matchesGrade || !matchesStream) {
              console.warn("Security block: Student attempted to access unauthorized exam", { examId, studentId: user.uid });
              navigate('/dashboard');
              return;
            }

            const hasPassed = studentAttempts.some(a => {
              const pct = (a.score / (a.totalPoints || 1)) * 100;
              return pct >= 50;
            });

            if (hasPassed) {
              console.warn("Retake policy block: Student already passed this exam.");
              navigate('/dashboard');
              return;
            }
          }
        }

        setExam(examData);
        const seconds = examData.durationMinutes * 60;
        setTimeRemaining(seconds);
        setTotalTime(seconds);

        const qList = qSnapshot.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...(data as any) } as Question;
        });
        
        // Sort questions if they have an orderIndex
        qList.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
        setQuestions(qList);

        if (isReviewMode) {
          setFinished(true);
          if (attemptId) {
            const attemptDoc = await getDoc(doc(db, 'attempts', attemptId));
            if (!attemptDoc.exists()) {
              navigate('/dashboard');
              return;
            }
            
            const answersSnapshot = await getDocs(collection(db, 'attempts', attemptId, 'answers'));
            const answersMap: Record<string, number> = {};
            answersSnapshot.forEach(doc => {
              const data = doc.data();
              answersMap[data.questionId] = data.selectedOptionIndex;
            });
            setAnswers(answersMap);

            // Generate AI feedback for review mode
            if (Object.keys(answersMap).length > 0) {
              setGeneratingFeedback(true);
              const incorrect = qList.filter(q => q.correctOptionIndex !== answersMap[q.id]).map(q => ({
                text: q.text,
                topic: q.topic,
                correctAnswer: q.options[q.correctOptionIndex],
                studentAnswer: q.options[answersMap[q.id]]
              })).slice(0, 5);
              
              if (incorrect.length > 0) {
                generateImprovementTips(incorrect, examData.subject || 'General').then(tips => {
                  setFeedback(tips);
                  setGeneratingFeedback(false);
                });
              } else {
                 setGeneratingFeedback(false);
              }
            }
          }
        } else {
          let attemptIdToUse = '';
          let answersToRestore: Record<string, number> = {};
          let durationSeconds = examData.durationMinutes * 60;
          let calculatedTimeRemaining = durationSeconds;

          if (existingOngoingAttempt) {
            // RESUME existing 'ongoing' attempt to prevent duplicates and load previously saved answers
            attemptIdToUse = existingOngoingAttempt.id;
            setCurrentAttemptId(attemptIdToUse);
            
            // Restore draft answers from Firestore map if any
            if (existingOngoingAttempt.draftAnswers) {
              answersToRestore = { ...existingOngoingAttempt.draftAnswers };
            }
            
            // Also load from answers subcollection just in case to be fully resilient
            try {
              const subCollectionSnap = await getDocs(collection(db, 'attempts', attemptIdToUse, 'answers'));
              subCollectionSnap.forEach(subDoc => {
                const subData = subDoc.data();
                if (subData.questionId && subData.selectedOptionIndex !== undefined) {
                  answersToRestore[subData.questionId] = subData.selectedOptionIndex;
                }
              });
            } catch (err) {
              console.warn("Could not load subcollection draft answers, using fallback map:", err);
            }

            // Restore remaining timer
            if (existingOngoingAttempt.startedAt) {
              const startMs = existingOngoingAttempt.startedAt.toDate 
                ? existingOngoingAttempt.startedAt.toDate().getTime() 
                : new Date(existingOngoingAttempt.startedAt).getTime();
              const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
              calculatedTimeRemaining = Math.max(0, durationSeconds - elapsedSeconds);
            }
          } else {
            // Create a brand-new attempt
            const attemptRef = await addDoc(collection(db, 'attempts'), {
              userId: user.uid,
              userName: profile?.fullName || profile?.name || 'Student',
              examId,
              examTitle: examData.title,
              examSubject: examData.subject,
              startedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              status: 'ongoing',
              violations: 0
            });
            attemptIdToUse = attemptRef.id;
            setCurrentAttemptId(attemptIdToUse);
          }

          setTimeRemaining(calculatedTimeRemaining);
          
          // Real-time tracking of student exam activity
          await setDoc(doc(db, 'users', user.uid), {
            currentActivity: 'working_exam',
            activeExamTitle: examData.title,
            activeExamId: examId,
            lastSeen: serverTimestamp()
          }, { merge: true }).catch(err => console.error("Error tracking exam activity:", err));
          
          // Start heartbeat for live status
          const heartbeat = setInterval(() => {
             // Don't pulse heartbeat if we are already finished or submitting
             if (stateRef.current.finished || busyRef.current) return;
             
             updateDoc(doc(db, 'attempts', attemptIdToUse), {
                updatedAt: serverTimestamp()
             }).catch(console.error);
          }, 45000); // Increased interval to 45s for performance

          // Recover progress from localStorage and merge with Firestore data
          const savedProgress = localStorage.getItem(`exam_progress_${examId}`);
          if (savedProgress) {
            try {
              const parsedLocal = JSON.parse(savedProgress);
              answersToRestore = { ...parsedLocal, ...answersToRestore };
            } catch (e) {
              console.error("Failed to recover progress", e);
            }
          }

          if (Object.keys(answersToRestore).length > 0) {
            setAnswers(answersToRestore);
          }

          setLoading(false);
          return () => clearInterval(heartbeat);
        }
        setLoading(false);
      } catch (error) {
        console.error("Initialization error:", error);
        handleFirestoreError(error, OperationType.CREATE, 'attempts');
        setLoading(false);
      }
    };

    initExam();
  }, [examId, user, navigate, profile]);

  const handleSelectOption = async (qId: string, optionIndex: number) => {
    if (finished || isReviewMode || isSubmitting) return;
    
    // Update local state instantly for pristine UX
    setAnswers(prev => ({ ...prev, [qId]: optionIndex }));

    // Instant/Asynchronous background auto-save to Firestore to prevent data loss
    if (currentAttemptId) {
      try {
        const attemptRef = doc(db, 'attempts', currentAttemptId);
        
        // 1. Save in the attempt document's draftAnswers map for high-speed resumption
        await updateDoc(attemptRef, {
          [`draftAnswers.${qId}`]: optionIndex,
          updatedAt: serverTimestamp()
        });

        // 2. Also save to the answers subcollection doc for redundancy
        const currentQ = questions.find(q => q.id === qId);
        const isCorrect = currentQ ? (currentQ.correctOptionIndex === optionIndex) : false;
        
        const answerDocRef = doc(db, 'attempts', currentAttemptId, 'answers', qId);
        await setDoc(answerDocRef, {
          questionId: qId,
          selectedOptionIndex: optionIndex,
          isCorrect,
          answeredAt: serverTimestamp()
        }, { merge: true });

        console.log(`[Auto-Save] Saved option ${optionIndex} for question ${qId}.`);
      } catch (error) {
        console.warn("Firestore background auto-save sync warning:", error);
      }
    }
  };

  // Support typing/text answer auto-saves robustly if typed input fields are present
  const handleTextAnswerChange = async (qId: string, textValue: string) => {
    if (finished || isReviewMode || isSubmitting) return;
    
    setAnswers(prev => ({ ...prev, [qId]: textValue as any }));

    if (currentAttemptId) {
      try {
        const attemptRef = doc(db, 'attempts', currentAttemptId);
        await updateDoc(attemptRef, {
          [`draftAnswers.${qId}`]: textValue,
          updatedAt: serverTimestamp()
        });

        const answerDocRef = doc(db, 'attempts', currentAttemptId, 'answers', qId);
        await setDoc(answerDocRef, {
          questionId: qId,
          textAnswer: textValue,
          answeredAt: serverTimestamp()
        }, { merge: true });
        
        console.log(`[Auto-Save] Saved typed answer for question ${qId}.`);
      } catch (error) {
        console.warn("Firestore text typing auto-save sync warning:", error);
      }
    }
  };

  // Persistence logic for offline/interrupted sessions
  useEffect(() => {
    if (!examId || isReviewMode || finished || Object.keys(answers).length === 0) return;
    localStorage.setItem(`exam_progress_${examId}`, JSON.stringify(answers));
  }, [answers, examId, isReviewMode, finished]);

  const handleFinish = useCallback(async (finalStatus: 'completed' | 'timed-out' = 'completed') => {
    const { questions, answers, finished, attemptId, exam } = stateRef.current;
    if (finished || !attemptId || !exam || busyRef.current) return;
    
    if (finalStatus === 'completed') {
      setShowPreSubmitReview(true);
      return;
    }

    await performSubmit(finalStatus);
  }, [navigate, examId]);

  const performSubmit = async (finalStatus: 'completed' | 'timed-out') => {
    const { questions, answers, attemptId, exam } = stateRef.current;
    if (!attemptId || !exam || busyRef.current) return;

    busyRef.current = true;
    setFinished(true);
    setIsSubmitting(true);
    setShowConfirmModal(false);

    // OFFLINE CONNECTION INTERMITTENCY CHECK
    if (!navigator.onLine) {
      try {
        console.warn("Device is offline. Buffering exam submission values locally.");
        let finalScore = 0;
        let finalTotalPoints = 0;

        questions.forEach(q => {
          const selected = answers[q.id];
          const isCorrect = selected === q.correctOptionIndex;
          if (selected !== undefined && isCorrect) finalScore += q.points;
          finalTotalPoints += q.points;
        });

        const offlinePayload = {
          attemptId,
          examId,
          examTitle: exam.title,
          examSubject: exam.subject,
          examType: exam.type || 'final',
          userId: user?.uid,
          userName: profile?.fullName || profile?.name || 'Student',
          questions: questions,
          answers: answers,
          score: finalScore,
          totalPoints: finalTotalPoints,
          status: finalStatus,
          violations: violations || 0,
          finishedAt: new Date().toISOString(),
          isOffline: true
        };

        const existingQueue = JSON.parse(localStorage.getItem('offline_attempts_queue') || '[]');
        existingQueue.push(offlinePayload);
        localStorage.setItem('offline_attempts_queue', JSON.stringify(existingQueue));

        // Cleanup
        localStorage.removeItem(`exam_progress_${examId}`);

        setIsSubmitting(false);
        alert(language === 'en' 
          ? `🎉 Exam completed offline! Score: ${finalScore}/${finalTotalPoints}. Your answers are saved locally and will auto-sync with the school portal as soon as your internet is active.` 
          : `🎉 Qormaanni ooflaayiniin xumurameera! Qabxii: ${finalScore}/${finalTotalPoints}. Ofumaan weebsaayitiitti ergama harki internetii dabaluu wajjin.`
        );

        navigate('/dashboard');
        return;
      } catch (localErr) {
        console.error("Local offline storage buffer failed:", localErr);
      }
    }

    try {
      let finalScore = 0;
      let finalTotalPoints = 0;

      // Calculate score first
      questions.forEach(q => {
        const selected = answers[q.id];
        const isCorrect = selected === q.correctOptionIndex;
        if (selected !== undefined && isCorrect) finalScore += q.points;
        finalTotalPoints += q.points;
      });

      // Submit all answers using a Batch for performance and atomicity
      const batch = writeBatch(db);
      
      questions.forEach((q) => {
        const selected = answers[q.id];
        const isCorrect = selected === q.correctOptionIndex;
        
        const answerRef = doc(collection(db, 'attempts', attemptId, 'answers'));
        batch.set(answerRef, {
          questionId: q.id,
          selectedOptionIndex: selected !== undefined ? selected : -1,
          isCorrect,
          answeredAt: serverTimestamp()
        });
      });

      // Finalize attempt in the same batch
      const attemptRef = doc(db, 'attempts', attemptId);
      batch.update(attemptRef, {
        finishedAt: serverTimestamp(),
        status: finalStatus,
        score: finalScore,
        totalPoints: finalTotalPoints,
        answersCount: Object.keys(answers).length
      });

      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          currentActivity: null,
          activeExamTitle: null,
          activeExamId: null,
          lastSeen: serverTimestamp()
        });
      }

      // Direct integration with Student Report Cards: recording marks in the 'marks' collection
      try {
        let assessmentType: 'mid_exam' | 'final_exam' | 'mock_exam' = 'final_exam';
        let totalPoints = 70;
        if (exam.type === 'mid') {
          assessmentType = 'mid_exam';
          totalPoints = 30;
        } else if (exam.type === 'eaes_mock' || exam.type === 'model') {
          assessmentType = 'mock_exam';
          totalPoints = 100;
        }
        
        const scaledScore = Math.min(totalPoints, Math.round((finalScore / (finalTotalPoints || 1)) * totalPoints * 10) / 10);
        
        // Detect Term from exam title or description, defaulting to 'term_1'
        const titleLower = (exam.title || '').toLowerCase();
        const descLower = (exam.description || '').toLowerCase();
        const isTerm2 = titleLower.includes('term 2') || 
                         titleLower.includes('sem-2') || 
                         titleLower.includes('sem 2') || 
                         titleLower.includes('semester 2') || 
                         titleLower.includes('semisteera 2') || 
                         titleLower.includes('second semester') ||
                         titleLower.includes('semister 2') ||
                         descLower.includes('term 2') || 
                         descLower.includes('sem-2') || 
                         descLower.includes('semester 2') || 
                         descLower.includes('semisteera 2');
        const term = isTerm2 ? 'term_2' : 'term_1';
        
        const studentName = profile?.fullName || profile?.name || user?.displayName || 'Anonymous Student';
        const studentSid = profile?.sid || 'N/A';
        const studentId = user?.uid;

        // Standard student report cards dynamically compile finished attempts on-the-fly in MarksAndReports.tsx
        // Only write to the static 'marks' Firestore collection if the user has an Admin role
        if (studentId && profile?.role === 'admin') {
          const normSub = normalizeSubject(exam.subject);
          const marksQuery = query(
            collection(db, 'marks'),
            where('studentId', '==', studentId),
            where('subject', '==', normSub),
            where('term', '==', term),
            where('assessmentType', '==', assessmentType)
          );
          const existingMarksSnap = await getDocs(marksQuery);
          
          if (!existingMarksSnap.empty) {
            // Update existing document so report cards are kept clean & correct
            const firstDoc = existingMarksSnap.docs[0];
            batch.update(firstDoc.ref, {
              score: scaledScore,
              totalPoints,
              studentName,
              studentSid,
              recordedBy: 'system_exam_portal_re-attempt',
              recordedAt: serverTimestamp()
            });

            // Clean up duplicates if any
            for (let i = 1; i < existingMarksSnap.docs.length; i++) {
              batch.delete(existingMarksSnap.docs[i].ref);
            }
          } else {
            // Register a fresh report card entry
            const markDocRef = doc(collection(db, 'marks'));
            batch.set(markDocRef, {
              studentId,
              studentName,
              studentSid,
              subject: normSub,
              term,
              assessmentType,
              score: scaledScore,
              totalPoints,
              recordedBy: 'system_exam_portal',
              recordedAt: serverTimestamp()
            });
          }
        }
      } catch (markErr) {
        console.error("Error auto-recording mark to report card:", markErr);
      }

      await batch.commit();

      // Clear finalized attempt from local storage
      localStorage.removeItem(`exam_progress_${examId}`);

      // Clear the local state and navigate
      setIsSubmitting(false);
      navigate(`/results/${attemptId}`);
    } catch (error) {
      console.error("Submission error:", error);
      busyRef.current = false;
      setFinished(false);
      setIsSubmitting(false);
      
      // Attempt helpful error alert
      alert("There was an error submitting your exam. Please check your connection and try again. Your progress is saved.");
      
      handleFirestoreError(error, OperationType.UPDATE, `attempts/${attemptId}`);
    }
  };

  // Timer logic
  useEffect(() => {
    if (loading || finished || isReviewMode || timeRemaining < 0) return;
    
    // When time reaches 0, trigger finish
    if (timeRemaining === 0) {
      alert(t('exam.timesUp'));
      handleFinish('timed-out');
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, finished, timeRemaining, handleFinish]);

  // Trigger gentle warning toast when exactly 5 minutes (300 seconds) remain or cross the threshold
  useEffect(() => {
    if (!loading && !isReviewMode && !finished && timeRemaining > 0 && totalTime > 300) {
      if (timeRemaining <= 300 && !fiveMinWarningTriggered) {
        setShowFiveMinWarning(true);
        setFiveMinWarningTriggered(true);
      }
    }
  }, [timeRemaining, fiveMinWarningTriggered, totalTime, loading, isReviewMode, finished]);

  // Clean up user active exam activity when they exit the exam page or unmount
  useEffect(() => {
    return () => {
      if (user?.uid && !isReviewMode) {
        setDoc(doc(db, 'users', user.uid), {
          currentActivity: null,
          activeExamTitle: null,
          activeExamId: null,
          lastSeen: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    };
  }, [user, isReviewMode]);

  // Lockdown detection (prominent version)
  useEffect(() => {
    if (isReviewMode || finished || !currentAttemptId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolations(v => v + 1);
        setShowViolationAlert(true);
        updateDoc(doc(db, 'attempts', currentAttemptId), {
          violations: increment(1)
        }).catch(err => console.error("Violation sync failed", err));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentAttemptId, finished, isReviewMode]);

  if (loading && !finished && !isReviewMode) {
    return (
      <div className="min-h-screen bg-[#f0f5fc] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="w-24 h-24 border-4 border-blue-600/20 border-t-blue-600 rounded-full mx-auto"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="text-blue-600" size={32} />
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">
              {t('exam.preparing')}
            </h2>
            <div className="flex flex-col gap-2">
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                {t('exam.initSecure')} • {exam?.title || 'Grade 12 Mock'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest">
                  {t('exam.optimizing')} {questions.length > 0 ? questions.length : '...'} {t('nav.exams')}
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white rounded-[40px] border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-4 text-left">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t('exam.integrity')}</p>
                <p className="text-sm font-bold text-slate-700">{t('exam.noSwitch')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-left">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Clock size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t('exam.timerLimit')}</p>
                <p className="text-sm font-bold text-slate-700">{t('exam.syncDesc')}</p>
              </div>
            </div>
          </div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
            Biftu Beri Secondary School • Academic Excellence
          </p>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const navProgress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#f0f5fc] flex flex-col">
      {exam?.dueDate && !finished && (
        <div className={`px-4 py-2 flex items-center justify-center gap-2 border-b transition-colors ${
          (exam.dueDate?.toDate?.() || new Date(exam.dueDate)) < new Date() 
            ? 'bg-red-50 border-red-100' 
            : 'bg-amber-50 border-amber-100'
        }`}>
          <AlertCircle size={14} className={(exam.dueDate?.toDate?.() || new Date(exam.dueDate)) < new Date() ? 'text-red-500' : 'text-amber-500'} />
          <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${
            (exam.dueDate?.toDate?.() || new Date(exam.dueDate)) < new Date() 
              ? 'text-red-700' 
              : 'text-amber-700'
          }`}>
            {(exam.dueDate?.toDate?.() || new Date(exam.dueDate)) < new Date() 
              ? 'This exam session is past the scheduled deadline' 
              : `Scheduled Deadline: ${format(exam.dueDate?.toDate?.() || new Date(exam.dueDate), 'MMM d, h:mm a')}`}
          </span>
        </div>
      )}
      {/* Top Progress System */}
      <div className="fixed top-0 left-0 w-full z-[60] shrink-0 pointer-events-none">
        {/* Answered Progress (Emerald) */}
        <div className="h-1.5 bg-slate-200/50">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-500"
          />
        </div>
        {/* Navigation Progress (Blue - thin thread) */}
        <div className="h-0.5 bg-transparent">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${navProgress}%` }}
            className="h-full bg-blue-600 opacity-60"
          />
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 h-24 sticky top-0 z-50 shadow-sm flex items-center">
        {/* Submission Overlay */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden"
              >
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[28px] flex items-center justify-center shadow-inner">
                    <CheckCircle2 size={40} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{t('exam.finishExam')}?</h3>
                    <p className="text-slate-500 font-medium text-lg leading-tight">
                      {t('exam.answered')} <span className="text-blue-600 font-bold">{Object.keys(answers).length}</span> {t('exam.outOf')} <span className="font-bold">{questions.length}</span> {t('nav.exams')}.
                    </p>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-[32px] w-full grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('results.yourAnswer')}ed</span>
                       <span className="text-lg font-black text-slate-900">{Object.keys(answers).length}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unanswered</span>
                       <span className="text-lg font-black text-red-600">{questions.length - Object.keys(answers).length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="px-8 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                    >
                      {t('common.back')}
                    </button>
                    <button
                      onClick={() => performSubmit('completed')}
                      className="px-8 py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all font-sans"
                    >
                      {t('common.save')} & {t('common.continue')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showExitModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden border-4 border-red-50"
              >
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[28px] flex items-center justify-center shadow-inner">
                    <LogOut size={40} />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-950 uppercase tracking-tight">Exit Exam Session?</h3>
                    <p className="text-slate-500 font-bold text-sm leading-relaxed">
                      Your progress has been dynamically saved! You can return to resume this exam anytime from your dashboard. However, please note that the session countdown timer will keep running in the background.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    <button
                      onClick={() => setShowExitModal(false)}
                      className="px-8 py-5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                    >
                      Keep Testing
                    </button>
                    <button
                      onClick={() => {
                        setShowExitModal(false);
                        navigate('/dashboard');
                      }}
                      className="px-8 py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-200"
                    >
                      Save & Exit
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {isSubmitting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center space-y-6 max-w-sm w-full mx-4">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"
                />
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Submitting Exam</h3>
                  <p className="text-slate-500 font-medium tracking-tight">Calculating your results and securing your attempt...</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExit}
              className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl border-2 border-red-100 font-extrabold text-[11px] uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm active:scale-95 shrink-0"
              title="Exit Exam"
            >
              <LogIn size={14} className="rotate-180" />
              <span>Exit / Ba'i</span>
            </button>
            <div className="flex flex-col">
              <h2 className="font-black text-slate-900 text-lg sm:text-xl line-clamp-1 flex items-center gap-2">
                <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                {exam?.title}
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                <span className="text-blue-600">{exam?.subject}</span>
                <span>•</span>
                <span>Grade {exam?.grade}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-8">
            {isReviewMode ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Review Mode</span>
                   <span className="text-blue-600 font-black text-sm uppercase">Practice & Feedback</span>
                </div>
                <button
                  onClick={() => attemptId ? navigate(`/results/${attemptId}`) : navigate('/dashboard')}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                >
                  Exit Review
                </button>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-2 sm:gap-4 font-mono text-2xl sm:text-4xl font-extrabold px-6 sm:px-12 py-2 sm:py-2.5 rounded-[24px] transition-all shadow-xl border-4 ${
                  timeRemaining < totalTime * 0.1 
                    ? 'bg-red-600 text-white border-red-500 animate-pulse scale-105 shadow-red-500/30' 
                    : timeRemaining < totalTime * 0.25 
                      ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-amber-500/20' 
                      : 'bg-white text-slate-950 border-slate-950 shadow-lg shadow-slate-200'
                }`}>
                  <Clock size={32} className={`${timeRemaining < totalTime * 0.1 ? 'animate-bounce' : 'text-blue-600'} hidden sm:block`} />
                  <Clock size={20} className={`${timeRemaining < totalTime * 0.1 ? 'animate-bounce' : 'text-blue-600'} sm:hidden`} />
                  <span className="tabular-nums drop-shadow-sm font-black text-slate-950">
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                  <button
                    id="finish-exam-button"
                    onClick={() => handleFinish()}
                    disabled={isSubmitting}
                    className={`hidden md:flex px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                      isSubmitting 
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-red-600/10 text-red-600 border-2 border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 shadow-sm'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Finish Exam'}
                  </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for Status Board - Left Side */}
        <aside className="w-80 border-r border-slate-200 bg-white overflow-y-auto hidden lg:block p-6">
          <div className="sticky top-0 bg-white pb-4 z-10 border-b border-slate-100 mb-6">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Status Board</h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monitor your progress</p>
          </div>

          {/* Directions / Guide Banner explaining easy clicking and colors */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left mb-6 font-sans space-y-2.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">
              Directions / Qajeelfama
            </span>
            <p className="text-[11px] text-slate-650 font-bold leading-relaxed">
              Click any question number below to jump directly to it. Highlighted amber pulsing blocks are <span className="text-amber-600 font-extrabold">unanswered questions</span> that require answers.
            </p>
            <p className="text-[10px] text-slate-500 italic leading-snug">
              Cuqaasni lakkoofsa gaaffii irratti kallattiin gaaffiicha bana. Bilbilli oranjii gaaffilee deebiin hin guutamiin agarsiisa.
            </p>
          </div>

          {/* Interactive Legend Key */}
          <div className="grid grid-cols-3 gap-1.5 text-[8px] font-black uppercase tracking-wider mb-6">
            <div className="flex items-center gap-1 p-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
              <span>Active</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span>Solved</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
              <span>Pending</span>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentQuestionIndex;
                return (
                  <button
                    key={idx}
                    id={`status-btn-${idx}`}
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      setShowPreSubmitReview(false);
                    }}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-black transition-all border-2 relative cursor-pointer ${
                      isCurrent 
                        ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-200 scale-110 z-10' 
                        : isAnswered 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/80 hover:border-amber-400 shadow-sm shadow-amber-100/20 active:scale-95 transition-all animate-[pulse_2.5s_infinite_ease-in-out]'
                    }`}
                  >
                    <span className={isCurrent ? 'text-white' : isAnswered ? 'text-emerald-700 font-extrabold' : 'text-amber-850 font-extrabold text-[11px]'}>
                      {idx + 1}
                    </span>
                    {isCurrent ? (
                      <span className="w-1 h-1 rounded-full bg-white mt-0.5"></span>
                    ) : isAnswered ? (
                      <CheckCircle2 size={10} className="mt-0.5 opacity-80" />
                    ) : (
                      <span className="text-[8px] mt-0.5 text-amber-600 font-extrabold animate-pulse">?</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Answered</span>
                <span className="text-xs font-black text-emerald-600">{Object.keys(answers).length} / {questions.length}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-emerald-500"
                  animate={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 mt-6">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Question {currentQuestionIndex + 1}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 text-amber-800 border-2 border-amber-200 animate-pulse">
                  <span className="text-[10px] font-black text-amber-600">?</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">Pending: {questions.length - Object.keys(answers).length} Left</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col bg-[#f0f5fc] relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-12">
            <div className="max-w-4xl w-full mx-auto flex flex-col min-h-full">
                 {showPreSubmitReview ? (
                /* PRE-SUBMIT REVIEW COMPONENT */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-1 flex flex-col space-y-8 pb-12"
                >
                  {/* Biftu Beri portal header */}
                  <div className="bg-gradient-to-br from-indigo-700 to-blue-800 p-8 sm:p-10 rounded-[32px] text-white shadow-xl relative overflow-hidden border-4 border-slate-900">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <ShieldCheck size={120} />
                    </div>
                    <div className="relative z-10 space-y-3">
                      <div className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] inline-block">
                        Exam Submission Review / Ilaallama Qormaataa
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">Ilaallama Deebii Keessanii</h2>
                      <p className="text-sm font-medium text-blue-100 max-w-2xl leading-relaxed font-sans">
                        Maaloo osoo hin ergin dura deebii keessan gadi fageenyaan qoradaa. Gaaffii kamiyyuu irratti deebitanii sirreessuuf gaaffiicha irratti cuqaasaa.
                        <br />
                        <span className="text-xs font-semibold text-emerald-300">
                          Please review your answers before final submission. Click on any question below to jump back and revise it.
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* High Level Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white border-4 border-slate-900 p-6 rounded-[24px] shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Questions / Guutuu</p>
                        <p className="text-2xl font-black text-slate-900">{questions.length}</p>
                      </div>
                    </div>

                    <div className="bg-white border-4 border-slate-900 p-6 rounded-[24px] shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Answered / Deebifaman</p>
                        <p className="text-2xl font-black text-slate-900">{answeredCount}</p>
                      </div>
                    </div>

                    <div className="bg-white border-4 border-emerald-400 p-6 rounded-[24px] shadow-[6px_6px_0px_0px_rgba(16,185,129,0.2)] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Unanswered / Hafiinsa</p>
                        <p className="text-2xl font-black text-orange-600">{questions.length - answeredCount}</p>
                      </div>
                    </div>
                  </div>

                  {/* List of each Question and Response status */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-2">Questions Status Sheet</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                      {questions.map((q, idx) => {
                        const isAnswered = answers[q.id] !== undefined;
                        const optionVal = answers[q.id];
                        const answerLabel = isAnswered 
                          ? (typeof optionVal === 'number' ? `Option ${String.fromCharCode(65 + optionVal)}` : optionVal)
                          : null;

                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setCurrentQuestionIndex(idx);
                              setShowPreSubmitReview(false);
                            }}
                            className={`w-full group text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                              isAnswered 
                                ? 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md' 
                                : 'bg-amber-50/50 border-amber-200 hover:border-amber-500 hover:shadow-md'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
                              isAnswered 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {idx + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {q.text}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {isAnswered ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                                      Answered: {answerLabel}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                                      No Answer Selected / Deebii Hin Filatamne
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0">
                              <ChevronRight size={18} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Large CTA Block on Screen */}
                  <div className="p-8 bg-white border-4 border-slate-900 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] flex flex-col sm:flex-row items-center justify-between gap-6 mt-4">
                    <div className="space-y-1">
                      <h4 className="text-lg font-black text-slate-900 uppercase">Ready to submit?</h4>
                      <p className="text-xs font-bold text-slate-500">
                        Make sure all questions have been reviewed and resolved. No timing penalty is assessed for reviewing.
                      </p>
                    </div>
                    <div className="flex gap-4 w-full sm:w-auto">
                      <button
                        onClick={() => setShowPreSubmitReview(false)}
                        className="px-6 py-4 border-2 border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all text-center flex-1 sm:flex-initial"
                      >
                        Keep Editing / Of Qori
                      </button>
                      <button
                        onClick={() => setShowConfirmModal(true)}
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-500/10 text-center flex-1 sm:flex-initial animate-pulse"
                      >
                        Submit Final / Ol Ergi
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Dynamic Pacing & Progress System */}
                  {!finished && questions.length > 0 && (
                    <div className="mb-8 bg-white border-4 border-slate-900 rounded-[28px] p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                              {language === 'en' ? 'Exam Progress & Pacing Advice' : 'Gabaasa Adeemsa Qormaataa & Gorsa Saffisaa'}
                            </h4>
                          </div>
                          <p className="text-base sm:text-lg font-black text-slate-900">
                            {language === 'en' ? (
                              <>
                                You have answered <span className="text-blue-600 font-extrabold">{answeredCount}</span> of <span className="text-slate-800">{questions.length}</span> questions
                              </>
                            ) : (
                              <>
                                Gaaffilee <span className="text-blue-600 font-extrabold">{questions.length}</span> keessaa <span className="text-blue-600 font-extrabold">{answeredCount}</span> deebistaniittu
                              </>
                            )}
                            <span className="text-xs font-bold text-slate-400 ml-2">
                              ({Math.round(progress)}% {language === 'en' ? 'completed' : 'xumurameera'})
                            </span>
                          </p>
                        </div>

                        {!isReviewMode && (
                          <div className="bg-slate-50 border-2 border-slate-900 px-4 py-2.5 rounded-2xl flex items-center gap-3 self-start sm:self-auto">
                            <Clock size={18} className="text-blue-600 shrink-0" />
                            <div className="text-left leading-none">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                {language === 'en' ? 'Estimated Pacing' : 'Taksiin Saffisaa'}
                              </p>
                              <p className="text-xs font-black text-slate-950">
                                {questions.length - answeredCount > 0 ? (
                                  (() => {
                                    const secondsPerQuestion = Math.max(0, Math.floor(timeRemaining / (questions.length - answeredCount)));
                                    const pMins = Math.floor(secondsPerQuestion / 60);
                                    const pSecs = secondsPerQuestion % 60;
                                    return language === 'en'
                                      ? `~${pMins > 0 ? `${pMins}m ` : ''}${pSecs}s / question`
                                      : `~gaaffiitti ${pMins > 0 ? `${pMins}m ` : ''}${pSecs}s`;
                                  })()
                                ) : (
                                  language === 'en' ? 'Completed!' : 'Xumurameera!'
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* The actual progress bar */}
                      <div className="relative w-full h-4 bg-slate-100 rounded-full border-2 border-slate-900 overflow-hidden p-0.5 shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                        />
                      </div>

                      {/* Micro milestones indicator */}
                      <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        <span>{language === 'en' ? 'Start' : 'Jalqaba'}</span>
                        <span className={progress >= 25 ? 'text-blue-600 font-extrabold' : ''}>25%</span>
                        <span className={progress >= 50 ? 'text-indigo-600 font-extrabold' : ''}>50%</span>
                        <span className={progress >= 75 ? 'text-violet-600 font-extrabold' : ''}>75%</span>
                        <span className={progress >= 100 ? 'text-emerald-600 font-extrabold' : ''}>
                          {language === 'en' ? 'Finish' : 'Xumura'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Responsive Question Navigation Grid for Mobile & Tablets */}
                  {!finished && questions.length > 0 && (
                    <div className="block lg:hidden mb-10 bg-white border-4 border-slate-900 rounded-[28px] p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-4 font-sans">
                      <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            Question Navigation Dashboard
                          </h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mt-1">
                            {questions.length - Object.keys(answers).length} unanswered left • Tap any number to jump
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase border border-amber-200 animate-pulse">
                          Pending Alert
                        </span>
                      </div>

                      {/* Directions */}
                      <div className="text-[11px] text-slate-650 font-bold leading-relaxed space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p>💡 <span className="text-slate-900 font-extrabold">Directions / Qajeelfama:</span> Tap any question number below to jump directly to it.</p>
                        <p className="text-slate-500 font-semibold italic">Amber highlighted pulsing blocks represent unanswered / unsolved questions needing your response.</p>
                      </div>

                      <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-1">
                        {questions.map((q, idx) => {
                          const isAnswered = answers[q.id] !== undefined;
                          const isCurrent = idx === currentQuestionIndex;
                          return (
                            <button
                              key={`mobile-nav-${idx}`}
                              onClick={() => {
                                setCurrentQuestionIndex(idx);
                                setShowPreSubmitReview(false);
                              }}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-black border-2 relative cursor-pointer active:scale-95 transition-all ${
                                isCurrent 
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-150 scale-105 z-10' 
                                  : isAnswered 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 font-extrabold' 
                                    : 'bg-amber-50 text-amber-800 border-amber-300 animate-[pulse_2.5s_infinite_ease-in-out]'
                              }`}
                            >
                              <span className={isCurrent ? 'text-white font-black' : isAnswered ? 'text-emerald-700 font-extrabold' : 'text-amber-850 font-extrabold'}>
                                {idx + 1}
                              </span>
                              {isCurrent ? (
                                <span className="w-1 h-1 rounded-full bg-white mt-0.5"></span>
                              ) : isAnswered ? (
                                <CheckCircle2 size={10} className="mt-0.5 text-emerald-600 opacity-80" />
                              ) : (
                                <span className="text-[8px] mt-0.5 font-bold text-amber-600 animate-pulse">?</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {currentQuestion && (
                      <motion.div
                        key={currentQuestion.id}
                        id={`question-container-${currentQuestionIndex}`}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col"
                      >
                    <div className="mb-12 flex items-center justify-between">
                      <div className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                        Question {currentQuestionIndex + 1} / {questions.length}
                      </div>
                      
                      {!isReviewMode && (
                        <div className="flex items-center gap-2 text-slate-950 font-black bg-blue-50 border-2 border-blue-600 px-3.5 py-1.5 rounded-xl shadow-sm">
                          <Clock size={14} className="text-blue-600 animate-pulse" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-950">{t('exam.remainingTime')}: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
                        </div>
                      )}

                      {isReviewMode && (
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                          answers[currentQuestion.id] === currentQuestion.correctOptionIndex 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                            : 'bg-red-500 text-white shadow-lg shadow-red-200'
                        }`}>
                          {answers[currentQuestion.id] === currentQuestion.correctOptionIndex ? (
                            <>
                              <CheckCircle2 size={12} />
                              Result: Correct
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              Result: Incorrect
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {isReviewMode && feedback && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-10 p-8 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] text-white shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-8 opacity-20">
                          <Brain size={80} />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-4 text-white/80 font-black text-xs uppercase tracking-[0.2em]">
                            <Sparkles size={18} className="text-yellow-300" />
                            {t('exam.improvementTips')}
                          </div>
                          <div className="text-lg font-bold leading-relaxed whitespace-pre-wrap">
                            {feedback}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {isReviewMode && generatingFeedback && (
                      <div className="mb-10 p-8 bg-slate-100 rounded-[32px] flex items-center justify-center gap-4 text-slate-500">
                        <Loader2 size={24} className="animate-spin text-blue-600" />
                        <span className="font-black text-xs uppercase tracking-widest">{t('exam.generatingTips')}</span>
                      </div>
                    )}

                    {currentQuestionIndex === 0 && exam?.description && (
                      <div className="mb-10 p-6 bg-blue-50/50 border border-blue-100 rounded-[32px] text-blue-900">
                        <div className="flex items-center gap-2 mb-2 text-blue-600">
                          <AlertTriangle size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Instructions</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{exam.description}</p>
                      </div>
                    )}

                    <div className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight mb-12">
                      {currentQuestion.text}
                    </div>

                    <div className="grid grid-cols-1 gap-5 mb-12">
                      {currentQuestion.options.map((option, idx) => {
                        const isSelected = answers[currentQuestion.id] === idx;
                        const isCorrect = currentQuestion.correctOptionIndex === idx;
                        const label = String.fromCharCode(65 + idx); // A, B, C, D
                        
                        let variantClasses = 'border-white bg-white hover:border-blue-200';
                        if (isSelected && !isReviewMode) {
                          variantClasses = 'border-blue-600 bg-blue-50/50 ring-8 ring-blue-50 shadow-blue-100';
                        } else if (isReviewMode) {
                          if (isCorrect) {
                            variantClasses = 'border-emerald-500 bg-emerald-50 ring-8 ring-emerald-50 shadow-emerald-100';
                          } else if (isSelected && !isCorrect) {
                            variantClasses = 'border-red-500 bg-red-50 ring-8 ring-red-50 shadow-red-100';
                          }
                        }

                        return (
                          <motion.button
                            key={idx}
                            id={`option-${idx}`}
                            disabled={isReviewMode}
                            onClick={() => handleSelectOption(currentQuestion.id, idx)}
                            whileTap={{ scale: 0.98 }}
                            animate={isSelected && !isReviewMode ? {
                              scale: [1, 1.025, 0.975, 1],
                              transition: { duration: 0.3, ease: "easeInOut" }
                            } : { scale: 1 }}
                            className={`group relative p-8 rounded-3xl border-2 text-left transition-all flex items-center gap-6 shadow-sm hover:shadow-md ${variantClasses}`}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black transition-all ${
                              isSelected && !isReviewMode 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                                : isReviewMode && isCorrect
                                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                  : isReviewMode && isSelected && !isCorrect
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                                    : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'
                            }`}>
                              {label}
                            </div>
                            <span className={`text-xl font-bold ${
                              isSelected && !isReviewMode ? 'text-blue-900' : 
                              isReviewMode && isCorrect ? 'text-emerald-900' :
                              isReviewMode && isSelected && !isCorrect ? 'text-red-900' :
                              'text-slate-700'
                            }`}>
                              {option}
                            </span>
                            {isSelected && !isReviewMode && (
                              <div className="ml-auto text-blue-600">
                                <CheckCircle2 size={24} />
                              </div>
                            )}
                            {isReviewMode && isCorrect && (
                              <div className="ml-auto text-emerald-600">
                                <CheckCircle2 size={24} />
                              </div>
                            )}
                            {isReviewMode && isSelected && !isCorrect && (
                              <div className="ml-auto text-red-600">
                                <XCircle size={24} />
                              </div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {isReviewMode && currentQuestion.explanation && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-8 rounded-[32px] border-l-8 border-l-blue-600 border-slate-200 mb-12 shadow-xl shadow-blue-900/5 relative overflow-hidden"
                      >
                         <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BookOpen size={64} className="text-blue-600" />
                         </div>
                         <div className="flex items-center gap-3 mb-4 text-blue-600 font-black text-xs uppercase tracking-[0.2em] relative z-10">
                           <Info size={18} />
                           Educational Explanation
                         </div>
                         <p className="text-slate-700 font-bold leading-relaxed text-lg relative z-10">
                           {currentQuestion.explanation}
                         </p>
                         <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 relative z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scientific Reasoning Applied</span>
                         </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Prominent Violation Alert */}
              <AnimatePresence>
                {showViolationAlert && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md"
                  >
                    <motion.div 
                      className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl border-4 border-red-500 text-center relative overflow-hidden"
                      layoutId="violation-modal"
                    >
                      <div className="absolute top-0 right-0 p-8">
                         <div className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center -mr-16 -mt-16 opacity-50"></div>
                      </div>

                      <div className="relative z-10">
                        <div className="w-24 h-24 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mx-auto mb-8 shadow-inner">
                          <AlertTriangle size={48} className="animate-bounce" />
                        </div>
                        
                        <h3 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">Security Protocol Violation</h3>
                        <p className="text-slate-500 font-medium mb-10 leading-relaxed text-lg">
                          Window focus loss detected. This event has been recorded in your examination logs. Continued violations may lead to automatic disqualification.
                        </p>
                        
                        <button
                          onClick={() => setShowViolationAlert(false)}
                          className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 hover:bg-red-700 transition-all active:scale-95"
                        >
                          I Understand & Resume
                        </button>

                        <div className="mt-6 flex items-center justify-center gap-2 text-red-500 font-black text-[10px] uppercase tracking-widest">
                          <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                          Violation #{violations}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {violations > 0 && !showViolationAlert && (
                <div className="mt-8 bg-red-600 text-white px-8 py-4 rounded-[28px] flex items-center gap-4 shadow-2xl shadow-red-500/20 z-10 animate-pulse">
                  <AlertTriangle size={24} />
                  <div className="flex flex-col">
                    <span className="font-black text-xs uppercase tracking-widest">Security Violation Detected</span>
                    <span className="font-medium text-sm opacity-90">{violations} tab switches recorded.</span>
                  </div>
                </div>
              )}
            </>
          )}
            </div>
          </div>

          {/* Footer Navigation - Sticky at Bottom */}
          {showPreSubmitReview ? (
            <div className="py-6 sm:py-8 border-t border-slate-200 flex items-center justify-between bg-white px-4 sm:px-12 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
              <button
                onClick={() => setShowPreSubmitReview(false)}
                className="flex items-center gap-3 px-4 sm:px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100 transition-all border-2 border-slate-100"
              >
                <ChevronLeft size={20} />
                <span>Keep Editing / Gara Qorannotti Deebi'i</span>
              </button>

              <button
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-3 px-6 sm:px-10 py-4 bg-red-650 hover:bg-red-700 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-red-500/20"
              >
                <span>Submit Final / Ergi</span>
                <CheckCircle2 size={20} />
              </button>
            </div>
          ) : (
            <div className="py-6 sm:py-8 border-t border-slate-200 flex items-center justify-between bg-white px-4 sm:px-12 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
              <button
                id="prev-button"
                onClick={() => {
                  setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
                  setShowPreSubmitReview(false);
                }}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-3 px-4 sm:px-8 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100 disabled:opacity-20 transition-all border-2 border-slate-100"
              >
                <ChevronLeft size={20} />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>
              
              <div className="flex gap-2 sm:gap-3">
                {questions.slice(Math.max(0, currentQuestionIndex - 2), Math.min(questions.length, currentQuestionIndex + 3)).map((_, idx) => {
                  const actualIdx = Math.max(0, currentQuestionIndex - 2) + idx;
                  return (
                    <button 
                      key={actualIdx} 
                      onClick={() => {
                        setCurrentQuestionIndex(actualIdx);
                        setShowPreSubmitReview(false);
                      }}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        actualIdx === currentQuestionIndex ? 'bg-blue-600 w-8' : 
                        answers[questions[actualIdx].id] !== undefined ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex gap-3">
                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    id="next-button"
                    onClick={() => {
                      setCurrentQuestionIndex(prev => prev + 1);
                      setShowPreSubmitReview(false);
                    }}
                    className="flex items-center gap-3 px-6 sm:px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all hover:bg-blue-750 shadow-xl shadow-blue-550/10"
                  >
                    <span className="hidden sm:inline">Next Question</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight size={20} />
                  </button>
                ) : !isReviewMode ? (
                  <button
                    id="finish-button"
                    onClick={() => handleFinish()}
                    disabled={isSubmitting}
                    className={`flex items-center gap-3 px-6 sm:px-10 py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all shadow-xl ${
                      isSubmitting
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-red-100 animate-pulse'
                    }`}
                  >
                    {isSubmitting ? 'Finalizing...' : 'Finish Exam'}
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  </button>
                ) : (
                  <button
                    onClick={() => attemptId ? navigate(`/results/${attemptId}`) : navigate('/dashboard')}
                    className="flex items-center gap-3 px-6 sm:px-10 py-4 bg-blue-600 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all hover:bg-blue-700 shadow-xl"
                  >
                    {attemptId ? 'Return to Results' : 'Return to Dashboard'}
                    <CheckCircle2 size={20} />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
  </div>
  {/* 5-Minute Warning Toast Notification */}
  <AnimatePresence>
    {showFiveMinWarning && (
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20 }}
        className="fixed bottom-6 right-6 z-[250] max-w-sm w-full bg-slate-900 border-2 border-amber-500 text-white rounded-[24px] p-5 shadow-2xl flex flex-col gap-3 overflow-hidden"
      >
        {/* Decorative pulse background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" />

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 shrink-0 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-inner">
            <AlertTriangle className="animate-pulse" size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-sm uppercase tracking-wider text-amber-400">
              {language === 'om' ? 'Yeroon Si dhumuuf jira!' : 'Minutes Ticking Down!'}
            </h4>
            <p className="text-xs font-bold text-slate-200 mt-0.5 leading-relaxed">
              {language === 'om' 
                ? 'Madaallii xumuruuf daqiiqaa 5 qofatu hafe. Maaloo deebii kee filli.' 
                : 'You have only 5 minutes remaining for this examination! Please secure your answers now.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 font-mono text-xs font-black text-amber-400">
            <Clock size={14} className="animate-pulse" />
            <span>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
          </div>
          <button
            onClick={() => setShowFiveMinWarning(false)}
            className="px-4.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-200 rounded-xl transition-all hover:scale-105 active:scale-95 border border-slate-700"
          >
            {language === 'om' ? 'Hubadhe' : 'Dismiss'}
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
);
}
