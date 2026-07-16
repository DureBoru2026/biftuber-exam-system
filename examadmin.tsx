import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, createAuditLog } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Exam, Question, GradeLevel } from '@/src/types';
import jsPDF from 'jspdf';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  HelpCircle,
  AlertCircle,
  Clock,
  Calendar,
  BookOpen,
  Layout,
  Send,
  Sparkles,
  FileUp,
  BrainCircuit,
  GripVertical,
  ChevronRight,
  Globe,
  Lock,
  FileText,
  Archive,
  Search,
  Download
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { format } from 'date-fns';
import { ExamAttempt, AcademicStream } from '@/src/types';
import QuestionImporter from './QuestionImporter';
import AIGenerator from './AIGenerator';
import { ExtractedQuestion } from '@/src/services/aiService';

import { 
  SUBJECTS_BY_GRADE, 
  DEFAULT_EXAM_DESCRIPTION 
} from '@/src/constants';
import { useLanguage } from '@/src/contexts/LanguageContext';

export default function ExamAdmin() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const isStaff = profile?.role === 'staff';
  const isAdmin = profile?.role === 'admin';
  const hasManagementAccess = isAdmin || isStaff;

  const getBilingualStatusLabel = (s: string | undefined): string => {
    if (s === 'draft') return 'Draft / Duroo';
    if (s === 'published') return 'Published / Kan Maxxanfame';
    if (s === 'archived') return 'Archived / Kuusame';
    return s || '';
  };

  const [exam, setExam] = useState<Partial<Exam>>({
    title: '',
    subject: profile?.subject || '',
    grade: profile?.grade || '12',
    stream: profile?.stream || 'natural',
    durationMinutes: 60,
    status: 'draft',
    dueDate: null,
    type: 'model',
    description: language === 'om' ? DEFAULT_EXAM_DESCRIPTION.om : DEFAULT_EXAM_DESCRIPTION.en
  });

  // Get available subjects for current grade/stream
  const availableSubjects = SUBJECTS_BY_GRADE[exam.grade as GradeLevel]?.[exam.stream as AcademicStream] || [];

  // Reset subject if not available in current grade/stream (Unless staff - they usually stick to one)
  useEffect(() => {
    if (!profile) return;
    if (examId === 'new' && profile.subject && !exam.subject) {
      setExam(prev => ({ ...prev, subject: profile.subject as string }));
    }
  }, [profile, examId, exam.subject]);

  useEffect(() => {
    if (exam.subject && !availableSubjects.includes(exam.subject) && !isStaff) {
      setExam(prev => ({ ...prev, subject: '' }));
    }
  }, [exam.grade, exam.stream, isStaff, availableSubjects]);
  
  const [questions, setQuestions] = useState<Partial<Question>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<{show: boolean, nextStatus: Exam['status'] | null}>({ 
    show: false, 
    nextStatus: null 
  });
  const [activeTab, setActiveTab] = useState<'settings' | 'questions' | 'results'>('settings');
  const [qSearchQuery, setQSearchQuery] = useState('');
  const [qSelectedCategory, setQSelectedCategory] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const uniqueCategories = React.useMemo(() => {
    const cats = questions
      .map(q => q.topic?.trim() || '')
      .filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [questions]);

  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [attemptUsers, setAttemptUsers] = useState<Record<string, any>>({});

  const handleStatusChangeRequest = (status: Exam['status']) => {
    if (status === exam.status) return;
    setShowStatusConfirm({ show: true, nextStatus: status });
  };

  const confirmStatusChange = async () => {
    if (showStatusConfirm.nextStatus) {
      const nextStatus = showStatusConfirm.nextStatus;
      setExam(prev => ({ ...prev, status: nextStatus }));
      
      // If exam exists, update it in DB immediately
      if (examId && examId !== 'new') {
        try {
          await updateDoc(doc(db, 'exams', examId), {
            status: nextStatus,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'exams');
        }
      }
    }
    setShowStatusConfirm({ show: false, nextStatus: null });
  };

  const exportResults = () => {
    if (attempts.length === 0) return;
    
    const headers = ['Full Name', 'Student ID', 'Finished/Started At', 'Score', 'Total Points', 'Percentage', 'Violations', 'Process Status'];
    const rows = attempts.map(att => {
      const userProfile = attemptUsers[att.userId];
      const isCompleted = att.status === 'completed' || att.status === 'timed-out';
      return [
        userProfile?.fullName || userProfile?.name || 'Unknown',
        userProfile?.sid || 'N/A',
        isCompleted && att.finishedAt
          ? format(att.finishedAt.toDate(), 'yyyy-MM-dd HH:mm')
          : `Started: ${att.startedAt ? format(att.startedAt.toDate(), 'yyyy-MM-dd HH:mm') : 'N/A'}`,
        isCompleted ? (att.score ?? 0) : 'N/A',
        isCompleted ? (att.totalPoints ?? 0) : 'N/A',
        isCompleted ? `${Math.round(((att.score || 0) / (att.totalPoints || 1)) * 100)}%` : 'In Progress',
        att.violations || 0,
        att.status || 'ongoing'
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `results_${exam.title!.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let unsubscribeAttempts: (() => void) | null = null;

    const loadData = async () => {
      if (examId === 'new') {
        setLoading(false);
        return;
      }
      if (!examId) return;

      try {
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (examDoc.exists()) {
          setExam({ id: examDoc.id, ...examDoc.data() } as Exam);
          const qSnapshot = await getDocs(query(collection(db, 'exams', examId, 'questions'), orderBy('orderIndex', 'asc')));
          setQuestions(qSnapshot.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...(data as any) } as Question;
          }));

          // Set up real-time listener for student attempts
          const attemptsQ = query(collection(db, 'attempts'), where('examId', '==', examId));
          unsubscribeAttempts = onSnapshot(attemptsQ, async (snapshot) => {
            const attemptList = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ExamAttempt));
            
            attemptList.sort((a, b) => {
              const dateA = a.startedAt?.toDate?.() || new Date(0);
              const dateB = b.startedAt?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime();
            });

            // Dynamically fetch user profiles for any user IDs we don't have yet or update them
            const userIds = Array.from(new Set(attemptList.map(a => a.userId)));
            if (userIds.length > 0) {
              const userDocs = await Promise.all(userIds.map(uid => getDoc(doc(db, 'users', uid))));
              const userProfiles: Record<string, any> = {};
              userDocs.forEach(d => {
                if (d.exists()) {
                  userProfiles[d.id] = d.data();
                }
              });
              setAttemptUsers(userProfiles);
            }

            setAttempts(attemptList);
          }, (err) => {
            console.error("Error with real-time attempts listener:", err);
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'exams');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribeAttempts) {
        unsubscribeAttempts();
      }
    };
  }, [examId]);

  const downloadExamPDF = (includeAnswerKey: boolean = true) => {
    if (!exam || questions.length === 0) return;

    // Securely record audit log trail for compliance
    if (isAdmin || isStaff) {
      createAuditLog('export_pdf', 'ExamAdmin', exam.id || 'N/A', `${exam.title} (${includeAnswerKey ? 'Full Key' : 'Student Practice'})`);
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const maxContentHeight = 265;
    
    let y = 20;

    const drawPageDecorations = (pageNum: number, totalPagesPlaceholder: string | number) => {
      // Draw elegant, light frame border
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.3);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

      // Draw subtle top banner bar
      doc.setFillColor(includeAnswerKey ? 15 : 22, includeAnswerKey ? 23 : 101, includeAnswerKey ? 42 : 52); // slate-900 or green-800
      doc.rect(10, 10, pageWidth - 20, 3, 'F');

      // Draw footer with page numbers
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Page / Fuellee ${pageNum} of ${totalPagesPlaceholder}`, pageWidth / 2, pageHeight - 13, { align: 'center' });
      doc.text('BIFTU BERI SECONDARY SCHOOL PORTAL', 15, pageHeight - 13, { align: 'left' });
      doc.text(includeAnswerKey ? 'FULL REFERENCE & EXPLANATION KEY' : 'OFFLINE PRACTICE PRACTICE COPY / DEEBII MALEE', pageWidth - 15, pageHeight - 13, { align: 'right' });
    };

    // --- PAGE 1: EXAM COVER / ASSESSMENT HEADER ---
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 24, 2, 2, 'F');
    doc.setDrawColor(includeAnswerKey ? 15 : 22, includeAnswerKey ? 23 : 101, includeAnswerKey ? 42 : 52);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, pageWidth - (margin * 2), 24);

    // School Badge
    doc.setFillColor(includeAnswerKey ? 15 : 22, includeAnswerKey ? 23 : 101, includeAnswerKey ? 42 : 52); // Slate-900 or green emblem
    doc.roundedRect(margin + 4, y + 4, 16, 16, 2, 2, 'F');
    doc.setTextColor(250, 204, 21); // Yellow-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('B', margin + 12, y + 15, { align: 'center' });

    // Official Text
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Biftu Beri Secondary School Portal', margin + 24, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(includeAnswerKey ? 'Oromia Education Bureau Assessment Guidelines - Key Document' : 'Student Self-Practice Resource Paper - Standard Offline Preparation', margin + 24, y + 13);
    doc.text(includeAnswerKey ? 'Empowering Academic Scholars with Rigorous Standards & Secure Testing' : 'Practicing Mock Exam under real timelines builds confidence!', margin + 24, y + 17);

    y += 32;

    // Exam Metadata Details Block (Grid look)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 35, 2, 2, 'FD');

    // Populate Metadata Grid
    doc.setTextColor(includeAnswerKey ? 15 : 22, includeAnswerKey ? 23 : 101, includeAnswerKey ? 42 : 52);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const splitTitle = doc.splitTextToSize((exam.title || 'Untitled Exam') + (includeAnswerKey ? ' (KEY)' : ' (PRACTICE)'), 170);
    doc.text(splitTitle, margin + 6, y + 8);

    const titleDelta = (splitTitle.length - 1) * 6;
    y += titleDelta;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`SUBJECT/MATA-DUREE:`, margin + 6, y + 18);
    doc.setTextColor(15, 23, 42);
    doc.text(String(exam.subject || 'All Subjects').toUpperCase(), margin + 45, y + 18);

    doc.setTextColor(100, 116, 139);
    doc.text(`GRADE LEVEL:`, margin + 6, y + 24);
    doc.setTextColor(15, 23, 42);
    doc.text(`Grade ${exam.grade || '12'} (${String(exam.stream || 'Natural').toUpperCase()} Stream)`, margin + 45, y + 24);

    doc.setTextColor(100, 116, 139);
    doc.text(`TIME DURATION:`, margin + 110, y + 18);
    doc.setTextColor(15, 23, 42);
    doc.text(`${exam.durationMinutes || 60} Minutes / Daqiiqaa`, margin + 140, y + 18);

    doc.setTextColor(100, 116, 139);
    doc.text(`TOTAL ITEMS:`, margin + 110, y + 24);
    doc.setTextColor(15, 23, 42);
    doc.text(`${questions.length} Multiple-Choice Prep Qs`, margin + 140, y + 24);

    y += 42;

    // Student physical answer grid placeholders (so they can sit on paper test!)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - (margin * 2), 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text("STUDENT'S IDENTITY (FILLING BLOCK FOR PHYSICAL EXAMINATION ROOM)", margin + 6, y + 5);

    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.3);

    doc.setTextColor(100, 116, 139);
    doc.text("Candidate Full Name: _________________________________", margin + 6, y + 14);
    doc.text("Student ID (SID): ____________________", margin + 110, y + 14);

    y += 30;

    // Section line
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("PART I: MULTIPLE-CHOICE QUESTIONS (CHOOSE THE SINGLE BEST OPTION)", margin, y);
    y += 8;

    // Loop through questions
    questions.forEach((q, idx) => {
      const qText = q.text || 'Question Text Missing';
      const scoreTag = `[${q.points || 1} mark/qabxii]`;
      const fullQText = `${idx + 1}. ${qText} ${scoreTag}`;
      
      const wrappedQ = doc.splitTextToSize(fullQText, pageWidth - (margin * 2));
      const qHeight = wrappedQ.length * 5;

      // Handle options height
      let optionsLines: string[][] = [];
      let totalOptionsHeight = 0;
      const opts = q.options || [];

      opts.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        const wrappedOpt = doc.splitTextToSize(`  ${letter}) ${opt}`, pageWidth - (margin * 2) - 10);
        optionsLines.push(wrappedOpt);
        totalOptionsHeight += (wrappedOpt.length * 4.5) + 1.5;
      });

      const totalItemHeight = qHeight + totalOptionsHeight + 7; // with gap

      // Page Break detection
      if (y + totalItemHeight > maxContentHeight) {
        doc.addPage();
        y = 25; // Reset top on new page
      }

      // Draw question
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      wrappedQ.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 5;
      });

      y += 1;

      // Draw options
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // slate-700
      optionsLines.forEach((optLines) => {
        optLines.forEach((line: string) => {
          doc.text(line, margin + 4, y);
          y += 4.5;
        });
        y += 1.5;
      });

      y += 2.5; // Spacer between items
    });

    if (includeAnswerKey) {
      // --- SEPARATE PAGE: ANSWER KEY & COMPLIANCE SYSTEM EXPLANATIONS ---
      doc.addPage();
      y = 20;

      doc.setFillColor(245, 243, 255); // purple-50
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'F');
      doc.setDrawColor(221, 214, 254);
      doc.rect(margin, y, pageWidth - (margin * 2), 22);

      // Official Answer Key Label
      doc.setTextColor(109, 40, 217); // purple-700
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('OFFICIAL ANSWER KEY & EXPLANATIONS', margin + 6, y + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(124, 58, 237);
      doc.text('Strict compliance reference documents generated through the Biftu Beri portal securely', margin + 6, y + 16);

      y += 30;

      questions.forEach((q, idx) => {
        const correctIndex = q.correctOptionIndex ?? 0;
        const correctLetter = String.fromCharCode(65 + correctIndex);
        const correctVal = q.options ? q.options[correctIndex] : 'N/A';
        const explanation = q.explanation || 'No detailed explanation provided.';

        const summaryText = `Question № ${idx + 1}:  Correct Option Answer: [ ${correctLetter} ] - (${correctVal})`;
        const wrappedExp = doc.splitTextToSize(`Explanation/Ibsa: ${explanation}`, pageWidth - (margin * 2) - 8);
        const explanationHeight = wrappedExp.length * 4.5;
        const totalKeyItemHeight = 12 + explanationHeight + 4;

        if (y + totalKeyItemHeight > maxContentHeight) {
          doc.addPage();
          y = 25;
        }

        // Block header
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, pageWidth - (margin * 2), totalKeyItemHeight - 2, 1.5, 1.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, pageWidth - (margin * 2), totalKeyItemHeight - 2);

        // Print Key Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(summaryText, margin + 4, y + 6);

        y += 11;

        // Print Explanation
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // slate-600
        wrappedExp.forEach((line: string) => {
          doc.text(line, margin + 4, y);
          y += 4.5;
        });

        y += 8; // spacing
      });
    } else {
      // Add a practice grid on the last page of the student booklet!
      const totalAnswers = questions.length;
      const rowsNeeded = Math.ceil(totalAnswers / 10);
      const gridBlockHeight = 12 + (rowsNeeded * 10);

      if (y + gridBlockHeight + 15 > maxContentHeight) {
        doc.addPage();
        y = 25;
      }

      y += 5;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("STUDENT RESPONSE PRACTICE SHEET / GABATEE DEEBII BARATTOOTAA", margin, y);
      y += 5;

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), rowsNeeded * 14 + 10, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, pageWidth - (margin * 2), rowsNeeded * 14 + 10);

      let gridY = y + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      for (let r = 0; r < rowsNeeded; r++) {
        let blockText = "";
        for (let c = 0; c < 10; c++) {
          const qNum = (r * 10) + c + 1;
          if (qNum <= totalAnswers) {
            blockText += `Q${qNum}: [   ]     `;
          }
        }
        doc.text(blockText, margin + 6, gridY);
        gridY += 10;
      }
    }

    // Run decoration loop over all pages to put beautiful borders and page numbering!
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawPageDecorations(i, totalPages);
    }

    // Save with elegant filename
    const sanitizedTitle = (exam.title || 'exam_paper').toLowerCase().replace(/[^a-z0-9]/gi, '_');
    const suffix = includeAnswerKey ? 'full_key' : 'practice_paper';
    doc.save(`bbs2_exam_${sanitizedTitle}_${suffix}.pdf`);
  };

  const handleSaveExam = async () => {
    if (!user) return;
    
    // Validation
    if (!exam.title || exam.title.trim() === '') {
      alert(language === 'om' ? "Maaloo mata-dure qorumsaa guutaa." : t('admin.enterTitle'));
      return;
    }

    if (exam.title.length > 100) {
      alert(language === 'om' ? "Mata-dure qorumsaa qubeewwan 100 ol ta'uu hin danda'u." : t('admin.titleTooLong'));
      return;
    }

    if (!exam.durationMinutes || exam.durationMinutes <= 0) {
      alert(language === 'om' ? "Maaloo yeroo qorumsaa (daqiiqaa) sirrii guutaa." : t('admin.invalidDuration'));
      return;
    }

    setSaving(true);
    try {
      let id = examId;
      const examData = {
        ...exam,
        creatorId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (id === 'new') {
        const docRef = await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: serverTimestamp()
        });
        id = docRef.id;
        navigate(`/admin/exams/${id}`, { replace: true });
      } else if (id) {
        await updateDoc(doc(db, 'exams', id), examData);
      }

      // Save questions with orderIndex in parallel
      const questionPromises = questions.map(async (q, i) => {
        if (!q.text) return;
        const finalPts = typeof q.points === 'number' && !isNaN(q.points) ? q.points : 1;
        const qData = { ...q, type: 'multiple-choice', points: finalPts, orderIndex: i };
        
        if (q.id) {
          const qRef = doc(db, 'exams', id!, 'questions', q.id);
          // @ts-ignore
          return setDoc(qRef, qData, { merge: true });
        } else {
          return addDoc(collection(db, 'exams', id!, 'questions'), qData);
        }
      });
      
      await Promise.all(questionPromises);
      
      // Refresh question list to get IDs
      const qSnapshot = await getDocs(collection(db, 'exams', id!, 'questions'));
      setQuestions(qSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Question)));

      alert(t('admin.saveSuccess'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'exams');
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { 
      id: `new-${Date.now()}`,
      text: '', 
      options: ['', '', '', ''], 
      correctOptionIndex: 0, 
      points: 1 
    }]);
  };

  const removeQuestion = async (index: number) => {
    const q = questions[index];
    if (q.id && examId && examId !== 'new') {
      await deleteDoc(doc(db, 'exams', examId, 'questions', q.id));
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleImport = (extracted: ExtractedQuestion[]) => {
    const formatted: Partial<Question>[] = extracted.map((q, i) => ({
      id: `imported-${Date.now()}-${i}`,
      text: q.text,
      topic: q.topic || '',
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      points: q.points || 1,
      type: 'multiple-choice'
    }));
    setQuestions([...questions, ...formatted]);
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold tracking-widest uppercase text-xs">Initializing Instructor Studio...</div>;

  const tabs = [
    { id: 'settings', label: 'Settings', icon: Layout },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    ...(examId !== 'new' ? [{ id: 'results', label: 'Student Results', icon: CheckCircle2 }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f3f7fc] flex flex-col">
      <AnimatePresence>
        {showStatusConfirm.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 text-center"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-amber-500">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">Mirkanaffadhu / Confirm!</h3>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-8 leading-relaxed">
                Haala qorumsaa gara <span className="text-blue-600 font-black">{getBilingualStatusLabel(showStatusConfirm.nextStatus || undefined)}</span> jijjiiruuf jirtu. Itti fufuu barbaaduu?<br />
                <span className="block mt-1 font-medium normality text-slate-400 capitalize">You are about to change the exam status to {getBilingualStatusLabel(showStatusConfirm.nextStatus || undefined)}. Do you wish to proceed?</span>
                {showStatusConfirm.nextStatus === 'published' && (
                  <span className="block mt-2 text-emerald-600">Barattoonni qorumsa kana fudhachuu ni danda\'u. / Students will be able to take this exam.</span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowStatusConfirm({ show: false, nextStatus: null })}
                  className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Dhiisi / Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 cursor-pointer"
                >
                  Eeyyee, jijjiiri / Yes, Change
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showImporter && (
          <QuestionImporter 
            onImport={handleImport} 
            onClose={() => setShowImporter(false)} 
          />
        )}
        {showAIGenerator && (
          <AIGenerator
            initialSubject={exam.subject || 'General'}
            initialGrade={exam.grade || '12'}
            onGenerated={handleImport}
            onClose={() => setShowAIGenerator(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back</span>
            </button>
            
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon size={18} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            {examId !== 'new' && (
              <div className="relative group">
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
                    exam.status === 'published' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/10' :
                    exam.status === 'archived' ? 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-500/10' :
                    'bg-amber-50 text-amber-600 border-amber-100 ring-amber-500/10'
                  }`}
                >
                  {exam.status === 'published' ? <Globe size={14} /> : 
                   exam.status === 'archived' ? <Archive size={14} /> : 
                   <FileText size={14} />}
                  {getBilingualStatusLabel(exam.status)}
                </button>
                
                {/* Custom Dropdown on Hover/Group Focus */}
                <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {(['draft', 'published', 'archived'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChangeRequest(s)}
                      className={`w-full flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-left transition-colors ${
                        exam.status === s ? 'bg-slate-50 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        s === 'published' ? 'bg-emerald-500' :
                        s === 'archived' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} />
                      {getBilingualStatusLabel(s)}
                      {exam.status === s && <CheckCircle2 size={14} className="ml-auto text-blue-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {examId !== 'new' && (
              <button
                onClick={() => window.open(`/review/${examId}`, '_blank')}
                className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest"
              >
                <BookOpen size={16} />
                Review
              </button>
            )}
            {examId !== 'new' && questions.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => downloadExamPDF(false)}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 text-[10px] uppercase tracking-widest active:scale-95 cursor-pointer font-mono"
                  title="Download standard printable PDF exam paper without answers for offline student practice"
                >
                  <Download size={13} />
                  Practice Paper (No Answers)
                </button>
                <button
                  type="button"
                  onClick={() => downloadExamPDF(true)}
                  className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 text-[10px] uppercase tracking-widest active:scale-95 cursor-pointer font-mono"
                  title="Download standard printable PDF with full answers and explanations for teachers"
                >
                  <Download size={13} />
                  Answer Key PDF
                </button>
              </>
            )}
            <button
              onClick={handleSaveExam}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm uppercase tracking-widest"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-2xl text-blue-600">
                      <Layout size={24} />
                    </div>
                    Core Configuration
                  </h2>
                  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${
                    exam.status === 'published' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    exam.status === 'archived' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {exam.status === 'published' && <Globe size={12} className="text-emerald-500" />}
                    {exam.status === 'archived' && <Lock size={12} className="text-rose-500" />}
                    {exam.status === 'draft' && <FileText size={12} className="text-amber-500" />}
                    {getBilingualStatusLabel(exam.status)}
                  </div>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Exam Title</label>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        (exam.title?.length || 0) > 90 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {exam.title?.length || 0} / 100
                      </span>
                    </div>
                    <input 
                      type="text"
                      value={exam.title || ''}
                      maxLength={100}
                      onChange={(e) => setExam({ ...exam, title: e.target.value })}
                      placeholder="e.g. Grade 12 Biology Midterm"
                      className={`w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 text-lg transition-all ${
                        !exam.title?.trim() ? 'ring-2 ring-red-100' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Exam Description</label>
                    <textarea 
                      value={exam.description || ''}
                      onChange={(e) => setExam({ ...exam, description: e.target.value })}
                      rows={5}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-medium text-slate-900"
                      placeholder="Add a detailed description for this examination. This will be visible to students before they start."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Academic Stream</label>
                      <select 
                        value={exam.stream}
                        onChange={(e) => {
                          const stream = e.target.value as AcademicStream;
                          let grade = exam.grade;
                          if ((stream === 'natural' || stream === 'social') && (grade === '9' || grade === '10')) {
                            grade = '11';
                          }
                          setExam({ ...exam, stream, grade });
                        }}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                      >
                        <option value="general">General (Grade 9-10)</option>
                        <option value="natural">Natural Science (Grade 11-12)</option>
                        <option value="social">Social Science (Grade 11-12)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Grade Level</label>
                      <select 
                        value={exam.grade}
                        onChange={(e) => {
                          const grade = e.target.value as GradeLevel;
                          let stream = exam.stream;
                          if (grade === '9' || grade === '10') {
                            stream = 'general';
                          } else if (stream === 'general') {
                            // If moving to 11/12 from general, default to natural
                            stream = 'natural';
                          }
                          const type = exam.type;
                          setExam({ ...exam, grade, stream, type });
                        }}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                      >
                        {exam.stream === 'general' ? (
                          <>
                            <option value="9">Grade 9</option>
                            <option value="10">Grade 10</option>
                            <option value="11" disabled>Grade 11 (Requires Natural/Social)</option>
                            <option value="12" disabled>Grade 12 (Requires Natural/Social)</option>
                          </>
                        ) : (
                          <>
                            <option value="9" disabled>Grade 9 (Requires General)</option>
                            <option value="10" disabled>Grade 10 (Requires General)</option>
                            <option value="11">Grade 11</option>
                            <option value="12">Grade 12</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Exam Type</label>
                      <select 
                        value={exam.type || 'model'}
                        onChange={(e) => setExam({ ...exam, type: e.target.value as any })}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                      >
                        <option value="model">Model exam / Mude exam</option>
                        <option value="mid">Mid Exam / Qormaata Gidduu (Mide-exam)</option>
                        <option value="final">Final exam</option>
                        <option value="eaes_mock">National Preparation Mock Exam (120 Mins)</option>
                      </select>
                    </div>

                    {exam.grade === '12' && (
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3 text-blue-600 animate-pulse">Mock Exam Number (Grade 12 Only)</label>
                        <select 
                          value={exam.mockNumber || ''}
                          onChange={(e) => setExam({ ...exam, mockNumber: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-6 py-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-blue-900 outline-none font-bold"
                        >
                          <option value="">Standard Mode / None</option>
                          <option value="1">Mock Exam 1 (Qormaata Leenjii 1)</option>
                          <option value="2">Mock Exam 2 (Qormaata Leenjii 2)</option>
                          <option value="3">Mock Exam 3 (Qormaata Leenjii 3)</option>
                          <option value="4">Mock Exam 4 (Qormaata Leenjii 4)</option>
                          <option value="5">Mock Exam 5 (Qormaata Leenjii 5)</option>
                          <option value="6">Mock Exam 6 (Qormaata Leenjii 6)</option>
                          <option value="7">Mock Exam 7 (Qormaata Leenjii 7)</option>
                          <option value="8">Mock Exam 8 (Qormaata Leenjii 8)</option>
                          <option value="9">Mock Exam 9 (Qormaata Leenjii 9)</option>
                          <option value="10">Mock Exam 10 (Qormaata Leenjii 10)</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Subject</label>
                      <select 
                        value={exam.subject}
                        onChange={(e) => setExam({ ...exam, subject: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                      >
                        <option value="">Select Subject</option>
                        {availableSubjects.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Duration (Minutes)</label>
                      <div className="relative">
                        <Clock size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="number"
                          min="1"
                          value={isNaN(exam.durationMinutes as number) ? '' : exam.durationMinutes}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setExam({ ...exam, durationMinutes: val });
                          }}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Due Date & Time (Optional)</label>
                      <div className="relative">
                        <Calendar size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="datetime-local"
                          value={exam.dueDate ? format(exam.dueDate instanceof Date ? exam.dueDate : exam.dueDate?.toDate?.() || new Date(exam.dueDate), "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setExam({ ...exam, dueDate: val ? new Date(val) : null });
                          }}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        If set, students will see this as the deadline for the exam.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Publication Status / Haala Maxxansaa</label>
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-[32px] border border-slate-100">
                      {(['draft', 'published', 'archived'] as const).map((status) => {
                        const isSelected = exam.status === status;
                        const config = {
                          draft: { color: 'amber', icon: FileText, label: 'Draft / Yaada Jalqabaa' },
                          published: { color: 'emerald', icon: Globe, label: 'Public Access / Bannamaa' },
                          archived: { color: 'rose', icon: Archive, label: 'Archived / Kuusame' }
                        }[status];
                        
                        const Icon = config.icon;
                        const colorClass = isSelected 
                          ? status === 'published' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 ring-4 ring-emerald-500/10' :
                            status === 'archived' ? 'bg-rose-600 text-white shadow-xl shadow-rose-200 ring-4 ring-rose-500/10' :
                            'bg-amber-500 text-white shadow-xl shadow-amber-200 ring-4 ring-amber-500/10'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-white';

                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleStatusChangeRequest(status)}
                            className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all ${colorClass}`}
                          >
                            <Icon size={20} className={isSelected ? 'animate-pulse' : 'opacity-40'} />
                            <span>{config.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                      {exam.status === 'published' ? 'This exam is currently visible and active for students. / Qormaanni kun barattootaaf bannaadha.' : 
                       exam.status === 'archived' ? 'This exam is hidden and restricted from student access. / Qormaanni kun barattoota jalaa dhoksaadha.' : 
                       'Keep as draft until you are ready to publish. / Hanga maxxansuuf qophooftutti yaada jalqabaa godhii tursiisi.'}
                    </p>
                  </div>

                  <div className="mt-12 flex justify-end">
                    <button
                      onClick={() => setActiveTab('questions')}
                      className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
                    >
                      Next: Question Bank
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {examId !== 'new' && (
                <div className="bg-red-50 border border-red-200 p-8 rounded-[40px] shadow-sm space-y-6 mt-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-2xl text-red-650">
                      <Trash2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-red-700 uppercase tracking-tight">Danger Zone / Naannoo Qajeelfamaa</h3>
                      <p className="text-[10px] text-red-500 uppercase font-black tracking-wider">Irreversible administrative actions</p>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-white rounded-3xl border border-red-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                          {language === 'om' ? 'Qorumsa / Gosa Barnootaa Kana Haqi' : 'Delete This Examination / Subject'}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium max-w-lg">
                          {language === 'om' 
                            ? 'Qorumsi kun, gaaffilee hundi fi qabxiileen barattootaa ni haqamu. Gochi kun boodatti hin deebi\'u.' 
                            : 'This will permanently destroy the exam, all its questions, and delete students\' past attempt records.'}
                        </p>
                      </div>
                      
                      {showConfirmDelete ? (
                        <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                          <p className="text-[10px] text-red-650 font-black uppercase tracking-widest text-center sm:text-right">Are you sure?</p>
                          <div className="flex gap-2">
                            <button
                              disabled={saving}
                              type="button"
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  await deleteDoc(doc(db, 'exams', examId));
                                  alert(language === 'om' ? 'Qorumsichi milkaa\'inaan haqameera!' : 'Exam deleted successfully!');
                                  navigate('/dashboard');
                                } catch (error) {
                                  console.error("Error deleting exam:", error);
                                  handleFirestoreError(error, OperationType.WRITE, `exams/${examId}`);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                              {saving ? 'Deleting...' : (language === 'om' ? 'Eeyyee, Haqi' : 'Yes, Delete')}
                            </button>
                            <button
                              disabled={saving}
                              type="button"
                              onClick={() => setShowConfirmDelete(false)}
                              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(true)}
                          className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shrink-0"
                        >
                          {language === 'om' ? 'Qorumsa Haqi' : 'Delete Exam'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {questions.length === 0 ? (
                <div className="bg-white p-12 rounded-[60px] border border-slate-200 shadow-sm text-center">
                  <div className="w-24 h-24 bg-blue-50 rounded-[40px] flex items-center justify-center mx-auto mb-8 text-blue-600">
                    <HelpCircle size={48} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">How will you build this exam?</h2>
                  <p className="text-slate-500 max-w-md mx-auto mb-12 font-bold">Choose a method to populate your question bank for {exam.title || 'this exam'}.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button 
                      onClick={() => setShowAIGenerator(true)}
                      className="group p-8 bg-purple-50 rounded-[40px] border-2 border-purple-100 hover:border-purple-300 transition-all text-center space-y-4"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto text-purple-600 shadow-sm group-hover:scale-110 transition-transform">
                        <BrainCircuit size={28} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-1">AI Generator</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">Create 10+ questions using Gemini AI instantly</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => setShowImporter(true)}
                      className="group p-8 bg-blue-50 rounded-[40px] border-2 border-blue-100 hover:border-blue-300 transition-all text-center space-y-4"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                        <FileUp size={28} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-1">Upload Template</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">Import questions from Word, PDF or Text files</p>
                      </div>
                    </button>

                    <button 
                      onClick={addQuestion}
                      className="group p-8 bg-slate-50 rounded-[40px] border-2 border-slate-100 hover:border-slate-300 transition-all text-center space-y-4"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-600 shadow-sm group-hover:scale-110 transition-transform">
                        <Plus size={28} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-1">Manual Build</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">Type your questions and options personally</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Question Bank</h2>
                      <p className="text-slate-500 text-sm font-bold">{questions.length} Questions Prepared</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={qSearchQuery}
                          onChange={(e) => setQSearchQuery(e.target.value)}
                          placeholder="Search questions by text..."
                          className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-64"
                        />
                      </div>
                      
                      {/* Category/Topic Filter Dropdown */}
                      <div className="relative">
                        <select
                          value={qSelectedCategory}
                          onChange={(e) => setQSelectedCategory(e.target.value)}
                          className="pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer min-w-[160px] appearance-none"
                        >
                          <option value="">All Topics ({uniqueCategories.length})</option>
                          {uniqueCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                          <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadExamPDF(false)}
                        className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer font-sans shadow-lg shadow-emerald-50 active:scale-95"
                        title="Download standard A4 printable PDF exam paper without answers for offline student practice"
                      >
                        <Download size={16} />
                        Download Practice
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadExamPDF(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer font-sans shadow-lg shadow-fuchsia-100 active:scale-95"
                        title="Download standard A4 printable PDF with full answer key and explanations"
                      >
                        <Download size={16} />
                        Download Key
                      </button>
                      <button
                        onClick={() => setShowAIGenerator(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-purple-50 text-purple-700 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-purple-100 hover:bg-purple-100 transition-all"
                      >
                        <BrainCircuit size={18} />
                        AI Generate Qs
                      </button>
                      <button
                        onClick={() => setShowImporter(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-700 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-blue-100 hover:bg-blue-100 transition-all font-sans"
                      >
                        <Sparkles size={18} />
                        AI Import
                      </button>
                      <button
                        onClick={addQuestion}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                  </div>

                  <Reorder.Group 
                    axis="y" 
                    values={questions} 
                    onReorder={setQuestions}
                    className="space-y-6 pb-20"
                  >
                    {questions.map((q, idx) => {
                      const matchesSearch = !qSearchQuery || (q.text || '').toLowerCase().includes(qSearchQuery.toLowerCase());
                      const matchesCategory = !qSelectedCategory || (q.topic || '').trim().toLowerCase() === qSelectedCategory.trim().toLowerCase();
                      if (!matchesSearch || !matchesCategory) return null;
                      return (
                        <Reorder.Item
                          key={q.id!}
                          value={q}
                          className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 relative group cursor-default"
                        >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-slate-600 transition-colors">
                              <GripVertical size={20} />
                            </div>
                            <div className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-2xl font-black text-sm">
                              {idx + 1}
                            </div>
                            <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Question Details</h3>
                          </div>
                          <button 
                            onClick={() => removeQuestion(idx)}
                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Question Content</label>
                            <textarea 
                              value={q.text}
                              onChange={(e) => {
                                const newQs = [...questions];
                                newQs[idx].text = e.target.value;
                                setQuestions(newQs);
                              }}
                              className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 min-h-[120px] text-lg"
                              placeholder="Type the question content here..."
                            />
                          </div>

                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Question Topic / Subject Area</label>
                              <input 
                                type="text"
                                value={q.topic || ''}
                                onChange={(e) => {
                                  const newQs = [...questions];
                                  newQs[idx].topic = e.target.value;
                                  setQuestions(newQs);
                                }}
                                className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900"
                                placeholder="e.g. Molecular Biology"
                              />
                            </div>
                            <div className="w-48">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Weight (Points)</label>
                              <div className="flex items-center justify-between gap-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newQs = [...questions];
                                    const currentPoints = isNaN(q.points as number) ? 1 : q.points;
                                    newQs[idx].points = Math.max(0, currentPoints - 1);
                                    setQuestions(newQs);
                                  }}
                                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-605 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all shadow-sm font-black active:scale-90 text-sm"
                                  title="Decrease Points"
                                >
                                  -
                                </button>
                                <input 
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={isNaN(q.points as number) ? '' : q.points}
                                  onChange={(e) => {
                                    const newQs = [...questions];
                                    const val = parseFloat(e.target.value);
                                    newQs[idx].points = isNaN(val) ? NaN : val;
                                    setQuestions(newQs);
                                  }}
                                  className="w-12 bg-transparent text-center font-black text-blue-600 outline-none p-0 border-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newQs = [...questions];
                                    const currentPoints = isNaN(q.points as number) ? 1 : q.points;
                                    newQs[idx].points = currentPoints + 1;
                                    setQuestions(newQs);
                                  }}
                                  className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-md active:scale-90 font-black text-sm"
                                  title="Increase Points"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.options?.map((opt, optIdx) => (
                              <div key={optIdx} className="flex gap-4 items-center">
                                <button
                                  onClick={() => {
                                    const newQs = [...questions];
                                    newQs[idx].correctOptionIndex = optIdx;
                                    setQuestions(newQs);
                                  }}
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                    q.correctOptionIndex === optIdx 
                                      ? 'bg-green-100 text-green-600 ring-4 ring-green-500/20' 
                                      : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                  }`}
                                >
                                  <CheckCircle2 size={24} />
                                </button>
                                <input 
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const newQs = [...questions];
                                    newQs[idx].options![optIdx] = e.target.value;
                                    setQuestions(newQs);
                                  }}
                                  placeholder={`Option ${optIdx + 1}`}
                                  className="flex-1 px-5 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                            {q.explanation !== undefined && (
                              <div className="w-full">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Explanation (Optional)</label>
                                <textarea 
                                  value={q.explanation || ''}
                                  onChange={(e) => {
                                    const newQs = [...questions];
                                    newQs[idx].explanation = e.target.value;
                                    setQuestions(newQs);
                                  }}
                                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-medium text-slate-900 min-h-[80px]"
                                  placeholder="Educational explanation for the correct answer..."
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>

                {!questions.some(q => {
                  const matchesSearch = !qSearchQuery || (q.text || '').toLowerCase().includes(qSearchQuery.toLowerCase());
                  const matchesCategory = !qSelectedCategory || (q.topic || '').trim().toLowerCase() === qSelectedCategory.trim().toLowerCase();
                  return matchesSearch && matchesCategory;
                }) && (
                  <div className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-sm text-center">
                    <Search size={32} className="mx-auto text-slate-300 mb-4 animate-bounce" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No questions matched your search query or selected category.</p>
                  </div>
                )}

                  <div className="mt-8 mb-20 flex justify-center">
                    <button
                      onClick={addQuestion}
                      className="group flex flex-col items-center gap-4 p-10 bg-white border-4 border-dashed border-slate-200 rounded-[48px] hover:border-blue-300 hover:bg-blue-50/50 transition-all w-full max-w-lg"
                    >
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-all shadow-sm">
                        <Plus size={32} />
                      </div>
                      <div className="text-center">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">New Question</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click to manually add another question to this exam</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-2xl text-green-600">
                      <CheckCircle2 size={24} />
                    </div>
                    Student Submissions
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {attempts.length > 0 && (
                      <button
                        onClick={exportResults}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        <FileUp size={16} />
                        Export CSV
                      </button>
                    )}
                    <span className="px-3.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-black uppercase tracking-widest">
                      {attempts.filter(a => a.status === 'completed' || a.status === 'timed-out').length} Submitted / Xumurameera
                    </span>
                    <span className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black uppercase tracking-widest">
                      {attempts.filter(a => a.status === 'ongoing' || !a.status).length} In Progress / Hojjachaa Jira
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {attempts.length === 0 ? (
                    <div className="text-center py-20">
                      <CheckCircle2 size={48} className="mx-auto text-slate-100 mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Waiting for student submissions...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left font-semibold">
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Student Name (SID) / Maqaa Barataa</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Completion Date / Guyyaa Xumure</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">Score / Qabxii</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center">Flags (Violations) / Seera Sarbuu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {attempts.map((att) => {
                            const student = attemptUsers[att.userId];
                            const isCompleted = att.status === 'completed' || att.status === 'timed-out';
                            return (
                              <tr key={att.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="py-5 px-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{student?.fullName || student?.name || 'Unknown'}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">SID: {student?.sid || 'N/A'}</span>
                                  </div>
                                </td>
                                <td className="py-5 px-4 text-slate-600 font-medium">
                                  {isCompleted && att.finishedAt ? (
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-700">
                                        {format(att.finishedAt.toDate(), 'MMM d, yyyy • h:mm a')}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-black uppercase tracking-wider mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        {att.status === 'timed-out' ? 'Submitted (Timed Out)' : 'Submitted / Xumurameera'}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-250 rounded-lg text-[10px] font-black uppercase tracking-wider self-start animate-pulse">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                        In Progress / Hojechaa Jira
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold mt-1">
                                        Started: {att.startedAt ? format(att.startedAt.toDate(), 'MMM d, hh:mm a') : 'N/A'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-5 px-4">
                                  {isCompleted ? (
                                    <div className="flex flex-col items-center">
                                      <span className={`text-lg font-black ${
                                        ((att.score || 0) / (att.totalPoints || 1)) >= 0.5 ? 'text-green-600' : 'text-red-500'
                                      }`}>
                                        {att.score ?? 0} / {att.totalPoints ?? 0}
                                      </span>
                                      <span className="text-[10px] font-black text-slate-400">
                                        {Math.round(((att.score || 0) / (att.totalPoints || 1)) * 100)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-xs font-black text-blue-500 uppercase tracking-widest animate-pulse">
                                        Working...
                                      </span>
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">
                                        Active / Deebisaa jira
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-5 px-4 text-center">
                                  <div className="flex justify-center">
                                    {att.violations! > 0 ? (
                                      <div className="px-3.5 py-1.5 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider animate-pulse flex flex-col items-center gap-0.5">
                                        <span className="font-extrabold">{att.violations} Violations</span>
                                        <span className="text-[8px] font-extrabold opacity-75">{att.violations} Seera Sarbeera</span>
                                      </div>
                                    ) : (
                                      <div className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex flex-col items-center gap-0.5 ${
                                        isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 border border-blue-200 text-blue-650'
                                      }`}>
                                        <span className="font-extrabold">{isCompleted ? 'Clean' : 'Secured'}</span>
                                        <span className="text-[8px] font-extrabold opacity-75">{isCompleted ? 'Qulqulluu' : 'Eegameera'}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
