import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { Exam, ExamAttempt, Answer, Question } from '@/src/types';
import { SUBJECTS_BY_GRADE, normalizeSubject } from '../constants';
import { motion } from 'motion/react';
import { 
  Trophy, 
  XCircle, 
  CheckCircle2, 
  ArrowLeft, 
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Eye,
  Clock,
  Printer,
  Award,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PostExamFeedbackModal } from './PostExamFeedbackModal';
import schoolLogo from '@/src/assets/images/bbs2_logo_1779651854520.png';

export default function Results() {
  const { attemptId } = useParams();
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<(Answer & { question?: Question })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // States to support compiling a Grade 12 National Mock Examination Certificate
  const [allAttempts, setAllAttempts] = useState<ExamAttempt[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [staticMarks, setStaticMarks] = useState<any[]>([]);
  const [studentProfile, setStudentProfile] = useState<any | null>(null);
  const [printLayout, setPrintLayout] = useState<'standard' | 'certificate'>('standard');

  useEffect(() => {
    const fetchData = async () => {
      if (!attemptId) return;
      try {
        const attemptDoc = await getDoc(doc(db, 'attempts', attemptId));
        if (!attemptDoc.exists()) {
          navigate('/dashboard');
          return;
        }
        const attemptData = { id: attemptDoc.id, ...attemptDoc.data() } as ExamAttempt;
        
        // SECURITY CHECK: Students should only see their own results
        const isStudent = profile?.role === 'student';
        const currentUid = user?.uid || profile?.uid;
        
        if (isStudent && attemptData.userId !== currentUid) {
           console.warn("Security block: Unauthorized user tried viewing someone else's result", {
             userId: attemptData.userId,
             currentUid
           });
           navigate('/dashboard');
           return;
        }

        setAttempt(attemptData);

        const examDoc = await getDoc(doc(db, 'exams', attemptData.examId));
        if (examDoc.exists()) {
          setExam({ id: examDoc.id, ...examDoc.data() } as Exam);
        }

        // Check if feedback already exists
        const feedbackSnapshot = await getDocs(collection(db, 'attempts', attemptId, 'feedback'));
        if (feedbackSnapshot.empty && profile?.role === 'student') {
          // Show feedback modal after results load if it's a student and no feedback yet
          setTimeout(() => setShowFeedbackModal(true), 2000);
        }

        const answersSnapshot = await getDocs(collection(db, 'attempts', attemptId, 'answers'));
        const answersList = answersSnapshot.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...(data as any) } as Answer;
        });
        
        // Fetch all questions for this exam in one go
        const qSnapshot = await getDocs(collection(db, 'exams', attemptData.examId, 'questions'));
        const questionsMap = new Map(qSnapshot.docs.map(d => [d.id, { id: d.id, ...d.data() } as Question]));
        
        // Map answers to questions locally
        const detailedAnswers = answersList.map(a => ({
          ...a,
          question: questionsMap.get(a.questionId)
        }));

        // Sort by question orderIndex so they match the exact sequence the student took
        detailedAnswers.sort((a, b) => {
          const orderA = a.question?.orderIndex ?? 0;
          const orderB = b.question?.orderIndex ?? 0;
          return orderA - orderB;
        });

        setAnswers(detailedAnswers);

        // Fetch student's profile doc under the tested user UID
        const userDoc = await getDoc(doc(db, 'users', attemptData.userId));
        const sProfile = userDoc.exists() ? userDoc.data() : null;
        setStudentProfile(sProfile);

        // Fetch all completed attempts for this specific student
        const attemptsSnapshot = await getDocs(
          query(collection(db, 'attempts'), where('userId', '==', attemptData.userId))
        );
        const fetchedAttempts = attemptsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));
        setAllAttempts(fetchedAttempts);

        // Fetch all exams in the system
        const examsSnapshot = await getDocs(collection(db, 'exams'));
        const fetchedExams = examsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
        setAllExams(fetchedExams);

        // Fetch static marks for this student
        const sId = sProfile?.studentId || sProfile?.sid || '';
        let fetchedMarks: any[] = [];
        if (sId) {
          const marksSnapshot = await getDocs(
            query(collection(db, 'marks'), where('studentId', '==', sId))
          );
          fetchedMarks = marksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const marksSnapshot = await getDocs(collection(db, 'marks'));
          fetchedMarks = marksSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((m: any) => m.studentId === sId || m.studentName === (sProfile?.fullName || sProfile?.name));
        }
        setStaticMarks(fetchedMarks);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'results');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [attemptId, navigate, user, profile]);

  if (loading) return <div className="p-8 text-center animate-pulse">Calculating score...</div>;
  if (!attempt || !exam) return null;

  const scorePercentage = Math.round((attempt.score || 0) / (attempt.totalPoints || 1) * 100);
  const isPassed = scorePercentage >= 50;

  // --- GRADE 12 NATIONAL EXAM CERTIFICATE / MOCK REMAPPING AND COMPILATION ---
  const studentProfileStream = studentProfile?.stream || profile?.stream || 'social';
  
  // Clean subject stream selector
  const reportStream: 'social' | 'natural' = (studentProfileStream === 'natural' || studentProfileStream === 'Natural Science' || studentProfileStream.toLowerCase().includes('natural')) ? 'natural' : 'social';

  const certificateSubjects = (SUBJECTS_BY_GRADE['12']?.[reportStream] || []).filter(sub => {
    const norm = normalizeSubject(sub).toLowerCase().replace(/\s+/g, '');
    return norm !== 'hpe' && 
           norm !== 'afaanoromoo' && 
           norm !== 'afaanoromo' && 
           norm !== 'citizenship' && 
           norm !== 'citizenshipeducation' &&
           norm !== 'civics';
  });

  const mockMarksGrouped: Record<string, { score: number; recorded: boolean }> = {};
  
  certificateSubjects.forEach(sub => {
    mockMarksGrouped[sub] = { score: 0, recorded: false };
  });

  // 1. Populate from static marks
  const studentMarks = [...staticMarks];

  // 2. Populate from best online attempts
  const bestOnlineAttempts: Record<string, {
    att: ExamAttempt;
    scaledScore: number;
    totalPoints: number;
    normSub: string;
    assessmentType: 'mid_exam' | 'final_exam' | 'mock_exam';
  }> = {};

  allAttempts.forEach(att => {
    const matchedExam = allExams.find(e => e.id === att.examId);
    if (!matchedExam) return;

    let assessmentType: 'mid_exam' | 'final_exam' | 'mock_exam' = 'final_exam';
    let totalPoints = 70;
    if (matchedExam.type === 'mid') {
      assessmentType = 'mid_exam';
      totalPoints = 30;
    } else if (matchedExam.type === 'eaes_mock' || matchedExam.type === 'model') {
      assessmentType = 'mock_exam';
      totalPoints = 100;
    }

    const attemptScore = att.score || 0;
    const attemptTotal = att.totalPoints || 1;
    const scaledScore = Math.min(totalPoints, Math.round((attemptScore / attemptTotal) * totalPoints * 10) / 10);

    const normSub = normalizeSubject(matchedExam.subject || att.examSubject);
    const key = `${normSub}_${assessmentType}`;

    if (!bestOnlineAttempts[key] || scaledScore > bestOnlineAttempts[key].scaledScore) {
      bestOnlineAttempts[key] = {
        att,
        scaledScore,
        totalPoints,
        normSub,
        assessmentType
      };
    }
  });

  // Merge online mock exam attempts as fallback if they are higher score than static marks
  Object.values(bestOnlineAttempts).forEach(item => {
    if (item.assessmentType === 'mock_exam') {
      const hasPreExistingMarkIndex = studentMarks.findIndex(m => 
        normalizeSubject(m.subject) === item.normSub && 
        m.assessmentType === item.assessmentType
      );

      if (hasPreExistingMarkIndex !== -1) {
        if (item.scaledScore > studentMarks[hasPreExistingMarkIndex].score) {
          studentMarks[hasPreExistingMarkIndex].score = item.scaledScore;
        }
      } else {
        studentMarks.push({
          id: `db_online_exam_${item.att.id}`,
          studentId: studentProfile?.studentId || studentProfile?.sid || '',
          studentName: studentProfile?.fullName || studentProfile?.name || 'Student',
          subject: item.normSub,
          assessmentType: item.assessmentType,
          score: item.scaledScore,
          totalPoints: item.totalPoints,
          recordedBy: 'Online Exam Hub (Highest Attempt)',
          recordedAt: item.att.finishedAt || new Date()
        });
      }
    }
  });

  // Re-group mock exam scores
  studentMarks.forEach(m => {
    if (m.assessmentType === 'mock_exam') {
      const normSub = normalizeSubject(m.subject);
      const matchingSub = certificateSubjects.find(s => normalizeSubject(s).toLowerCase().replace(/\s+/g, '') === normSub.toLowerCase().replace(/\s+/g, ''));
      if (matchingSub) {
        mockMarksGrouped[matchingSub].score = m.score;
        mockMarksGrouped[matchingSub].recorded = true;
      }
    }
  });

  // Ensure current attempt is counted as mock_exam if the current exam is mock/model
  if (exam && (exam.type === 'eaes_mock' || exam.type === 'model')) {
    const normSub = normalizeSubject(exam.subject);
    const matchingSub = certificateSubjects.find(s => normalizeSubject(s).toLowerCase().replace(/\s+/g, '') === normSub.toLowerCase().replace(/\s+/g, ''));
    if (matchingSub) {
      const currentAttemptScore = Math.min(100, Math.round(((attempt?.score || 0) / (attempt?.totalPoints || 1)) * 100));
      if (!mockMarksGrouped[matchingSub].recorded || currentAttemptScore > mockMarksGrouped[matchingSub].score) {
        mockMarksGrouped[matchingSub].score = currentAttemptScore;
        mockMarksGrouped[matchingSub].recorded = true;
      }
    }
  }

  const mockRowKeys = Object.keys(mockMarksGrouped).sort((a, b) => {
    const aIdx = certificateSubjects.indexOf(a);
    const bIdx = certificateSubjects.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  let totalMockPointsObtained = 0;
  let recordedMockSubjectsCount = 0;
  mockRowKeys.forEach(sub => {
    if (mockMarksGrouped[sub].recorded) {
      totalMockPointsObtained += mockMarksGrouped[sub].score;
      recordedMockSubjectsCount++;
    }
  });

  const mockAverage = recordedMockSubjectsCount > 0 ? Math.round(totalMockPointsObtained / recordedMockSubjectsCount) : 0;

  let sumGPAs = 0;
  let gradedCount = 0;
  mockRowKeys.forEach(sub => {
    if (mockMarksGrouped[sub].recorded) {
      const score = mockMarksGrouped[sub].score;
      let gpaValue = 0.0;
      if (score >= 90) gpaValue = 4.00;
      else if (score >= 83) gpaValue = 3.75;
      else if (score >= 75) gpaValue = 3.50;
      else if (score >= 68) gpaValue = 3.00;
      else if (score >= 60) gpaValue = 2.50;
      else if (score >= 50) gpaValue = 2.00;
      else if (score >= 40) gpaValue = 1.00;
      else gpaValue = 0.00;
      
      sumGPAs += gpaValue;
      gradedCount++;
    }
  });

  const mockAGPA = gradedCount > 0 ? (sumGPAs / gradedCount).toFixed(2) : "0.00";
  const mockPassedSubjectsCount = mockRowKeys.filter(sub => {
    const sObj = mockMarksGrouped[sub];
    return sObj.recorded && sObj.score >= 50;
  }).length;

  const mockFailedSubjectsCount = mockRowKeys.filter(sub => {
    const sObj = mockMarksGrouped[sub];
    return sObj.recorded && sObj.score < 50;
  }).length;

  const doesQualifyForEAESNational = mockAverage >= 50;

  const getGrade = (total: number) => {
    if (total >= 90) return 'A+';
    if (total >= 83) return 'A';
    if (total >= 75) return 'B+';
    if (total >= 68) return 'B';
    if (total >= 60) return 'C+';
    if (total >= 50) return 'C';
    if (total >= 40) return 'D';
    return 'F';
  };

  const filteredAnswers = answers.filter(answer => {
    if (filter === 'incorrect') return !answer.isCorrect;
    if (filter === 'correct') return answer.isCorrect;
    return true;
  });

  const exportPrintSlipPDF = () => {
    if (!attempt || !exam) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header & Branding
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.rect(10, 10, 190, 277);

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(15, 15, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('B', 19.5, 23);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text('BIFTU BERI SECONDARY SCHOOL', 32, 19);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('EXAMINATION RESULT SLIP • OFFICIAL RECORD', 32, 24);

    doc.setLineWidth(0.5);
    doc.line(15, 30, 195, 30);

    // Student Information
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 35, 180, 45, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(15, 35, 180, 45);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('STUDENT NAME', 20, 42);
    doc.text('EXAM SUBJECT', 20, 57);
    doc.text('SUBMISSION ID', 20, 72);

    doc.text('STUDENT ID', 110, 42);
    doc.text('EXAM TYPE', 110, 57);
    doc.text('ATTEMPT DATE', 110, 72);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(profile?.fullName || profile?.name || 'Academic Scholar', 20, 47);
    doc.text(exam.subject.toUpperCase(), 20, 62);
    doc.text(attempt.id.substring(0, 12).toUpperCase(), 20, 77);

    doc.text(profile?.studentId || 'N/A', 110, 47);
    doc.text(exam.type.toUpperCase(), 110, 62);
    doc.text(format(attempt.startedAt?.toDate?.() || new Date(), 'dd/MM/yyyy HH:mm'), 110, 77);

    // Performance Summary
    doc.setFontSize(11);
    doc.text('PERFORMANCE SUMMARY', 15, 95);
    
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.line(15, 98, 40, 98);

    autoTable(doc, {
      startY: 105,
      head: [['Metric / Taqaa', 'Value / Qabxii']],
      body: [
        ['Score Percentage', `${scorePercentage}%`],
        ['Raw Score (Points)', `${attempt.score} / ${attempt.totalPoints}`],
        ['Total Questions', (attempt as any).totalQuestions || 0],
        ['System Violations', attempt.violations || 0],
        ['Status', isPassed ? 'PASSED / DABRE' : 'FAILED / HIN DABRE'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      margin: { left: 15, right: 15 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    // Signature Area
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('School Digital Seal', 15, finalY);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, finalY + 15, 60, finalY + 15);

    doc.text('Registrar Signature', 140, finalY);
    doc.line(140, finalY + 15, 185, finalY + 15);

    // Footer
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated at ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')} • Biftu Beri Scholastic Schema`, 105, 282, { align: 'center' });

    doc.save(`Exam_Slip_${exam.subject}_${profile?.name || 'Student'}.pdf`);
  };

  const handlePrintStandard = () => {
    setPrintLayout('standard');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintCertificate = () => {
    setPrintLayout('certificate');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getLetterGrade = (percentage: number) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 83) return 'A';
    if (percentage >= 75) return 'B+';
    if (percentage >= 68) return 'B';
    if (percentage >= 60) return 'C+';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto space-y-8 print:hidden">
        {attempt.status === 'timed-out' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-3xl flex items-center gap-4 shadow-sm"
          >
             <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
               <Clock size={20} />
             </div>
             <span className="font-bold text-sm uppercase tracking-wide">{t('exam.timesUp')}</span>
          </motion.div>
        )}

        {/* Result Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
        >
          <div className={`p-10 text-white text-center space-y-6 ${isPassed ? 'bg-emerald-600 shadow-emerald-900/10' : 'bg-gradient-to-br from-indigo-650 to-blue-700 shadow-indigo-950/10'}`}>
            <div className="inline-flex py-4 px-4 bg-white/20 rounded-[32px] backdrop-blur-md mb-2 shadow-inner border border-white/10">
              <Trophy size={56} className={isPassed ? 'text-amber-300' : 'text-blue-200'} />
            </div>
            <h1 className="text-5xl font-black tracking-tighter">{isPassed ? t('results.excellent') : t('results.keepPracticing')}</h1>
            <p className="text-white/80 font-black uppercase tracking-[0.2em] text-xs">{t('results.completedExam')} - {exam.subject}</p>
          </div>

          <div className="p-10 grid grid-cols-3 gap-8 border-b border-slate-100 text-center">
            <div className="space-y-2">
              <span className="text-4xl font-black text-slate-900 tracking-tight">{scorePercentage}%</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('results.finalScore')}</p>
            </div>
            <div className="space-y-2 border-x border-slate-100">
              <span className="text-4xl font-black text-slate-900 tracking-tight">{attempt.score}/{attempt.totalPoints}</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('results.points')}</p>
            </div>
            <div className={`space-y-2 ${attempt.violations! > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              <span className="text-4xl font-black tracking-tight">{attempt.violations || 0}</span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('results.violations')}</p>
            </div>
          </div>

          <div className="p-8 flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm">
                <BookOpen size={24} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-black text-xs uppercase tracking-widest text-slate-400">{t('results.attemptDate')}</p>
                <p className="text-slate-900 font-bold">{format(attempt.startedAt?.toDate?.() || new Date(), 'MMMM d, yyyy • h:mm a')}</p>
              </div>
            </div>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
              <button
                 onClick={handlePrintCertificate}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-amber-500 text-slate-950 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20 text-center leading-none"
              >
                <Award size={16} />
                Print Certificate
              </button>
              <button
                 onClick={handlePrintStandard}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/10 text-center leading-none"
               >
                 <Printer size={16} />
                 Export to PDF
               </button>
               <button
                  onClick={exportPrintSlipPDF}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white text-blue-600 border-2 border-blue-100 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-lg shadow-blue-500/5 text-center leading-none"
               >
                 <Printer size={16} />
                 Print Slip
               </button>
              <button
                 onClick={() => navigate('/dashboard')}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10"
              >
                <ArrowLeft size={18} />
                {t('common.back')}
              </button>
              <button
                 onClick={() => navigate(`/exam/${exam.id}/review/${attemptId}`)}
                 className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
              >
                <Eye size={18} />
                {t('results.detailedReview')}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Breakdown with Custom Tabs */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 uppercase">
                {language === 'om' ? 'Xiinxala Gaaffilee' : 'Question Breakdown'}
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase">
                {language === 'om' ? 'Deebii kee sakatta\'i, dogongora kee sirreessi' : 'Review your responses and correct mistakes'}
              </p>
            </div>
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filter === 'all' 
                    ? 'bg-white text-slate-950 shadow-sm font-black' 
                    : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                {language === 'om' ? 'Hundumaa' : 'All'} ({answers.length})
              </button>
              <button
                onClick={() => setFilter('incorrect')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === 'incorrect' 
                    ? 'bg-red-500 text-white shadow-sm font-black' 
                    : 'text-red-750 hover:bg-red-50 bg-transparent'
                }`}
              >
                <span>{language === 'om' ? 'Dogongora' : 'Mistakes'}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === 'incorrect' ? 'bg-white text-red-650' : 'bg-red-100 text-red-700'}`}>
                  {answers.filter(a => !a.isCorrect).length}
                </span>
              </button>
              <button
                onClick={() => setFilter('correct')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === 'correct' 
                    ? 'bg-emerald-500 text-white shadow-sm font-black' 
                    : 'text-emerald-700 hover:bg-emerald-50 bg-transparent'
                }`}
              >
                <span>{language === 'om' ? 'Sirrii' : 'Correct'}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === 'correct' ? 'bg-white text-emerald-600' : 'bg-emerald-100 text-emerald-750'}`}>
                  {answers.filter(a => a.isCorrect).length}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAnswers.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-sm">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                  {language === 'om' ? 'Gaafiin filter kanaan argame hin jiru' : 'No questions match this filter'}
                </p>
                <button 
                  onClick={() => setFilter('all')}
                  className="text-xs font-black text-blue-600 hover:underline uppercase tracking-wider"
                >
                  {language === 'om' ? 'Gaaffilee Hundumaa Agarsiisi' : 'Show All Questions'}
                </button>
              </div>
            ) : (
              filteredAnswers.map((answer, idx) => {
                const actualIndex = answers.findIndex(a => a.id === answer.id) + 1;
                return (
                  <div 
                    key={answer.id}
                    className={`bg-white p-6 sm:p-8 rounded-[36px] border-2 transition-all shadow-md flex items-start gap-4 sm:gap-6 relative overflow-hidden ${
                      answer.isCorrect 
                        ? 'border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-200/30' 
                        : 'border-rose-100 hover:border-rose-350 bg-rose-50/5 hover:shadow-rose-200/35'
                    }`}
                  >
                    {/* Visual Status Indicator strip */}
                    <div className={`absolute top-0 left-0 bottom-0 w-2.5 ${answer.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                    <div className={`mt-1.5 shrink-0 ${answer.isCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {answer.isCorrect ? <CheckCircle2 size={26} /> : <XCircle size={26} />}
                    </div>
                    <div className="flex-grow space-y-4">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-50 pb-3">
                         <p className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight flex items-center gap-2">
                           <span className="text-slate-400 font-mono text-sm">Q{actualIndex}.</span>
                           {answer.question?.text || 'Question removed'}
                         </p>
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest self-start sm:self-auto ${
                           answer.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                         }`}>
                           {answer.isCorrect 
                             ? (language === 'om' ? 'Sirrii / Correct' : 'Correct') 
                             : (language === 'om' ? 'Miseeka / Incorrect' : 'Incorrect')}
                         </span>
                       </div>
                       
                       {/* Display Options list, highlighting beautifully with clear side status labels */}
                       {answer.question?.options && (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
                           {answer.question.options.map((opt, oIdx) => {
                             const isSelected = oIdx === answer.selectedOptionIndex;
                             const isCorrectOpt = oIdx === answer.question?.correctOptionIndex;
                             
                             let badgeText = '';
                             if (isCorrectOpt && isSelected) {
                               badgeText = language === 'om' ? 'Deebii Keefi Sirrii' : 'Your Response & Correct';
                             } else if (isCorrectOpt) {
                               badgeText = language === 'om' ? 'Deebii Sirrii' : 'Correct Answer';
                             } else if (isSelected) {
                               badgeText = language === 'om' ? 'Debii Kee (Dogoggora)' : 'Your Response (Incorrect)';
                             }

                             return (
                               <div 
                                 key={oIdx}
                                 className={`px-4 py-3.5 rounded-2xl border text-xs sm:text-sm font-bold transition-all flex flex-col justify-between gap-1.5 ${
                                   isCorrectOpt 
                                     ? 'bg-emerald-50 border-emerald-350 text-emerald-900 shadow-sm shadow-emerald-100' 
                                     : isSelected
                                       ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm shadow-rose-100'
                                       : 'bg-slate-50/75 border-slate-200 text-slate-500 opacity-80 hover:opacity-100'
                                 }`}
                               >
                                 <div className="flex items-start gap-2">
                                   <span className={`text-[10px] font-black uppercase tracking-tight ${isCorrectOpt ? 'text-emerald-600' : 'text-slate-400'}`}>
                                     {String.fromCharCode(65 + oIdx)})
                                   </span>
                                   <span className="leading-tight">{opt}</span>
                                 </div>
                                 {badgeText && (
                                   <div className="flex items-center gap-1.5 mt-1 self-start">
                                     {isCorrectOpt ? <CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> : <XCircle size={12} className="text-red-500 shrink-0" />}
                                     <span className={`text-[9px] font-black uppercase tracking-wider ${isCorrectOpt ? 'text-emerald-700' : 'text-rose-700'}`}>
                                       {badgeText}
                                     </span>
                                   </div>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       )}

                       <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border ${
                            answer.isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {language === 'om' ? 'Filannoo Kee:' : 'Your Response:'} {answer.selectedOptionIndex !== -1 && answer.question?.options ? `${String.fromCharCode(65 + answer.selectedOptionIndex)}) ${answer.question.options[answer.selectedOptionIndex]}` : (language === 'om' ? 'Hingalle / Hambifame' : 'None / Not Answered')}
                          </span>
                          {!answer.isCorrect && (
                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold uppercase tracking-wide border border-emerald-200">
                              {language === 'om' ? 'Deebii Sirrii:' : 'Correct Answer:'} {answer.question?.options ? `${String.fromCharCode(65 + answer.question.correctOptionIndex)}) ${answer.question.options[answer.question.correctOptionIndex]}` : 'N/A'}
                            </span>
                          )}
                       </div>

                       {answer.question?.explanation ? (
                         <div className="bg-blue-50/40 p-5 rounded-2xl border-2 border-dashed border-blue-200/60 text-sm text-blue-900 space-y-1.5">
                           <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] text-blue-600">
                             <BookOpen size={14} />
                             <span>{language === 'om' ? 'QAACCOYAA FI IBSA GAD-FAGEENYAA' : 'EXPLANATION / ANALYSIS'}</span>
                           </div>
                           <p className="italic font-medium leading-relaxed">
                             {answer.question.explanation}
                           </p>
                         </div>
                       ) : (
                         <div className="bg-amber-50/40 p-5 rounded-2xl border-2 border-dashed border-amber-250/60 text-sm text-amber-900 space-y-1.5">
                           <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] text-amber-600">
                             <BookOpen size={14} />
                             <span>{language === 'om' ? 'IBSA SIRREEFFAMAA / EXPLANATION' : 'FALLBACK EXPLANATION'}</span>
                           </div>
                           <p className="italic font-medium leading-relaxed leading-normal text-amber-850">
                             {language === 'om' 
                               ? `Filannoon sirriin qubee "${String.fromCharCode(65 + (answer.question?.correctOptionIndex ?? 0))}" dha. Hubannoo dabalataaf maaloo kitaaba barnootaa keessan dubbisaa yookaan barsiisaa keessan mariisisaa!` 
                               : `Option (${String.fromCharCode(65 + (answer.question?.correctOptionIndex ?? 0))}) is the correct answer for this question. For a deeper understanding, please consult your textbook lessons or discuss directly with your teacher!`}
                           </p>
                         </div>
                       )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button
          onClick={() => navigate(`/exam/${exam.id}/take`)}
          className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw size={20} />
          {t('results.retake')}
        </button>
      </div>

      <PostExamFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        examId={exam.id || ''}
        attemptId={attemptId || ''}
        subject={exam.subject}
      />

      {/* The gorgeous print-only student report card */}
      <div className={`printable-report-card ${printLayout === 'standard' ? 'hidden print:block' : 'hidden'} bg-white border-8 border-slate-950 p-8 sm:p-12 space-y-8 relative overflow-hidden font-sans`}>
        {/* School Header Graphic Banner */}
        <div className="border-b-4 border-slate-955 pb-6 flex flex-row items-center justify-between gap-6 text-left">
          <div className="flex items-center gap-4">
            <img 
              src={schoolLogo} 
              alt="School Logo" 
              className="w-20 h-20 object-contain rounded-[24px] border-4 border-slate-950 bg-white shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <h2 className="text-2xl font-black text-slate-955 uppercase tracking-tight">
                BIFTU BERI SECONDARY SCHOOL
              </h2>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-0.5">
                Sinnii Boqonnaa Lammii - National EAES Examination Portal
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mt-1">
                Official Simulated Examination Result Certificate
              </p>
            </div>
          </div>
          <div className="text-right border-4 border-slate-955 p-2.5 rounded-2xl bg-slate-50 shrink-0">
            <div className="text-[10px] font-black text-slate-950 uppercase">OFFICIAL EAES RECORD</div>
            <div className="text-xs font-black text-blue-700">ACADEMIC REPORT CARD</div>
            <div className="text-[8px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">
              Year: {new Date().getFullYear()} G.C
            </div>
          </div>
        </div>

        {/* PROFILE METADATA SECTION */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border-2 border-slate-955 text-left">
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Student Full Name</span>
            <span className="font-black text-slate-955 block text-xs truncate">
              {profile?.fullName || profile?.name || 'Academic Scholar'}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Student ID Number</span>
            <span className="font-black text-slate-955 block text-xs tracking-wider">
              {profile?.studentId || 'N/A'}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tested Subject / Category</span>
            <span className="font-black text-slate-955 block text-xs uppercase text-blue-700">
              {exam.subject}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Exam Type / Standard</span>
            <span className="font-black text-slate-955 block text-xs uppercase text-amber-600">
              {exam.type}
            </span>
          </div>
        </div>

        {/* SCORE & EVALUATION SUMMARY PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Big Score Badge Circle Left */}
          <div className="col-span-1 border-2 border-slate-955 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Final Evaluation</span>
            <div className="relative flex items-center justify-center w-28 h-28 border-4 border-slate-955 rounded-full bg-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
              <div className="text-center">
                <span className="text-3xl font-black text-slate-955 block leading-none">{scorePercentage}%</span>
                <span className="text-[10px] font-black uppercase text-blue-600">Accuracy</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-500">Letter Grade:</span>
              <span className="px-2.5 py-0.5 bg-slate-950 text-white rounded-lg text-xs font-black">
                {getLetterGrade(scorePercentage)}
              </span>
            </div>
          </div>

          {/* Metric Records Grid Right */}
          <div className="col-span-2 border-2 border-slate-955 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Assessment Title</span>
                <span className="text-xs font-extrabold text-slate-955">{exam.title}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Raw Score Obtained</span>
                <span className="text-xs font-extrabold text-slate-955">{attempt.score} / {attempt.totalPoints} Points</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Exam Attempt ID</span>
                <span className="text-xs font-mono font-bold text-slate-500">{attempt.id.substring(0, 16).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Security Violations Tracked</span>
                <span className={`text-xs font-extrabold ${attempt.violations! > 0 ? 'text-red-650' : 'text-emerald-600'}`}>
                  {attempt.violations || 0} Violations
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase">Result Status</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                  isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isPassed ? 'PASSED / DABRE' : 'FAILED / HIN DABRE'}
                </span>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-slate-500 leading-normal italic mt-4">
              "Knowledge is the light that removes darkness from society. Proceed forward with diligence and integrity."
            </p>
          </div>
        </div>

        {/* SIGNATURES AREA */}
        <div className="print-signature-area grid grid-cols-3 gap-8 text-center text-[9px] font-black uppercase text-slate-400">
          <div className="space-y-6 pt-2">
            <span className="block border-t border-slate-350 pt-2">Advising Teacher</span>
          </div>
          <div className="flex flex-col items-center justify-end">
            <div className="w-14 h-14 border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center opacity-60">
              <span className="text-[8px] font-bold text-slate-405">SEAL</span>
            </div>
          </div>
          <div className="space-y-6 pt-2">
            <span className="block text-slate-950 font-extrabold mb-1">Jemal Fano Haji</span>
            <span className="block border-t border-slate-350 pt-2 text-slate-400">System Admin Coordinator</span>
          </div>
        </div>

        {/* FOOTER METADATA */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Biftu Beri Secondary School • Oromia Regional State</span>
          <span>Generated: {format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
        </div>
      </div>

      {/* THE GRADE 12 MOCK/EAES NATIONAL EXAM CERTIFICATE VIEW */}
      <div 
        id="printable-national-certificate" 
        className={`printable-report-card ${printLayout === 'certificate' ? 'hidden print:block' : 'hidden'} bg-white rounded-[45px] border-8 border-amber-500 shadow-2xl p-8 md:p-12 max-w-4xl mx-auto space-y-10 relative overflow-hidden print:border-none print:shadow-none print:p-0 font-sans`}
      >
        {/* Vintage gold ornamental pattern borders around the certificate */}
        <div className="absolute inset-4 border-2 border-dashed border-amber-600/30 rounded-[35px] pointer-events-none print:inset-0 print:border-amber-600/20" />
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* State/School Header Graphic Banner */}
        <div className="border-b-4 border-amber-500 pb-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-5">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-yellow-500 text-white rounded-[28px] border-4 border-amber-600 flex items-center justify-center text-4xl font-black shadow-lg select-none">
              ★
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-955 uppercase tracking-tight flex items-center justify-center md:justify-start gap-2 text-left">
                <span>Biftu Beri Secondary School</span>
              </h2>
              <p className="text-xs font-black text-amber-600 uppercase tracking-widest mt-1 text-left">
                NATIONAL EDUCATION ASSESSMENT & EXAMINATIONS AGENCY (EAES)
              </p>
              <p className="text-[10px] text-slate-500 leading-none font-bold mt-1.5 uppercase tracking-wide text-left">
                Sertifikata Madaallii Qophii Qormaata Biyyoolessaa Kutaa 12ffaa
              </p>
            </div>
          </div>
          <div className="text-center md:text-right border-4 border-amber-500 p-3 rounded-2xl bg-amber-50/50 min-w-[200px] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest leading-none">
              EAES MODEL
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mt-1">CERTIFICATE NO</span>
            <strong className="block text-sm text-slate-900 font-black tracking-widest font-mono">
              EAES-{(studentProfile?.studentId || profile?.studentId || 'MOCK-' + (studentProfile?.uid || profile?.uid || 'USER').slice(0, 6)).toUpperCase()}
            </strong>
            <span className="text-[9px] font-black text-amber-700 block uppercase tracking-wider mt-0.5">Grade 12 {reportStream.toUpperCase()} Stream</span>
          </div>
        </div>

        {/* Main Certificate Title & Sub-badge */}
        <div className="text-center space-y-4 pt-4 relative z-10">
          <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-300">
            Official Examination Readiness Performance Record
          </div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">
            Grade 12 National Mock Examination Certificate
          </h3>
          <p className="text-xs font-bold text-slate-500 max-w-2xl mx-auto leading-relaxed">
            This document certifies that the candidate declared below has fully completed the high-fidelity Grade 12 National Mock Evaluations modeled on the Federal EAES Examination Matrix.
          </p>
        </div>

        {/* Student Bio Metadata Panel */}
        <div className="bg-slate-50 p-6 rounded-[24px] border-2 border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold uppercase tracking-wide text-slate-700 relative z-10 text-left">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <span className="text-[10px] font-black text-slate-400">Student Full Name:</span>
              <span className="font-extrabold text-slate-900">{studentProfile?.fullName || studentProfile?.name || profile?.fullName || profile?.name || 'Academic Scholar'}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1.5">
              <span className="text-[10px] font-black text-slate-400">National Registration ID:</span>
              <span className="font-black text-slate-900 font-mono tracking-wider">{studentProfile?.studentId || profile?.studentId || 'NOT ASSIGNED'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <span className="text-[10px] font-black text-slate-400">Academic stream type:</span>
              <span className="font-extrabold text-amber-700">{reportStream} science</span>
            </div>
            <div className="flex items-center justify-between border-b pb-1.5">
              <span className="text-[10px] font-black text-slate-400">School Affiliation:</span>
              <span className="font-extrabold text-slate-900">Biftu Beri Secondary</span>
            </div>
          </div>
        </div>

        {/* Score Chart Grid Table */}
        <div className="border-[5px] border-slate-950 bg-white rounded-3xl overflow-hidden shadow-md relative z-10">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-900 text-white border-b-2 border-slate-950 uppercase text-[10px] font-black tracking-widest animate-none">
                  <th className="px-6 py-4 border-r border-slate-800">Subject Area / Barnoota</th>
                  <th className="px-6 py-4 text-center border-r border-slate-800">Assessment Type</th>
                  <th className="px-6 py-4 text-center border-r border-slate-800">National Max Score</th>
                  <th className="px-6 py-4 text-center border-r border-amber-500 bg-amber-500 text-slate-950">Score Obtained (100)</th>
                  <th className="px-6 py-4 text-center border-r border-slate-200 animate-none">Letter Grade</th>
                  <th className="px-6 py-4 text-center animate-none">Status / Milkaa'ina</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-200">
                {mockRowKeys.map((sub) => {
                  const scoreData = mockMarksGrouped[sub];
                  const scoreVal = scoreData.score;
                  const letterGrade = scoreData.recorded ? getGrade(scoreVal) : 'N/A';
                  const statusText = !scoreData.recorded ? 'NOT TAKEN' : scoreVal >= 50 ? 'PASS' : 'FAIL';

                  return (
                    <tr key={sub} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 border-r-2 border-slate-200 font-extrabold text-slate-900">{sub}</td>
                      <td className="px-6 py-4 text-center border-r border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        National Mock / EAES
                      </td>
                      <td className="px-6 py-4 text-center border-r border-slate-150 font-mono text-slate-400 text-sm font-bold">100</td>
                      <td className="px-6 py-4 text-center border-r border-slate-200 bg-amber-50 font-mono font-black text-base text-amber-800">
                        {scoreData.recorded ? scoreVal : '-'}
                      </td>
                      <td className="px-6 py-4 text-center border-r border-slate-200">
                        <span className={`px-2.5 py-1 text-xs font-black rounded-lg ${
                          letterGrade.startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
                          letterGrade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                          letterGrade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                          letterGrade === 'N/A' ? 'bg-slate-100 text-slate-400' : 'bg-red-500 text-red-800'
                        }`}>
                          {letterGrade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black">
                        <span className={`px-2.5 py-1 text-[10px] rounded-full uppercase tracking-widest ${
                          !scoreData.recorded ? 'bg-slate-100 text-slate-400' :
                          scoreVal >= 50 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm'
                        }`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aggregate Metrix summaries panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 relative z-10 text-left">
          <div className="bg-slate-50 border-2 border-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-black text-slate-400 block uppercase tracking-widest">Completed subjects</span>
            <strong className="text-xl font-black text-slate-900 block tracking-tight">
              {recordedMockSubjectsCount} / 7
            </strong>
          </div>
          <div className="bg-slate-50 border-2 border-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-black text-slate-400 block uppercase tracking-widest">Total Mock Points</span>
            <strong className="text-xl font-black text-slate-900 block tracking-tight">
              {Math.round(totalMockPointsObtained)} / 700
            </strong>
          </div>
          <div className="bg-slate-50 border-2 border-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-black text-slate-400 block uppercase tracking-widest">National AGPA Equivalent</span>
            <strong className="text-xl font-black text-amber-600 block tracking-tight">
              {mockAGPA} / 4.00
            </strong>
          </div>
          <div className="bg-slate-50 border-2 border-slate-950 p-4 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-black text-slate-400 block uppercase tracking-widest">EAES Standard Status</span>
            <strong className={`text-xs font-black uppercase block tracking-wider mt-1 ${doesQualifyForEAESNational ? 'text-emerald-600' : 'text-red-650'}`}>
              {doesQualifyForEAESNational ? 'QUALIFIED (PASSED)' : 'NOT QUALIFIED'}
            </strong>
          </div>
        </div>

        {/* Vintage Seal and Signatures row */}
        <div className="print-signature-area grid grid-cols-4 gap-8 text-center text-[10px] font-black uppercase text-slate-400 relative z-10 pt-4">
          <div className="space-y-6">
            <div className="h-10 flex items-center justify-center font-mono italic text-slate-600 leading-none text-xs">
              MOCK VALIDATED
            </div>
            <span className="block border-t border-slate-955 pt-2 text-slate-955">EAES Coordinator</span>
          </div>
          <div className="flex flex-col items-center justify-end">
            <div className="w-16 h-16 border-4 border-double border-amber-600 rounded-full flex items-center justify-center bg-amber-50/10">
              <div className="text-center">
                <span className="text-[6px] font-black text-amber-700 block leading-none">OFFICIAL SEAL</span>
                <span className="text-[5px] font-black text-slate-500 block leading-none mt-0.5">BIFTU BERI SEC</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-end">
            <div className="w-16 h-16 border-2 border-amber-500/30 rounded-xl bg-slate-50 flex items-center justify-center p-1 relative shadow-sm overflow-hidden">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=d97706&data=${encodeURIComponent(window.location.origin + '/results/' + attemptId)}`}
                alt="Verification QR Code"
                className="w-[90%] h-[90%] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="mt-1 text-center">
              <span className="text-[6px] font-black text-amber-600 block leading-none tracking-widest">SCAN TO VERIFY</span>
              <span className="text-[4px] text-slate-400 block leading-none mt-0.5 font-mono">DIGITAL ID</span>
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-10 flex flex-col justify-end">
              <span className="block text-slate-955 text-xs font-black tracking-tight leading-none mb-1">Jemal Fano Haji</span>
              <span className="text-[7px] text-slate-400 font-black tracking-wider block">Registrar & Systems Coordinator</span>
            </div>
            <span className="block border-t border-slate-955 pt-2 text-slate-955 font-black">Authorized Registrar</span>
          </div>
        </div>

        {/* Footer Metadata */}
        <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-widest gap-2 relative z-10 text-left">
          <span>Grade 12 Academic Compiling Slip • Simulated Examinations Agency Portal</span>
          <span>Security hash: MD5-{attemptId?.slice(0, 8).toUpperCase()}-EAES</span>
        </div>
      </div>
    </div>
  );
}
