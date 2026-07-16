import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, createAuditLog } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import AuditLogsTab from './AuditLogsTab';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { StudentMark, UserProfile, ExamAttempt, Exam } from '@/src/types';
import { ALL_SUBJECTS, SUBJECTS_BY_GRADE, normalizeSubject } from '../constants';
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  CheckCircle, 
  XCircle, 
  User, 
  Calendar, 
  Award, 
  Printer, 
  HelpCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  Download,
  UploadCloud
} from 'lucide-react';

export default function MarksAndReports() {
  const { profile, user } = useAuth();
  const { t, language } = useLanguage();
  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';
  const isStudent = profile?.role === 'student';
  const hasManagementAccess = isAdmin || isStaff;

  const [activeSubTab, setActiveSubTab] = useState<'records' | 'report_card' | 'audit_logs'>('report_card');
  const [reportType, setReportType] = useState<'classroom' | 'certificate'>('classroom');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<'term_1' | 'term_2'>('term_1');
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  
  // Grade and Area Layout Arrangement for Cumulative Reports
  const [reportGrade, setReportGrade] = useState<'9' | '10' | '11' | '12'>('12');
  const [reportStream, setReportStream] = useState<'general' | 'natural' | 'social'>('natural');
  
  // Loading states
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State for CRUD
  const [editingMarkId, setEditingMarkId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    studentId: '',
    subject: ALL_SUBJECTS[0] || 'Mathematics',
    term: 'term_1' as 'term_1' | 'term_2',
    assessmentType: 'mid_exam' as 'continuous_assessment' | 'mid_exam' | 'final_exam' | 'mock_exam',
    score: '',
  });

  useEffect(() => {
    if (isStaff && profile?.subject && !editingMarkId) {
      setFormData(prev => ({
        ...prev,
        subject: profile.subject
      }));
    }
  }, [profile, isStaff, editingMarkId]);

  useEffect(() => {
    if (isStaff && profile?.subject) {
      setFilterSubject(profile.subject);
    }
  }, [profile, isStaff]);

  // Filters for Admin view
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTerm, setFilterTerm] = useState('');

  // Advanced Interactive Bulk CSV Upload States
  const [bulkCsvRows, setBulkCsvRows] = useState<any[]>([]);
  const [csvProgress, setCsvProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');

  // Load students for Admin dropdown or Parent selection
  useEffect(() => {
    const fetchStudents = async () => {
      if (!profile) return;
      try {
        setLoadingStudents(true);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'student'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as UserProfile));
        setStudents(list);

        // Auto-select first student if available and is admin
        if (hasManagementAccess && list.length > 0 && !selectedStudentId) {
          setSelectedStudentId(list[0].uid);
        }
      } catch (err) {
        console.error('Error fetching students:', err);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [profile]);

  // Set selected student based on current user
  useEffect(() => {
    if (isStudent && user) {
      setSelectedStudentId(user.uid);
    }
  }, [profile, user]);

  // Automatically arrange report grade and stream based on chosen student's profile
  useEffect(() => {
    const active = students.find(s => s.uid === selectedStudentId);
    if (active) {
      if (active.grade) setReportGrade(active.grade as any);
      if (active.stream) setReportStream(active.stream as any);
    }
  }, [selectedStudentId, students]);

  // Audit log for viewing reports
  const lastLoggedStudentView = React.useRef<string>('');
  useEffect(() => {
    if (selectedStudentId && isAdmin && students.length > 0) {
      if (lastLoggedStudentView.current !== selectedStudentId) {
        lastLoggedStudentView.current = selectedStudentId;
        const active = students.find(s => s.uid === selectedStudentId);
        const studentName = active?.fullName || active?.name || 'Unknown Student';
        createAuditLog('view_report', 'MarksAndReports', selectedStudentId, studentName);
      }
    } else if (!selectedStudentId) {
      lastLoggedStudentView.current = '';
    }
  }, [selectedStudentId, isAdmin, students]);

  // Load all Marks from Firestore
  const fetchAllMarks = async () => {
    try {
      setLoadingMarks(true);
      const marksRef = collection(db, 'marks');
      let q;
      if (hasManagementAccess) {
        q = query(marksRef);
      } else {
        // Only load current student marks
        q = query(marksRef, where('studentId', '==', selectedStudentId));
      }
      const snap = await getDocs(q);
      let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as StudentMark));
      
      // Filter by staff subject if applicable
      if (isStaff && profile?.subject) {
        list = list.filter(m => m.subject === profile.subject);
      }
      
      setMarks(list);
    } catch (err) {
      console.error('Error fetching marks:', err);
    } finally {
      setLoadingMarks(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId || hasManagementAccess) {
      fetchAllMarks();
    }
  }, [selectedStudentId]);

  // Fetch online exam attempts for current selected student to merge features
  useEffect(() => {
    const fetchAttempts = async () => {
      if (!selectedStudentId) return;
      try {
        setLoadingAttempts(true);
        const q = query(collection(db, 'attempts'), where('userId', '==', selectedStudentId));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ExamAttempt));
        setAttempts(list.filter(a => a.status === 'completed' || a.status === 'timed-out'));
      } catch (err) {
        console.error('Error fetching attempts:', err);
      } finally {
        setLoadingAttempts(false);
      }
    };

    fetchAttempts();
  }, [selectedStudentId]);

  // Load all Exams from Firestore for attempt metadata lookup
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const snap = await getDocs(collection(db, 'exams'));
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Exam));
        setExams(list);
      } catch (err) {
        console.error('Error fetching exams:', err);
      }
    };
    fetchExams();
  }, []);

  // Handle Mark Form CRUD Actions
  const handleSaveMark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId) {
      setErrorMsg('Please select a student / Maaloo barataa filadhaa.');
      return;
    }

    const numericScore = parseFloat(formData.score);
    if (isNaN(numericScore) || numericScore < 0) {
      setErrorMsg('Invalid score / Qabxii sirrii hin taane.');
      return;
    }

    // Determine max score limits based on assessment type (Mid = 30, Final = 70, Mock = 100 per term)
    let limitMax = 100;
    if (formData.assessmentType === 'mid_exam') limitMax = 30;
    else if (formData.assessmentType === 'final_exam') limitMax = 70;
    else if (formData.assessmentType === 'mock_exam') limitMax = 100;
    else if (formData.assessmentType === 'continuous_assessment') limitMax = 30; // legacy compatibility fallback

    if (numericScore > limitMax) {
      setErrorMsg(`Score exceeds maximum of ${limitMax} for this type. Mid Exam has a maximum of 30, Final Exam has a maximum of 70, and Mock Exam has a maximum of 100.`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const selectedStudent = students.find(s => s.uid === formData.studentId);
      const studentName = selectedStudent?.fullName || selectedStudent?.name || 'Unknown Student';
      const studentSid = selectedStudent?.sid || 'N/A';

      const payload = {
        studentId: formData.studentId,
        studentName,
        studentSid,
        subject: formData.subject,
        term: formData.term,
        assessmentType: formData.assessmentType,
        score: numericScore,
        totalPoints: limitMax,
        recordedBy: user?.uid || 'admin',
        recordedAt: serverTimestamp(),
      };

      if (editingMarkId) {
        await updateDoc(doc(db, 'marks', editingMarkId), payload);
        setSuccessMsg('Record updated successfully / Qabxiin milkaa\'inaan sirreefameera!');
      } else {
        await addDoc(collection(db, 'marks'), payload);
        setSuccessMsg('Record created successfully / Qabxiin milkaa\'inaan galmeeffameera!');
      }

      // Reset Form except student selected for consecutive entries
      setFormData(prev => ({
        ...prev,
        score: '',
        assessmentType: 'continuous_assessment'
      }));
      setEditingMarkId(null);
      await fetchAllMarks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditMarkClick = (m: StudentMark) => {
    setEditingMarkId(m.id);
    setFormData({
      studentId: m.studentId,
      subject: m.subject,
      term: m.term,
      assessmentType: m.assessmentType,
      score: m.score.toString(),
    });
    // Scroll to form smoothly
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDeleteMarkClick = async (id: string) => {
    const confirmDel = window.confirm('Are you sure you want to delete this mark record? / Qabxii kana xumuraan haquu barbaadduu?');
    if (!confirmDel) return;

    try {
      setLoadingMarks(true);
      await deleteDoc(doc(db, 'marks', id));
      setSuccessMsg('Record deleted successfully / Qabxiin haqameera!');
      await fetchAllMarks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete mark record.');
    } finally {
      setLoadingMarks(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement> | any, droppedFile?: File) => {
    const file = droppedFile || e.target?.files?.[0];
    if (!file) return;

    try {
      setLoadingMarks(true);
      setErrorMsg('');
      setSuccessMsg('');
      setBulkCsvRows([]);

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const text = evt.target?.result as string;
          if (!text) return;

          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) {
            setErrorMsg('CSV file is empty or missing headers. Please download the template first / Maaloo duree dursa buufadhaa.');
            setLoadingMarks(false);
            return;
          }

          // A robust CSV line parser that handles quoted items with inner commas nicely
          const parseCSVLine = (line: string) => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result.map(v => v.replace(/^["']|["']$/g, '').trim());
          };

          // Parse headers and find columns
          const headers = parseCSVLine(lines[0]);
          
          let sidIdx = -1;
          let nameIdx = -1;
          let subjectIdx = -1;
          let termIdx = -1;
          let typeIdx = -1;
          let scoreIdx = -1;

          headers.forEach((h, idx) => {
            const norm = h.toLowerCase();
            if (norm.includes('student_id') || norm.includes('sid') || norm.includes('id_number')) sidIdx = idx;
            else if (norm.includes('name') || norm.includes('full_name')) nameIdx = idx;
            else if (norm.includes('subject') || norm.includes('barnoota')) subjectIdx = idx;
            else if (norm.includes('term') || norm.includes('semester')) termIdx = idx;
            else if (norm.includes('assessment') || norm.includes('type')) typeIdx = idx;
            else if (norm.includes('score_obtained') || norm.includes('score') || norm.includes('obtained') || norm.includes('qabxii')) scoreIdx = idx;
          });

          // Fallback static indices if mismatch
          if (sidIdx === -1) sidIdx = 0;
          if (nameIdx === -1) nameIdx = 1;
          if (subjectIdx === -1) subjectIdx = 2;
          if (termIdx === -1) termIdx = 3;
          if (typeIdx === -1) typeIdx = 4;
          if (scoreIdx === -1) scoreIdx = 6;

          // Fetch all students to match references
          const usersRef = collection(db, 'users');
          const studentQueryRef = query(usersRef, where('role', '==', 'student'));
          const studentSnap = await getDocs(studentQueryRef);
          const resolvedStudents = studentSnap.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));

          const parsedRows: any[] = [];

          // Process rows
          for (let i = 1; i < lines.length; i++) {
            const rowVals = parseCSVLine(lines[i]);
            if (rowVals.length < Math.max(sidIdx, nameIdx, subjectIdx, termIdx, typeIdx, scoreIdx) + 1) {
              continue; 
            }

            const rawSid = rowVals[sidIdx];
            const rawName = rowVals[nameIdx];
            const rawSubject = rowVals[subjectIdx];
            const rawTerm = rowVals[termIdx];
            const rawType = rowVals[typeIdx];
            const rawScoreStr = rowVals[scoreIdx];
            const rawScore = parseFloat(rawScoreStr);

            if (rawScoreStr === '') {
              continue; // Skip blank lines
            }

            // Student finder
            const targetStdt = resolvedStudents.find(
              s => (s.sid && s.sid.trim().toLowerCase() === rawSid.trim().toLowerCase()) || 
                   (s.uid && s.uid.trim().toLowerCase() === rawSid.trim().toLowerCase()) ||
                   (s.fullName && s.fullName.trim().toLowerCase() === rawName.trim().toLowerCase()) ||
                   (s.name && s.name.trim().toLowerCase() === rawName.trim().toLowerCase())
            );

            // Norm Term values
            let cleanTerm: 'term_1' | 'term_2' = 'term_1';
            if (rawTerm.includes('2') || rawTerm.toLowerCase().includes('term_2') || rawTerm.toLowerCase().includes('term 2') || rawTerm.toLowerCase().includes('semester_2') || rawTerm.toLowerCase().includes('semisteera 2')) {
              cleanTerm = 'term_2';
            }

            // Norm Assessment Type values
            let cleanType: 'mid_exam' | 'final_exam' | 'mock_exam' = 'mid_exam';
            if (rawType.toLowerCase().includes('mock') || rawType.toLowerCase().includes('national') || rawType.toLowerCase().includes('eaes') || rawType.includes('100')) {
              cleanType = 'mock_exam';
            } else if (rawType.toLowerCase().includes('final') || rawType.toLowerCase().includes('final_term') || rawType.toLowerCase().includes('final_exam') || rawType.toLowerCase().includes('term_2') || rawType.includes('70')) {
              cleanType = 'final_exam';
            }

            let totalPoints = 30;
            if (cleanType === 'final_exam') totalPoints = 70;
            else if (cleanType === 'mock_exam') totalPoints = 100;

            let validationError = '';
            if (!targetStdt) {
              validationError = 'Student not found / Barataan hin argamne';
            } else if (isNaN(rawScore)) {
              validationError = 'Score is not a valid number / Qabxiin madaallii dogoggora';
            } else if (rawScore > totalPoints || rawScore < 0) {
              validationError = `Score out of bounds (allowed 0 to ${totalPoints})`;
            }

            parsedRows.push({
              id: `${i}-${Date.now()}`,
              rawSid,
              rawName,
              rawSubject,
              rawTerm,
              rawType,
              rawScore: isNaN(rawScore) ? 0 : rawScore,
              matchedStudent: targetStdt || null,
              cleanTerm,
              cleanType,
              totalPoints,
              validationError,
              isExcluded: !!validationError
            });
          }

          if (parsedRows.length === 0) {
            setErrorMsg('No valid rows found to process in that file.');
          } else {
            setBulkCsvRows(parsedRows);
            const errorCount = parsedRows.filter(r => r.validationError).length;
            if (errorCount > 0) {
              setErrorMsg(`Loaded ${parsedRows.length} columns. Identified ${errorCount} data validation issues. Pleae resolve below.`);
            } else {
              setSuccessMsg(`Successfully parsed ${parsedRows.length} entries! Please verify alignment below and confirm.`);
            }
          }
        } catch (innerErr: any) {
          setErrorMsg(`Error loading CSV content: ${innerErr.message}`);
        } finally {
          setLoadingMarks(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setErrorMsg(`Failed to parse file: ${err.message}`);
      setLoadingMarks(false);
    }
  };

  const handleBulkCsvCommit = async () => {
    const validRows = bulkCsvRows.filter(r => !r.validationError);
    if (validRows.length === 0) {
      setErrorMsg('No valid rows to commit. Check alignment or errors / Ol-kaasuuf galmeen madaallii sirrii hin jiru.');
      return;
    }

    try {
      setLoadingMarks(true);
      setErrorMsg('');
      setSuccessMsg('');
      
      let successCount = 0;
      let failCount = 0;

      for (let idx = 0; idx < validRows.length; idx++) {
        setCsvProgress({ current: idx + 1, total: validRows.length });
        const row = validRows[idx];
        const student = row.matchedStudent;

        try {
          const marksRef = collection(db, 'marks');
          const findQ = query(
            marksRef,
            where('studentId', '==', student.uid),
            where('subject', '==', row.rawSubject),
            where('term', '==', row.cleanTerm),
            where('assessmentType', '==', row.cleanType)
          );
          const findSnap = await getDocs(findQ);

          const payload = {
            studentId: student.uid,
            studentName: student.fullName || student.name || row.rawName,
            studentSid: student.sid || row.rawSid,
            subject: row.rawSubject,
            term: row.cleanTerm,
            assessmentType: row.cleanType,
            score: row.rawScore,
            totalPoints: row.totalPoints,
            recordedBy: user?.uid || 'admin_bulkupload',
            recordedAt: serverTimestamp()
          };

          if (!findSnap.empty) {
            await updateDoc(doc(db, 'marks', findSnap.docs[0].id), payload);
          } else {
            await addDoc(collection(db, 'marks'), payload);
          }
          await createAuditLog(
            'view_report',
            `Bulk CSV Upload - Subject: ${payload.subject}, Score: ${payload.score}`,
            payload.studentId,
            payload.studentName
          );
          successCount++;
        } catch (rowErr) {
          console.error('Failed to save row:', row, rowErr);
          failCount++;
        }
      }

      setSuccessMsg(`Bulk import successfully committed! Added/updated ${successCount} entries safely.`);
      setBulkCsvRows([]);
      await fetchAllMarks();
    } catch (err: any) {
      setErrorMsg(`Bulk commit failed: ${err.message}`);
    } finally {
      setLoadingMarks(false);
      setCsvProgress(null);
    }
  };

  const updateRowScore = (rowId: string, newScoreVal: string) => {
    const numericScore = parseFloat(newScoreVal);
    setBulkCsvRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      
      const score = isNaN(numericScore) ? 0 : numericScore;
      let validationError = '';
      if (!row.matchedStudent) {
        validationError = 'Student not found / Barataan hin argamne';
      } else if (isNaN(numericScore)) {
        validationError = 'Score is not a valid number / Qabxiin madaallii dogoggora';
      } else if (score > row.totalPoints || score < 0) {
        validationError = `Score out of bounds (allowed 0 to ${row.totalPoints})`;
      }

      return {
        ...row,
        rawScore: score,
        validationError
      };
    }));
  };

  const removeRowFromBulk = (rowId: string) => {
    setBulkCsvRows(prev => prev.filter(row => row.id !== rowId));
  };

  // Autogenerate / seed mock academic record marks for testing
  const handleAutoFillMarks = async () => {
    if (!selectedStudentId) {
      alert('Please select a student first / Maaloo dura barataa filadhaa.');
      return;
    }
    const targetStudent = students.find(s => s.uid === selectedStudentId);
    if (!targetStudent) return;

    const confirmGen = window.confirm(`Auto-generate a full set of Term 1 & Term 2 academic performance grades for ${targetStudent.fullName}? This will let you preview the report card instantly. / Qabxiiwwan madaallii hunda barataa kanaan guutuu ni barbaadduu?`);
    if (!confirmGen) return;

    try {
      setLoadingMarks(true);
      // Retrieve subjects dynamically based on student's grade & stream
      const studentGrade = (targetStudent.grade || '12') as any;
      const studentStream = (targetStudent.stream || 'natural') as any;
      const testSubjects = SUBJECTS_BY_GRADE[studentGrade]?.[studentStream] || ['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Civics', 'IT'];
      const batchPromises: Promise<any>[] = [];

      // Generate term 1 and 2 mid and final exam scores for test subjects
      testSubjects.forEach(subj => {
        ['term_1', 'term_2'].forEach(trm => {
          // Mid Exam (max 30): random between 16 and 28
          const mid = Math.floor(Math.random() * 13) + 16;
          // Final Exam (max 70): random between 38 and 68
          const fin = Math.floor(Math.random() * 31) + 38;

          batchPromises.push(addDoc(collection(db, 'marks'), {
            studentId: selectedStudentId,
            studentName: targetStudent.fullName || targetStudent.name || 'Anonymous',
            studentSid: targetStudent.sid || 'N/A',
            subject: subj,
            term: trm as 'term_1' | 'term_2',
            assessmentType: 'mid_exam',
            score: mid,
            totalPoints: 30,
            recordedBy: user?.uid || 'compiler',
            recordedAt: serverTimestamp()
          }));

          batchPromises.push(addDoc(collection(db, 'marks'), {
            studentId: selectedStudentId,
            studentName: targetStudent.fullName || targetStudent.name || 'Anonymous',
            studentSid: targetStudent.sid || 'N/A',
            subject: subj,
            term: trm as 'term_1' | 'term_2',
            assessmentType: 'final_exam',
            score: fin,
            totalPoints: 70,
            recordedBy: user?.uid || 'compiler',
            recordedAt: serverTimestamp()
          }));
        });

        // Add National Mock Exam (max 100) specifically for Grade 12 students
        if (studentGrade === '12') {
          const mockScore = Math.floor(Math.random() * 36) + 60; // 60 to 95 Marks
          batchPromises.push(addDoc(collection(db, 'marks'), {
            studentId: selectedStudentId,
            studentName: targetStudent.fullName || targetStudent.name || 'Anonymous',
            studentSid: targetStudent.sid || 'N/A',
            subject: subj,
            term: 'term_1',
            assessmentType: 'mock_exam',
            score: mockScore,
            totalPoints: 100,
            recordedBy: user?.uid || 'compiler',
            recordedAt: serverTimestamp()
          }));
        }
      });

      await Promise.all(batchPromises);
      setSuccessMsg('Academic records simulated successfully! Re-rendering Report Card.');
      await fetchAllMarks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Auto-fill failed.');
    } finally {
      setLoadingMarks(false);
    }
  };

  const [showBlankPrintSheet, setShowBlankPrintSheet] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [pendingPrintFn, setPendingPrintFn] = useState<(() => void) | null>(null);

  // Download Blank CSV Format for Offline Mark Recording
  const downloadBlankTemplate = () => {
    // Collect students of selected reportGrade and reportStream
    const activeGradeStudents = students.filter(s => s.grade === reportGrade && (s.stream === reportStream || s.grade === '9' || s.grade === '10'));
    const testSubjects = SUBJECTS_BY_GRADE[reportGrade]?.[reportStream] || ['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Civics', 'IT'];
    
    // Prepare CSV headers
    const csvRows = [
      ['Student_ID_Number', 'Full_Name', 'Subject', 'Semester_Term_1_or_2', 'Assessment_Type_mid_term_or_final_term', 'Max_Score_Limit', 'Score_Obtained_Fill_Here']
    ];

    if (activeGradeStudents.length === 0) {
      // Just output headers with sample rows
      testSubjects.forEach(sub => {
        ['term_1', 'term_2'].forEach(term => {
          csvRows.push(['STDT_SAMPLE01', 'Sample Student Name', sub, term, 'mid_exam', '30', '']);
          csvRows.push(['STDT_SAMPLE01', 'Sample Student Name', sub, term, 'final_exam', '70', '']);
        });
        if (reportGrade === '12') {
          csvRows.push(['STDT_SAMPLE01', 'Sample Student Name', sub, 'term_1', 'mock_exam', '100', '']);
        }
      });
    } else {
      activeGradeStudents.forEach(stu => {
        testSubjects.forEach(sub => {
          ['term_1', 'term_2'].forEach(term => {
            csvRows.push([
              stu.sid || `STDT_${stu.uid.slice(0, 6).toUpperCase()}`,
              stu.fullName || stu.name || 'Anonymous Student',
              sub,
              term,
              'mid_exam',
              '30',
              ''
            ]);
            csvRows.push([
              stu.sid || `STDT_${stu.uid.slice(0, 6).toUpperCase()}`,
              stu.fullName || stu.name || 'Anonymous Student',
              sub,
              term,
              'final_exam',
              '70',
              ''
            ]);
          });
          if (reportGrade === '12') {
            csvRows.push([
              stu.sid || `STDT_${stu.uid.slice(0, 6).toUpperCase()}`,
              stu.fullName || stu.name || 'Anonymous Student',
              sub,
              'term_1',
              'mock_exam',
              '100',
              ''
            ]);
          }
        });
      });
    }

    // Generate CSV and trigger trigger download safely
    const csvContent = csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Biftu_Beri_Kutaa_${reportGrade}_${reportStream}_blank_marks_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Compiled Semester and Annual Classroom Stats CSV
  const downloadFullGradeCompiledReport = () => {
    const activeGradeStudents = students.filter(s => s.grade === reportGrade && (s.stream === reportStream || s.grade === '9' || s.grade === '10'));
    const testSubjects = SUBJECTS_BY_GRADE[reportGrade]?.[reportStream] || ['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Civics', 'IT'];
    
    const csvRows = [
      ['Student_ID', 'Student_Name', 'Subject', 'Term_1_Mid_30', 'Term_1_Final_70', 'Term_1_Total', 'Term_2_Mid_30', 'Term_2_Final_70', 'Term_2_Total', 'Annual_Average', 'Grade', 'Status']
    ];

    if (activeGradeStudents.length === 0) {
      alert("No students registered for this grade level. / Kutaa kanatti barattoonni galmeeffaman hin jiran.");
      return;
    }

    activeGradeStudents.forEach(stu => {
      const stuMarks = marks.filter(m => m.studentId === stu.uid);

      testSubjects.forEach(sub => {
        const sObj = {
          t1_mid: 0, t1_final: 0, t1_total: 0, t1_rec: false,
          t2_mid: 0, t2_final: 0, t2_total: 0, t2_rec: false,
          average: 0
        };

        stuMarks.forEach(m => {
          if (m.subject === sub) {
            const scoreVal = m.score || 0;
            if (m.term === 'term_1') {
              if (m.assessmentType === 'mid_exam') { sObj.t1_mid = scoreVal; sObj.t1_rec = true; }
              else if (m.assessmentType === 'final_exam') { sObj.t1_final = scoreVal; sObj.t1_rec = true; }
              else if (m.assessmentType === 'continuous_assessment') { sObj.t1_mid = Math.min(30, sObj.t1_mid + scoreVal); sObj.t1_rec = true; }
            } else if (m.term === 'term_2') {
              if (m.assessmentType === 'mid_exam') { sObj.t2_mid = scoreVal; sObj.t2_rec = true; }
              else if (m.assessmentType === 'final_exam') { sObj.t2_final = scoreVal; sObj.t2_rec = true; }
              else if (m.assessmentType === 'continuous_assessment') { sObj.t2_mid = Math.min(30, sObj.t2_mid + scoreVal); sObj.t2_rec = true; }
            }
          }
        });

        sObj.t1_total = sObj.t1_mid + sObj.t1_final;
        sObj.t2_total = sObj.t2_mid + sObj.t2_final;
        
        let termsCount = 0;
        let sum = 0;
        if (sObj.t1_rec) { sum += sObj.t1_total; termsCount++; }
        if (sObj.t2_rec) { sum += sObj.t2_total; termsCount++; }
        sObj.average = termsCount > 0 ? Math.round(sum / termsCount) : 0;

        const letterGrade = getGrade(sObj.average);
        const passStatus = sObj.average >= 50 ? 'PASS' : 'FAIL';

        csvRows.push([
          stu.sid || `STDT_${stu.uid.slice(0, 6).toUpperCase()}`,
          stu.fullName || stu.name || 'Anonymous',
          sub,
          sObj.t1_rec ? String(sObj.t1_mid) : '-',
          sObj.t1_rec ? String(sObj.t1_final) : '-',
          sObj.t1_rec ? String(sObj.t1_total) : '-',
          sObj.t2_rec ? String(sObj.t2_mid) : '-',
          sObj.t2_rec ? String(sObj.t2_final) : '-',
          sObj.t2_rec ? String(sObj.t2_total) : '-',
          sObj.t1_rec || sObj.t2_rec ? String(sObj.average) : '-',
          sObj.t1_rec || sObj.t2_rec ? letterGrade : '-',
          sObj.t1_rec || sObj.t2_rec ? passStatus : '-'
        ]);
      });
    });

    const csvContent = csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Biftu_Beri_Kutaa_${reportGrade}_${reportStream}_Compiled_Grades_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // REPORT CARD MATHS AND COMPILATION
  const activeStudent = students.find(s => s.uid === selectedStudentId);
  
  // Base manual and CSV-uploaded marks
  const studentMarks = [...marks.filter(m => m.studentId === selectedStudentId)];

  // Live Integration: Synchronize online exam submission records into report cards dynamically
  if (selectedStudentId && attempts && attempts.length > 0) {
    // Group and find the best effort with the highest scaled score for each unique assessment key
    const bestOnlineAttempts: Record<string, {
      att: ExamAttempt;
      scaledScore: number;
      totalPoints: number;
      term: 'term_1' | 'term_2';
      normSub: string;
      assessmentType: 'mid_exam' | 'final_exam' | 'mock_exam';
    }> = {};

    attempts.forEach(att => {
      // Find matching exam definition to get exam type & total points safely
      const matchedExam = exams.find(e => e.id === att.examId);
      if (!matchedExam) return;

      // Determine assessment type & weight
      let assessmentType: 'mid_exam' | 'final_exam' | 'mock_exam' = 'final_exam';
      let totalPoints = 70;
      if (matchedExam.type === 'mid') {
        assessmentType = 'mid_exam';
        totalPoints = 30;
      } else if (matchedExam.type === 'eaes_mock' || matchedExam.type === 'model') {
        assessmentType = 'mock_exam';
        totalPoints = 100;
      }

      // Compute scaled score proportional to totalPoints (Mid=30, Final=70, Mock=100)
      const attemptScore = att.score || 0;
      const attemptTotal = att.totalPoints || 1;
      const scaledScore = Math.min(totalPoints, Math.round((attemptScore / attemptTotal) * totalPoints * 10) / 10);

      // Determine academic semester/term based on titles or description
      const titleLower = (matchedExam.title || '').toLowerCase();
      const descLower = (matchedExam.description || '').toLowerCase();
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

      // Standardize subject name for correct grouping mapping
      const normSub = normalizeSubject(matchedExam.subject || att.examSubject);
      const key = `${normSub}_${term}_${assessmentType}`;

      // Insert or replace with higher score effort
      if (!bestOnlineAttempts[key] || scaledScore > bestOnlineAttempts[key].scaledScore) {
        bestOnlineAttempts[key] = {
          att,
          scaledScore,
          totalPoints,
          term,
          normSub,
          assessmentType
        };
      }
    });

    // Merge highest scored versions into student report records if teacher hasn't entered static logs
    Object.values(bestOnlineAttempts).forEach(item => {
      const hasPreExistingMark = studentMarks.some(m => 
        normalizeSubject(m.subject) === item.normSub && 
        m.term === item.term && 
        m.assessmentType === item.assessmentType
      );

      if (!hasPreExistingMark) {
        studentMarks.push({
          id: `db_online_exam_${item.att.id}`,
          studentId: selectedStudentId,
          studentName: activeStudent?.fullName || activeStudent?.name || item.att.userName || 'Student',
          studentSid: activeStudent?.sid || 'N/A',
          subject: item.normSub,
          assessmentType: item.assessmentType,
          score: item.scaledScore,
          totalPoints: item.totalPoints,
          term: item.term,
          recordedBy: 'Online Exam Hub (Highest Attempt)',
          recordedAt: item.att.finishedAt || new Date()
        });
      }
    });
  }

  // Grouping marks by subject dynamically based on selected grade and stream curriculum
  const reportSubjectsList = SUBJECTS_BY_GRADE[reportGrade]?.[reportStream] || [];

  const subjectsReport: Record<string, {
    t1_mid: number;
    t1_final: number;
    t1_total: number;
    t1_recorded: boolean;
    t2_mid: number;
    t2_final: number;
    t2_total: number;
    t2_recorded: boolean;
    average: number;
  }> = {};

  // Initialize all curriculum subjects first to establish the organized layout
  reportSubjectsList.forEach(sub => {
    subjectsReport[sub] = {
      t1_mid: 0,
      t1_final: 0,
      t1_total: 0,
      t1_recorded: false,
      t2_mid: 0,
      t2_final: 0,
      t2_total: 0,
      t2_recorded: false,
      average: 0
    };
  });

  // Populate actual registered marks
  studentMarks.forEach(m => {
    const normSub = normalizeSubject(m.subject);
    if (!subjectsReport[normSub]) {
      // Create if it's a legacy or custom subject outside curriculum
      subjectsReport[normSub] = {
        t1_mid: 0,
        t1_final: 0,
        t1_total: 0,
        t1_recorded: false,
        t2_mid: 0,
        t2_final: 0,
        t2_total: 0,
        t2_recorded: false,
        average: 0
      };
    }

    const sObj = subjectsReport[normSub];
    const scoreVal = m.score || 0;

    if (m.term === 'term_1') {
      if (m.assessmentType === 'mid_exam') {
        sObj.t1_mid = scoreVal;
        sObj.t1_recorded = true;
      } else if (m.assessmentType === 'final_exam') {
        sObj.t1_final = scoreVal;
        sObj.t1_recorded = true;
      } else if (m.assessmentType === 'continuous_assessment') {
        // Safe addition for legacy data
        sObj.t1_mid = Math.min(30, sObj.t1_mid + scoreVal);
        sObj.t1_recorded = true;
      }
    } else if (m.term === 'term_2') {
      if (m.assessmentType === 'mid_exam') {
        sObj.t2_mid = scoreVal;
        sObj.t2_recorded = true;
      } else if (m.assessmentType === 'final_exam') {
        sObj.t2_final = scoreVal;
        sObj.t2_recorded = true;
      } else if (m.assessmentType === 'continuous_assessment') {
        // Safe addition for legacy data
        sObj.t2_mid = Math.min(30, sObj.t2_mid + scoreVal);
        sObj.t2_recorded = true;
      }
    }
  });

  const reportRowKeys = Object.keys(subjectsReport).sort((a,b) => {
    // Put curriculum subjects first
    const aIdx = reportSubjectsList.indexOf(a);
    const bIdx = reportSubjectsList.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  // Compute semester totals and dual-term cumulative average
  reportRowKeys.forEach(sub => {
    const sObj = subjectsReport[sub];
    sObj.t1_total = sObj.t1_mid + sObj.t1_final;
    sObj.t2_total = sObj.t2_mid + sObj.t2_final;

    let totalRecordedTermsCount = 0;
    let combinedTermsSum = 0;
    if (sObj.t1_recorded) {
      combinedTermsSum += sObj.t1_total;
      totalRecordedTermsCount++;
    }
    if (sObj.t2_recorded) {
      combinedTermsSum += sObj.t2_total;
      totalRecordedTermsCount++;
    }

    sObj.average = totalRecordedTermsCount > 0 ? Math.round(combinedTermsSum / totalRecordedTermsCount) : 0;
  });

  // Calculate Cumulative Overall Performance Stats
  let overallAveragesSum = 0;
  let subjectsWithActiveMarks = 0;

  reportRowKeys.forEach(sub => {
    const sObj = subjectsReport[sub];
    if (sObj.t1_recorded || sObj.t2_recorded) {
      overallAveragesSum += sObj.average;
      subjectsWithActiveMarks++;
    }
  });

  const cumulativeAverage = subjectsWithActiveMarks > 0 ? Math.round(overallAveragesSum / subjectsWithActiveMarks) : 0;
  const passedSubjectsCount = reportRowKeys.filter(sub => {
    const sObj = subjectsReport[sub];
    return (sObj.t1_recorded || sObj.t2_recorded) && sObj.average >= 50;
  }).length;

  const totalPossibleSubjects = reportRowKeys.length;
  const isCumulativePromoted = cumulativeAverage >= 50 && passedSubjectsCount >= Math.ceil(subjectsWithActiveMarks / 2);

  // --- GRADE 12 NATIONAL EXAM CERTIFICATE / MOCK REMAPPING AND COMPILATION ---
  // Exclude 'HPE', 'Afaan Oromoo', and 'Citizenship' as requested by user to have exactly 7 subjects
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

  studentMarks.forEach(m => {
    if (m.assessmentType === 'mock_exam') {
      const normSub = normalizeSubject(m.subject);
      // Only record subject if it's in the filtered certificate subjects list
      const matchingSub = certificateSubjects.find(s => normalizeSubject(s).toLowerCase().replace(/\s+/g, '') === normSub.toLowerCase().replace(/\s+/g, ''));
      if (matchingSub) {
        mockMarksGrouped[matchingSub].score = m.score;
        mockMarksGrouped[matchingSub].recorded = true;
      }
    }
  });

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

  // Since we have removed 3 subjects, the national mock has exactly 7 subjects.
  // We apply the total 7 * 100 = 700 point scale (100% total).
  const mockAverage = recordedMockSubjectsCount > 0 ? Math.round(totalMockPointsObtained / recordedMockSubjectsCount) : 0;

  // Compute AGPA: score-to-GPA translation on 4.00 scale for the 7 subjects
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

  const exportReportCardPDF = () => {
    if (!selectedStudentId || !activeStudent) {
      alert("Please select a student to export a report card. / Maaloo barataa dura filadhaa.");
      return;
    }

    // Capture audit log for exporting PDF report
    if (isAdmin) {
      createAuditLog('export_pdf', 'MarksAndReports', selectedStudentId, activeStudent.fullName || activeStudent.name);
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // 1. Draw solid outer border
    doc.setDrawColor(15, 23, 42); // slate-900
    doc.setLineWidth(1.2);
    doc.rect(8, 8, 194, 281); // beautiful border around page

    // 2. Draw dual fine header border accent
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.rect(9, 9, 192, 279);

    // 3. Logo graphics (Aesthetic Brand Symbol)
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(12, 12, 16, 16, 3, 3, 'F');
    doc.setTextColor(250, 204, 21); // Yellow-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('B', 17.5, 22.5);

    // 4. Header Titles
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Biftu Beri Secondary School', 32, 17);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Sinnii Boqonnaa Lammii - National EAES Examination Portal', 32, 21.5);
    doc.text('Adama, Ethiopia | Established to Empower Academic Scholars', 32, 25.5);

    // 5. Official Stamp Corner info Box (on Right)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(144, 12, 54, 16, 1.5, 1.5, 'F');
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.rect(144, 12, 54, 16);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('OFFICIAL EXAM RECORD', 146.5, 16);
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text('ANNUAL REPORT CARD', 146.5, 21.2);
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('2018 E.C Academic Year', 146.5, 25.5);

    // 6. Dividing line
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(12, 31, 198, 31);

    // 7. Student Profile Info Box (Slate box)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.roundedRect(12, 35, 186, 28, 2, 2, 'FD');

    // Label Titles & Column layout
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    
    // Labels Col 1
    doc.text('STUDENT FULL NAME / MAQAA GUUTUU', 15, 40);
    doc.text('RESIDENTIAL ADDRESS / JIREenya', 15, 51);

    // Labels Col 2
    doc.text('STUDENT ID NUMBER / ID', 85, 40);
    doc.text('AGE / UMRIYAA', 85, 51);

    // Labels Col 3
    doc.text('GRADE & STREAM / KUTAA', 135, 40);
    doc.text('AFFILIATED INStiTUTION / MANA BARUMSAA', 135, 51);

    // Values Bold
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);

    // Values Col 1
    doc.text(String(activeStudent?.fullName || activeStudent?.name || 'Academic Scholar'), 15, 44.5);
    doc.setFontSize(8);
    doc.text(String(activeStudent?.address || 'Adama, Ethiopia'), 15, 55.5);

    // Values Col 2
    doc.setFontSize(8.5);
    doc.text(String(activeStudent?.sid || 'STDT_' + selectedStudentId.slice(0, 6).toUpperCase()), 85, 44.5);
    doc.setFontSize(8);
    doc.text(`${activeStudent?.age || '18'} Years`, 85, 55.5);

    // Values Col 3
    doc.setFontSize(8.5);
    doc.text(`Grade ${reportGrade} (${reportStream.toUpperCase()})`, 135, 44.5);
    doc.setFontSize(8);
    doc.text(String(activeStudent?.school || 'Biftu Beri Secondary School'), 135, 55.5);

    // 8. Classroom Assessments Label
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CLASSROOM ACADEMIC PERFORMANCE SCOREBOARD', 12, 69);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('OFFICIAL SEMESTER CREDENTIAL HARMONIZED MATRIX', 198, 69, { align: 'right' });

    // 9. Prep Auto-table body rows matching exactly our calculated values
    const tableBody = reportRowKeys.map((subj) => {
      const scores = subjectsReport[subj];
      const grd = getGrade(scores.average);
      const passed = scores.average >= 50;
      const hasSubData = scores.t1_recorded || scores.t2_recorded;

      return [
        subj,
        scores.t1_recorded ? String(scores.t1_mid) : '-',
        scores.t1_recorded ? String(scores.t1_final) : '-',
        scores.t1_recorded ? String(scores.t1_total) : '-',
        scores.t2_recorded ? String(scores.t2_mid) : '-',
        scores.t2_recorded ? String(scores.t2_final) : '-',
        scores.t2_recorded ? String(scores.t2_total) : '-',
        hasSubData ? `${scores.average}%` : '-',
        hasSubData ? grd : '-',
        hasSubData ? (passed ? 'PASS' : 'FAIL') : '-'
      ];
    });

    if (tableBody.length === 0) {
      tableBody.push(['No subjects recorded for chosen Grade level system.', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
    }

    // Call autoTable safely
    autoTable(doc, {
      startY: 71,
      margin: { left: 12, right: 12 },
      head: [
        [
          { content: 'Subject Curriculum', rowSpan: 2, styles: { halign: 'left', valign: 'middle', fontSize: 7 } },
          { content: 'Semester 1 (Sem-1)', colSpan: 3, styles: { halign: 'center' } },
          { content: 'Semester 2 (Sem-2)', colSpan: 3, styles: { halign: 'center' } },
          { content: 'Annual Cumulative', colSpan: 3, styles: { halign: 'center' } }
        ],
        [
          'Mid (30)', 'Final (70)', 'Total (100)',
          'Mid (30)', 'Final (70)', 'Total (100)',
          'Average', 'Grade', 'Status'
        ]
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.5,
        lineWidth: 0.15,
        lineColor: [51, 65, 85]
      },
      styles: {
        fontSize: 7.5,
        font: 'helvetica',
        cellPadding: 1.8
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] },
        7: { halign: 'center', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        8: { halign: 'center', fontStyle: 'bold' },
        9: { halign: 'center', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    // 10. Overall Term Stats Box (using dynamic lastAutoTable finalY coordinates)
    const statsY = (doc as any).lastAutoTable.finalY + 5;

    // Draw Stats Containers
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.roundedRect(12, statsY, 134, 15, 1.5, 1.5, 'FD');

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(150, statsY, 48, 15, 1.5, 1.5, 'F');
    doc.rect(150, statsY, 48, 15);

    // Labels Inside Left Stats Panel
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('CUMULATIVE AVERAGE', 15, statsY + 5.5);
    doc.text('PASSED LEVEL', 61, statsY + 5.5);
    doc.text('TOTAL SYLLABUS LIST', 103, statsY + 5.5);

    // Values Inside Left Stats Panel
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${cumulativeAverage}%`, 15, statsY + 11);
    doc.text(`${passedSubjectsCount} / ${subjectsWithActiveMarks} Subjects`, 61, statsY + 11);
    doc.text(`${totalPossibleSubjects} Courses`, 103, statsY + 11);

    // Official Promotion Board Label & Value inside Dark Panel
    doc.setTextColor(186, 230, 253);  // sky-200 Light text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('OFFICIAL PROMOTION STATUS', 153, statsY + 5);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(isCumulativePromoted ? 'PROMOTED / DARBE' : 'RETAINED / KUFE', 153, statsY + 11);

    // 11. Live Online Exam Attempt History (Optional but highly decorative and accurate)
    let currentY = statsY + 20;
    if (attempts && attempts.length > 0) {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('LIVE PORTAL ONLINE MOCK PRACTICES & ATTEMPTS HISTORY', 12, currentY);

      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.line(12, currentY + 1.2, 198, currentY + 1.2);

      currentY += 4.5;
      const completedAttempts = attempts.filter(a => a.status === 'completed' || a.status === 'timed-out').slice(0, 3);
      if (completedAttempts.length > 0) {
        completedAttempts.forEach((att) => {
          const pct = att.totalPoints ? Math.round((att.score || 0) / att.totalPoints * 100) : 0;

          doc.setFillColor(248, 250, 252);
          doc.roundedRect(12, currentY, 186, 6.5, 1, 1, 'F');
          doc.rect(12, currentY, 186, 6.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(15, 23, 42);
          doc.text(String(att.examTitle || 'Practice Attempt'), 14, currentY + 4.2);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`[${att.examSubject || 'General Examination'}]`, 110, currentY + 4.2);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(pct >= 50 ? 16 : 220, pct >= 50 ? 115 : 38, pct >= 50 ? 73 : 38);
          doc.text(`Score: ${att.score}/${att.totalPoints} (${pct}%) - ${pct >= 50 ? 'PASS' : 'FAIL'}`, 150, currentY + 4.2);

          currentY += 8.5;
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('No completed exam attempts registered in database portal directory.', 12, currentY + 3);
        currentY += 8;
      }
    }

    // 12. Signature Stamp Box fixed at bottom of A4 page to look like official certificate
    const footerY = 260;

    // Stamp circle on left
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.setFillColor(248, 250, 252);
    doc.circle(35, footerY - 7, 10, 'F');
    doc.circle(35, footerY - 7, 10);
    doc.circle(35, footerY - 7, 9.2); // double stamp frame border

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.3);
    doc.setTextColor(15, 23, 42);
    doc.text('Biftu Beri', 35, footerY - 9.5, { align: 'center' });
    doc.text('Seco. School', 35, footerY - 7, { align: 'center' });
    doc.text('★ SEAL STAMP ★', 35, footerY - 4.5, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Official Institution Seal', 35, footerY + 3.5, { align: 'center' });

    // Coordinator signature on center
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('IT PORTAL COORDINATOR', 82, footerY - 14);
    doc.setFont('times', 'italic');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Jemal Fano Haji', 82, footerY - 5);
    doc.line(82, footerY, 126, footerY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('IT Director Signature', 82, footerY + 3.5);

    // Office of Principal signature on right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('OFFICE OF THE PRINCIPAL', 150, footerY - 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Secondary Principal Desk', 150, footerY - 5);
    doc.line(150, footerY, 194, footerY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('Principal Signature Stamp', 150, footerY + 3.5);

    // Save PDF trigger
    const filename = `${String(activeStudent?.fullName || 'Student').replace(/[^a-z0-9]/gi, '_')}_Report_Card_Grade_${reportGrade}.pdf`;
    doc.save(filename);
  };

  const exportMarksToExcel = () => {
    const activeGradeStudents = students.filter(s => s.grade === reportGrade && (s.stream === reportStream || s.grade === '9' || s.grade === '10'));
    const testSubjects = SUBJECTS_BY_GRADE[reportGrade]?.[reportStream] || ['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Civics', 'IT'];

    if (activeGradeStudents.length === 0) {
      alert("No students found for the selected grade and stream.");
      return;
    }

    const data: any[] = [];

    activeGradeStudents.forEach(stu => {
      const stuMarks = marks.filter(m => m.studentId === stu.uid);

      testSubjects.forEach(sub => {
        const sObj = {
          t1_mid: 0, t1_final: 0, t1_total: 0, t1_rec: false,
          t2_mid: 0, t2_final: 0, t2_total: 0, t2_rec: false,
          average: 0
        };

        stuMarks.forEach(m => {
          if (m.subject === sub) {
            const scoreVal = m.score || 0;
            if (m.term === 'term_1') {
              if (m.assessmentType === 'mid_exam') { sObj.t1_mid = scoreVal; sObj.t1_rec = true; }
              else if (m.assessmentType === 'final_exam') { sObj.t1_final = scoreVal; sObj.t1_rec = true; }
              else if (m.assessmentType === 'continuous_assessment') { sObj.t1_mid = Math.min(30, sObj.t1_mid + scoreVal); sObj.t1_rec = true; }
            } else if (m.term === 'term_2') {
              if (m.assessmentType === 'mid_exam') { sObj.t2_mid = scoreVal; sObj.t2_rec = true; }
              else if (m.assessmentType === 'final_exam') { sObj.t2_final = scoreVal; sObj.t2_rec = true; }
              else if (m.assessmentType === 'continuous_assessment') { sObj.t2_mid = Math.min(30, sObj.t2_mid + scoreVal); sObj.t2_rec = true; }
            }
          }
        });

        sObj.t1_total = sObj.t1_mid + sObj.t1_final;
        sObj.t2_total = sObj.t2_mid + sObj.t2_final;
        
        let termsCount = 0;
        let sum = 0;
        if (sObj.t1_rec) { sum += sObj.t1_total; termsCount++; }
        if (sObj.t2_rec) { sum += sObj.t2_total; termsCount++; }
        sObj.average = termsCount > 0 ? Math.round(sum / termsCount) : 0;

        const letterGrade = getGrade(sObj.average);
        const passStatus = sObj.average >= 50 ? 'PASS' : 'FAIL';

        data.push({
          'Student ID': stu.sid || `STDT_${stu.uid.slice(0, 6).toUpperCase()}`,
          'Student Name': stu.fullName || stu.name || 'Anonymous',
          'Subject': sub,
          'Term 1 Mid (30)': sObj.t1_rec ? sObj.t1_mid : '-',
          'Term 1 Final (70)': sObj.t1_rec ? sObj.t1_final : '-',
          'Term 1 Total': sObj.t1_rec ? sObj.t1_total : '-',
          'Term 2 Mid (30)': sObj.t2_rec ? sObj.t2_mid : '-',
          'Term 2 Final (70)': sObj.t2_rec ? sObj.t2_final : '-',
          'Term 2 Total': sObj.t2_rec ? sObj.t2_total : '-',
          'Annual Average': sObj.t1_rec || sObj.t2_rec ? sObj.average : '-',
          'Grade': sObj.t1_rec || sObj.t2_rec ? letterGrade : '-',
          'Status': sObj.t1_rec || sObj.t2_rec ? passStatus : '-'
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Student Marks");
    
    // Set column widths
    const wscols = [
      {wch: 15}, {wch: 25}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 12},
      {wch: 15}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 8}, {wch: 10}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Biftu_Beri_Grade_${reportGrade}_${reportStream}_Marks.xlsx`);
  };

  // Filter & Search recorded marks for admin list
  const adminFilteredMarksList = marks.filter(m => {
    const studentMatch = searchQuery ? (m.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || m.studentSid.toLowerCase().includes(searchQuery.toLowerCase())) : true;
    const subjectMatch = filterSubject ? m.subject === filterSubject : true;
    const termMatch = filterTerm ? m.term === filterTerm : true;
    return studentMatch && subjectMatch && termMatch;
  });

  return (
    <div className="space-y-12">
      {/* Tab Selector */}
      {hasManagementAccess && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100 p-2 rounded-2xl w-fit">
          <button
            onClick={() => setActiveSubTab('records')}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'records' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Record & Manage Marks (CRUD)
          </button>
          <button
            onClick={() => setActiveSubTab('report_card')}
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'report_card' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Student Report Card / Kaardii Gabaasaa
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('audit_logs')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeSubTab === 'audit_logs' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Security Audit Logs
            </button>
          )}
        </div>
      )}

      {/* SUCCESS / ERROR BULLETINS */}
      {errorMsg && (
        <div className="p-4 bg-red-100 text-red-900 border-2 border-red-300 rounded-2xl font-bold flex items-center gap-3">
          <XCircle size={20} className="shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-100 text-emerald-900 border-2 border-emerald-300 rounded-2xl font-bold flex items-center gap-3">
          <CheckCircle size={20} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* TAB 1: ADMIN CRUD RECORDS RECORDER */}
        {activeSubTab === 'records' && hasManagementAccess && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* CRUD CREATE / EDIT FORM & BULK UPLOAD ZONE IN GRID */}
            {bulkCsvRows.length > 0 ? (
              /* INTERACTIVE ADVANCED CSV BULK PREVIEW PANEL */
              <div className="bg-white p-8 rounded-[40px] border-4 border-slate-900 shadow-xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        CSV Data Verification & Repair Dashboard
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Review raw student performance data. Correct errors inline before committing database entries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setBulkCsvRows([]);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all border border-slate-200"
                    >
                      Cancel / Discard Bulk
                    </button>
                    <button
                      onClick={handleBulkCsvCommit}
                      disabled={loadingMarks || csvProgress !== null || bulkCsvRows.filter(r => !r.validationError).length === 0}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border-2 border-emerald-800 shadow-md shadow-emerald-500/10 flex items-center gap-2"
                    >
                      <span>Commit {bulkCsvRows.filter(r => !r.validationError).length} Valid Marks</span>
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {csvProgress && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl space-y-2">
                    <div className="flex justify-between text-xs font-bold text-blue-950">
                      <span>Uploading Batch Mark Logs...</span>
                      <span>{csvProgress.current} / {csvProgress.total} records ({Math.round((csvProgress.current / csvProgress.total) * 105)}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-3 transition-all duration-300"
                        style={{ width: `${Math.min(100, (csvProgress.current / csvProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Summary boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                      {bulkCsvRows.length}
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Rows Parsed</div>
                      <div className="text-xs font-bold text-slate-800 mt-1">Found in file</div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                      {bulkCsvRows.filter(r => !r.validationError).length}
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">Verified & Ready</div>
                      <div className="text-xs font-bold text-emerald-800 mt-1">Passing validation</div>
                    </div>
                  </div>

                  <div className="bg-red-50 p-4 rounded-2xl border border-red-200 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm">
                      {bulkCsvRows.filter(r => r.validationError).length}
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-red-600 uppercase tracking-widest leading-none">Validation Issues</div>
                      <div className="text-xs font-bold text-red-800 mt-1">Action needed</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <Info size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none">Quick instruction</div>
                      <div className="text-[10px] font-bold text-slate-700 mt-1">Edit custom marks directly inside table cells!</div>
                    </div>
                  </div>
                </div>

                {/* Search & Actions block */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-200">
                  <div className="relative shrink-0 md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search matched student or subject..."
                      value={bulkSearchQuery}
                      onChange={(e) => setBulkSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-xs font-bold bg-white border-2 border-slate-300 rounded-xl outline-none text-slate-900 focus:border-slate-900 transition-all"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-600">
                    <span>💡 Non-valid records are automatically bypassed to guard database consistency.</span>
                  </div>
                </div>

                {/* Table list */}
                <div className="border border-slate-200 rounded-3xl overflow-hidden max-h-[450px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                        <th className="p-4 w-12 text-center">Row</th>
                        <th className="p-4">Student ID (SID / Match Name)</th>
                        <th className="p-4">Subject</th>
                        <th className="p-4">Assessment Type</th>
                        <th className="p-4">Semester</th>
                        <th className="p-4 w-28 text-center bg-slate-800">Score Out of Max</th>
                        <th className="p-4 w-72">Status & Alignment Checks</th>
                        <th className="p-4 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                      {bulkCsvRows.filter(row => {
                        const term = bulkSearchQuery.toLowerCase();
                        return (row.rawName || '').toLowerCase().includes(term) || 
                               (row.rawSid || '').toLowerCase().includes(term) ||
                               (row.rawSubject || '').toLowerCase().includes(term);
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-400 font-extrabold uppercase bg-white">
                            No files dataset matching your target filters found.
                          </td>
                        </tr>
                      ) : (
                        bulkCsvRows.filter(row => {
                          const term = bulkSearchQuery.toLowerCase();
                          return (row.rawName || '').toLowerCase().includes(term) || 
                                 (row.rawSid || '').toLowerCase().includes(term) ||
                                 (row.rawSubject || '').toLowerCase().includes(term);
                        }).map((row, index) => (
                          <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${row.validationError ? 'bg-red-50/30' : 'bg-white'}`}>
                            <td className="p-4 text-center text-slate-400 text-[10px] font-mono border-r border-slate-100">
                              {index + 1}
                            </td>
                            <td className="p-4">
                              {row.matchedStudent ? (
                                <div className="space-y-0.5">
                                  <div className="text-slate-900 font-black flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    {row.matchedStudent.fullName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {row.matchedStudent.sid || row.rawSid || 'N/A'} (Matched!)</div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="text-red-600 font-black">{row.rawName || 'Unresolved Name'}</div>
                                  <div className="text-[10px] text-red-400 font-mono">Unregistered SID: {row.rawSid || 'N/A'}</div>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-[10px] uppercase font-black text-slate-700">
                              {row.rawSubject}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                {row.cleanType === 'mid_exam' ? 'Mid Exam' : row.cleanType === 'final_exam' ? 'Final Exam' : 'Mock Exam'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-[10px] text-slate-600">
                                {row.cleanTerm === 'term_1' ? 'Term 1' : 'Term 2'}
                              </span>
                            </td>
                            <td className="p-4 bg-slate-50/50 text-center border-l border-r border-slate-100">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={row.totalPoints}
                                  value={row.rawScore}
                                  onChange={(e) => updateRowScore(row.id, e.target.value)}
                                  className="w-16 px-2 py-1 text-center bg-white border border-slate-300 rounded font-black text-xs text-slate-950 focus:border-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                <span className="text-[10px] text-slate-400 font-bold">/ {row.totalPoints}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {row.validationError ? (
                                <div className="text-red-600 font-extrabold flex items-center gap-2 bg-red-100/50 p-2 rounded-xl text-[10px] border border-red-200">
                                  <XCircle size={14} className="shrink-0 text-red-500" />
                                  <span>{row.validationError}</span>
                                </div>
                              ) : (
                                <div className="text-emerald-700 font-extrabold flex items-center gap-2 bg-emerald-100/50 p-2 rounded-xl text-[10px] border border-emerald-200">
                                  <CheckCircle size={14} className="shrink-0 text-emerald-500" />
                                  <span>Row Verified, Ready to Commit</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <button 
                                onClick={() => removeRowFromBulk(row.id)}
                                className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors"
                                title="Remove this record column"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-slate-900/90 text-white p-5 rounded-[28px] border-2 border-slate-800 shadow-xl">
                  <div className="text-xs font-bold">
                    Currently verifying <span className="text-emerald-400 font-black">{bulkCsvRows.filter(r => !r.validationError).length}</span> ready scores out of <span className="text-blue-300 font-black">{bulkCsvRows.length} total</span>.
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setBulkCsvRows([])}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                    >
                      Clear Data Buffer
                    </button>
                    <button
                      onClick={handleBulkCsvCommit}
                      disabled={loadingMarks || csvProgress !== null || bulkCsvRows.filter(r => !r.validationError).length === 0}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-500/10"
                    >
                      Commit Verified Upload
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Manual Form Area */}
                <div className="lg:col-span-2 bg-slate-50 p-8 rounded-[36px] border-4 border-slate-900 shadow-xl space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Plus size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                        {editingMarkId ? 'Edit Student Mark Record' : 'Record New Academic Assessment'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Insert Term performance, examinations and continuous assessments to compiling report card.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveMark} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Student / Barataa</label>
                      <select
                        value={formData.studentId}
                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                        className="w-full px-4 py-3 bg-white rounded-2xl border-2 border-slate-900 outline-none text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 transition-all text-xs"
                        required
                      >
                        <option value="">-- Select Student --</option>
                        {students.map(s => (
                          <option key={s.uid} value={s.uid}>
                            {s.fullName || s.name} ({s.sid || 'No ID'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject / Barnoota</label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        disabled={isStaff && !!profile?.subject}
                        className="w-full px-4 py-3 bg-white rounded-2xl border-2 border-slate-900 outline-none text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-75 text-xs"
                      >
                        {isStaff && profile?.subject ? (
                          <option value={profile.subject}>{profile.subject}</option>
                        ) : (
                          ALL_SUBJECTS.map(subj => (
                            <option key={subj} value={subj}>{subj}</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Academic Term</label>
                      <select
                        value={formData.term}
                        onChange={(e) => setFormData({ ...formData, term: e.target.value as 'term_1' | 'term_2' })}
                        className="w-full px-4 py-3 bg-white rounded-2xl border-2 border-slate-900 outline-none text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 transition-all text-xs"
                      >
                        <option value="term_1">Term 1 (Semisteera 1)</option>
                        <option value="term_2">Term 2 (Semisteera 2)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assessment Type</label>
                      <select
                        value={formData.assessmentType}
                        onChange={(e) => setFormData({ ...formData, assessmentType: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white rounded-2xl border-2 border-slate-900 outline-none text-slate-900 font-bold focus:ring-4 focus:ring-blue-500/10 transition-all text-xs"
                      >
                        <option value="mid_exam">Mid Term Exam (Max 30 Marks)</option>
                        <option value="final_exam">Final Term Exam (Max 70 Marks)</option>
                        <option value="mock_exam">Grade 12 National Mock Exam (Max 100 Marks)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Score ({formData.assessmentType === 'final_exam' ? 'Max 70' : formData.assessmentType === 'mock_exam' ? 'Max 100' : 'Max 30'})
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={formData.assessmentType === 'final_exam' ? 70 : formData.assessmentType === 'mock_exam' ? 100 : 30}
                        placeholder="e.g. 24.5"
                        value={formData.score}
                        onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                        className="w-full px-4 py-3 bg-white rounded-2xl border-2 border-slate-900 outline-none text-slate-900 font-black focus:ring-4 focus:ring-blue-500/10 transition-all text-xs"
                        required
                      />
                    </div>

                    <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                      {editingMarkId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMarkId(null);
                            setFormData({
                              studentId: '',
                              subject: ALL_SUBJECTS[0] || 'Mathematics',
                              term: 'term_1',
                              assessmentType: 'continuous_assessment',
                              score: '',
                            });
                          }}
                          className="px-5 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all"
                        >
                          {t('common.cancel')}
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl border-2 border-blue-800 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
                      >
                        {submitting ? 'Saving...' : editingMarkId ? 'Update Record' : 'Record Score'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Bulk CSV Score Upload Zone */}
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile) {
                      handleCSVUpload(null, droppedFile);
                    }
                  }}
                  className={`p-8 rounded-[36px] border-4 shadow-xl space-y-6 flex flex-col justify-between transition-all ${
                    dragOver 
                      ? 'bg-emerald-50 border-emerald-505 scale-[1.02]' 
                      : 'bg-slate-50 border-slate-900'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <FileSpreadsheet size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                          Bulk Upload Marks
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Upload completed CSV sheets instantly.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-2xl border-2 border-slate-350 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-600">CSV Template Quickstart:</p>
                      <ol className="text-[9px] font-bold text-slate-500 list-decimal pl-4 space-y-1">
                        <li>Use 'Student Report Card' tab.</li>
                        <li>Click <strong>Download Blank Template (CSV)</strong> below.</li>
                        <li>Fill the <em>Score_Obtained_Fill_Here</em> columns.</li>
                        <li>Drop your file into the zone below to upload.</li>
                      </ol>
                    </div>

                    {/* Standard file input custom label style */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Upload Spreadsheet File (CSV)</label>
                      <div className="relative border-4 border-dashed border-slate-350 p-6 rounded-2xl hover:border-slate-800 bg-white transition-all text-center">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="space-y-2">
                          <UploadCloud size={32} className={`mx-auto ${dragOver ? 'text-emerald-500' : 'text-slate-400'}`} />
                          <span className="block text-xs text-slate-900 font-extrabold uppercase">
                            {dragOver ? 'Drop CSV File Here' : 'Choose CSV File'}
                          </span>
                          <span className="text-[9px] text-slate-400 block font-bold leading-normal">SUPPORTED: COMMA DELIMITED CSV • UP TO 5MB</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[9px] font-bold text-amber-600 bg-amber-50 rounded-xl p-3 border border-amber-250 leading-normal">
                    ⚠️ Note: CSV import maps target records by <strong>Student_ID_Number (SID)</strong>, Name, or User UUID and automatically replaces conflict records with zero duplications!
                  </div>
                </div>
              </div>
            )}

            {/* LIVE CRUD DATA FILTER & TABLE LISTING */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registered Marks Database</h3>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search Student..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 text-xs font-bold bg-white border-2 border-slate-300 rounded-xl outline-none text-slate-950 focus:border-slate-900 transition-all"
                    />
                  </div>

                  <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    disabled={isStaff && !!profile?.subject}
                    className="px-3 py-2 text-xs font-bold bg-white border-2 border-slate-300 rounded-xl outline-none disabled:opacity-75"
                  >
                    {isStaff && profile?.subject ? (
                      <option value={profile.subject}>{profile.subject}</option>
                    ) : (
                      <>
                        <option value="">All Subjects</option>
                        {ALL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </>
                    )}
                  </select>

                  <select
                    value={filterTerm}
                    onChange={(e) => setFilterTerm(e.target.value)}
                    className="px-3 py-2 text-xs font-bold bg-white border-2 border-slate-300 rounded-xl outline-none"
                  >
                    <option value="">All Terms</option>
                    <option value="term_1">Term 1</option>
                    <option value="term_2">Term 2</option>
                  </select>
                </div>
              </div>

              {/* HIGH CONTRAST BOLD CRUD TABLE */}
              <div className="bg-white rounded-3xl border-4 border-slate-900 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b-4 border-slate-900">
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Student Name</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Subject</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Term</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Assessment Type</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Score</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Actions (CRUD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-200">
                      {adminFilteredMarksList.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 border-r-2 border-slate-200">
                            <span className="font-extrabold text-slate-900 text-sm block">{m.studentName}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ID: {m.studentSid}</span>
                          </td>
                          <td className="px-6 py-4 border-r-2 border-slate-200 font-extrabold text-slate-800">{m.subject}</td>
                          <td className="px-6 py-4 border-r-2 border-slate-200">
                            <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 font-black text-[10px] uppercase rounded-md text-slate-700">
                              {m.term === 'term_1' ? 'Term 1' : 'Term 2'}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r-2 border-slate-200">
                            <span className={`px-2.5 py-1 font-black text-[9px] uppercase tracking-wider rounded-md border ${
                              m.assessmentType === 'final_exam' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              m.assessmentType === 'mid_exam' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              {m.assessmentType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-r-2 border-slate-200">
                            <span className="font-black text-slate-900 text-sm">{m.score}</span>
                            <span className="text-slate-400 text-xs font-bold"> / {m.totalPoints}</span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleEditMarkClick(m)}
                              className="px-3 py-1.5 bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 text-blue-700 font-extrabold text-[10px] uppercase rounded-xl transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteMarkClick(m.id)}
                              className="px-3 py-1.5 bg-red-50 border-2 border-red-200 hover:bg-red-100 text-red-700 font-extrabold text-[10px] uppercase rounded-xl transition-all"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {adminFilteredMarksList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-black uppercase text-xs">
                            No mark records located matching chosen filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: PORTABLE OFFICIAL STUDENT REPORT CARD VIEW */}
        {activeSubTab === 'report_card' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            {/* Elegant Report Type Toggles for Grade 12 separate Certificate */}
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl w-fit print:hidden">
              <button
                type="button"
                onClick={() => setReportType('classroom')}
                id="btn-report-type-classroom"
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  reportType === 'classroom'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Classroom Term Report (30/70)
              </button>
              {reportGrade === '12' && (
                <button
                  type="button"
                  id="btn-report-type-certificate"
                  onClick={() => setReportType('certificate')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                    reportType === 'certificate'
                      ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md shadow-amber-500/20'
                      : 'text-slate-500 hover:text-amber-700'
                  }`}
                >
                  <Award size={14} className={reportType === 'certificate' ? 'animate-bounce' : ''} />
                  <span>Grade 12 EAES Certificate</span>
                </button>
              )}
            </div>

            {/* SEARCH AND CONTROL ROW (VISIBLE TO ADMINS/PARENTS/STUDENTS) */}
            {!isStudent && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-250 flex flex-col xl:flex-row xl:items-center justify-between gap-6 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end w-full xl:w-auto">
                  {hasManagementAccess && (
                    <div className="space-y-1.5 min-w-[220px]">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Student:</span>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-[15px] text-xs font-black outline-none focus:border-slate-900"
                      >
                        <option value="">-- Choose Student --</option>
                        {students.map(s => (
                          <option key={s.uid} value={s.uid}>
                            {s.fullName || s.name} ({s.sid || 'No ID'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrange Grade Level:</span>
                    <select
                      value={reportGrade}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setReportGrade(val);
                        if (val === '9' || val === '10') {
                          setReportStream('general');
                        } else if (reportStream === 'general') {
                          setReportStream('natural');
                        }
                      }}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-[15px] text-xs font-black outline-none focus:border-slate-900"
                    >
                      <option value="9">Grade 9 (Kutaa 9)</option>
                      <option value="10">Grade 10 (Kutaa 10)</option>
                      <option value="11">Grade 11 (Kutaa 11)</option>
                      <option value="12">Grade 12 (Kutaa 12)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 font-bold">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Stream Area:</span>
                    <select
                      value={reportStream}
                      onChange={(e) => setReportStream(e.target.value as any)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-[15px] text-xs font-black outline-none focus:border-slate-900"
                    >
                      {parseInt(reportGrade) <= 10 ? (
                        <option value="general">General (Koreesuma)</option>
                      ) : (
                        <>
                          <option value="natural">Natural Science (Saayinsii Uumamaa)</option>
                          <option value="social">Social Science (Saayinsii Hawaasummaa)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* ACTION BUTTONS (PRINT AND AUTO-GEN DATA) */}
                <div className="flex items-center flex-wrap gap-3">
                  {hasManagementAccess && (
                    <button
                      onClick={handleAutoFillMarks}
                      className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-2 border-purple-200 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      title="Generate automatic test marks for instant card preview"
                    >
                      <Sparkles size={14} />
                      <span>Auto-Fill Mock Performance</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setPendingPrintFn(() => () => window.print());
                      setShowPrintConfirm(true);
                    }}
                    className="px-5 py-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center gap-2 shadow-md shadow-emerald-500/10 hover:scale-105"
                  >
                    <Download size={16} />
                    <span>Export to PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      setPendingPrintFn(() => () => window.print());
                      setShowPrintConfirm(true);
                    }}
                    className="px-5 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center gap-2 shadow-md shadow-blue-500/10 hover:scale-105"
                  >
                    <Printer size={16} />
                    <span>Print Current View</span>
                  </button>

                  {hasManagementAccess && (
                    <>
                      <button
                        onClick={exportReportCardPDF}
                        className="px-5 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center gap-2 shadow-md shadow-indigo-500/10 hover:scale-105 cursor-pointer"
                        title="Export Official High-Quality PDF Report Card"
                      >
                        <Download size={16} />
                        <span>Export PDF Report Card</span>
                      </button>

                      <button
                        onClick={exportMarksToExcel}
                        className="px-5 py-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 flex items-center gap-2 shadow-md shadow-emerald-500/10 hover:scale-105 cursor-pointer"
                        title="Export All Student Marks to Excel (.xlsx)"
                      >
                        <FileSpreadsheet size={16} />
                        <span>Download Excel</span>
                      </button>
                    </>
                  )}
                </div>

                {/* EXCEL / OFFLINE DOCUMENT MANAGEMENT CENTER */}
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-200/60 mt-4 space-y-4 print:hidden">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <FileSpreadsheet className="text-blue-600" size={16} />
                      Classroom Downloads & Offline Formats Area / Iddoo Buufata Maalata Ooflaayinii
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 leading-snug">
                      Download empty grading formats, blank mark templates, or export compiled results to update offline or record in other systems.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={downloadBlankTemplate}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-950 border-2 border-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center gap-2 shadow-sm active:scale-95"
                      title="Download blank template specifically customized for selected Grade curriculum"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600 animate-pulse" />
                      <span>Download Blank Template (CSV)</span>
                    </button>
                    <button
                      onClick={downloadFullGradeCompiledReport}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-950 border-2 border-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center gap-2 shadow-sm active:scale-95"
                      title="Export all compiled registered student results as CSV"
                    >
                      <Layers size={14} className="text-blue-600" />
                      <span>Export Full Grade Report</span>
                    </button>
                    <button
                      onClick={() => setShowBlankPrintSheet(!showBlankPrintSheet)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center gap-2 shadow-sm active:scale-95"
                      title="Toggle high-contrast printable blank physical mark sheet"
                    >
                      <Printer size={14} className="text-yellow-400" />
                      <span>{showBlankPrintSheet ? 'Back to Student Card' : 'Print Blank Grading Sheet'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* THE DISPLAY VIEW CARD */}
            {showBlankPrintSheet ? (
              /* THE BLANK PRINTABLE SCHOOL GRADING FORMAT CARD */
              <div id="blank-printable-sheet" className="printable-report-card bg-white rounded-[40px] border-8 border-slate-950 shadow-2xl p-8 md:p-12 max-w-4xl mx-auto space-y-10 relative overflow-hidden print:border-none print:shadow-none print:p-0">
                <div className="border-b-4 border-slate-950 pb-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="w-20 h-20 bg-slate-900 text-yellow-500 rounded-[28px] border-4 border-slate-800 flex items-center justify-center text-4xl font-extrabold shadow-lg select-none">
                      B
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tight">
                        Biftu Beri Secondary School
                      </h2>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                        OFFLINE CLASSROOM RECORD FORMAT & BLANK EVALUATION SHEET
                      </p>
                      <p className="text-[10px] text-slate-400 leading-none font-bold mt-1">
                        Suitable for physical assessment scoring, classroom portfolio trackers, and manual records.
                      </p>
                    </div>
                  </div>
                  <div className="text-center md:text-right border-2 border-slate-950 p-2.5 rounded-2xl bg-slate-100 font-sans">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">OFFLINE CLASS TRACKER</span>
                    <strong className="block text-sm text-blue-700 font-black">Grade {reportGrade} ({reportStream.toUpperCase()})</strong>
                    <span className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">Academic Year: 2018 E.C / 2026 G.C</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 border-2 border-slate-950 rounded-2xl p-4 print:hidden">
                    <div className="text-xs font-bold text-slate-800 leading-snug">
                      Instruction: Use this sheet to collect Mid Exam (Max 30 Marks) and Final Exam (Max 70 Marks) results for students manually before entering them in the Digital Examination Portal. Fits on standard A4 paper.
                    </div>
                    <button
                      onClick={() => {
                        setPendingPrintFn(() => () => window.print());
                        setShowPrintConfirm(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 print:hidden font-mono"
                    >
                      <Printer size={12} />
                      Print Empty Sheet
                    </button>
                  </div>

                  <div className="border-[5px] border-slate-950 bg-white rounded-3xl overflow-hidden shadow-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-900 text-white border-b-2 border-slate-850 uppercase text-[9px] md:text-[10px] font-black tracking-widest text-center">
                            <th className="px-4 py-3 text-left border-r-2 border-slate-850 min-w-[150px]" rowSpan={2}>Subject Name / Barnoota</th>
                            <th className="px-4 py-3 border-r-2 border-slate-850" colSpan={3}>First Semester (Semisteera 1)</th>
                            <th className="px-4 py-3" colSpan={3}>Second Semester (Semisteera 2)</th>
                          </tr>
                          <tr className="bg-slate-800 text-slate-200 border-b-4 border-slate-950 text-[8px] md:text-[9px] uppercase font-black text-center">
                            <th className="px-2 py-2 border-r border-slate-700 w-24">Mid Score (30)</th>
                            <th className="px-2 py-2 border-r border-slate-700 w-24">Final Score (70)</th>
                            <th className="px-2 py-2 border-r-2 border-slate-850 bg-slate-900 text-yellow-400 w-28">Total (100)</th>
                            <th className="px-2 py-2 border-r border-slate-700 w-24">Mid Score (30)</th>
                            <th className="px-2 py-2 border-r border-slate-700 w-24">Final Score (70)</th>
                            <th className="px-2 py-2 bg-slate-900 text-yellow-400 w-28">Total (100)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-400 bg-white">
                          {(SUBJECTS_BY_GRADE[reportGrade]?.[reportStream] || ['English', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Civics', 'IT']).map((sub) => (
                            <tr key={sub} className="font-extrabold text-slate-950 text-xs border-b-2 border-slate-350">
                              <td className="px-4 py-5 border-r-2 border-slate-950 font-black tracking-tight bg-slate-50">{sub}</td>
                              <td className="px-2 py-5 border-r border-slate-200 text-center font-mono text-slate-300">__________</td>
                              <td className="px-2 py-5 border-r border-slate-200 text-center font-mono text-slate-300">__________</td>
                              <td className="px-2 py-5 border-r-2 border-slate-950 text-center bg-slate-50 font-mono font-black text-slate-900">/ 100</td>
                              <td className="px-2 py-5 border-r border-slate-200 text-center font-mono text-slate-300">__________</td>
                              <td className="px-2 py-5 border-r border-slate-200 text-center font-mono text-slate-300">__________</td>
                              <td className="px-2 py-5 text-center bg-slate-50 font-mono font-black text-slate-900">/ 100</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footers for signature */}
                <div className="print-signature-area grid grid-cols-3 gap-8 pt-12 border-t-2 border-dashed border-slate-400 text-center text-[10px] font-black uppercase text-slate-500 print:pt-4">
                  <div className="space-y-8">
                    <p className="border-b-2 border-slate-400 pb-1.5 h-8"></p>
                    <p>Classroom Teacher Signature</p>
                  </div>
                  <div className="space-y-8">
                    <p className="border-b-2 border-slate-400 pb-1.5 h-8"></p>
                    <p>Academic Dean Sign</p>
                  </div>
                  <div className="space-y-8">
                    <p className="border-b-2 border-slate-400 pb-1.5 h-8"></p>
                    <p>School Stamp Date</p>
                  </div>
                </div>
              </div>
            ) : !selectedStudentId ? (
              <div className="p-12 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200 text-slate-400 space-y-3">
                <User size={48} className="mx-auto text-slate-300" />
                <p className="font-extrabold text-sm uppercase tracking-widest">Select a student profile to render academic compiling card.</p>
              </div>
            ) : reportGrade === '12' && reportType === 'certificate' ? (
              /* THE GRADE 12 MOCK/EAES NATIONAL EXAM CERTIFICATE VIEW */
              <div id="printable-national-certificate" className="printable-report-card bg-white rounded-[45px] border-8 border-amber-500 shadow-2xl p-8 md:p-12 max-w-4xl mx-auto space-y-10 relative overflow-hidden print:border-none print:shadow-none print:p-0">
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
                      <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tight flex items-center justify-center md:justify-start gap-2">
                        <span>Biftu Beri Secondary School</span>
                      </h2>
                      <p className="text-xs font-black text-amber-600 uppercase tracking-widest mt-1">
                        NATIONAL EDUCATION ASSESSMENT & EXAMINATIONS AGENCY (EAES)
                      </p>
                      <p className="text-[10px] text-slate-500 leading-none font-bold mt-1.5 uppercase tracking-wide">
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
                      EAES-{activeStudent?.sid?.toUpperCase() || 'MOCK-' + activeStudent?.uid.slice(0, 6).toUpperCase()}
                    </strong>
                    <span className="text-[9px] font-black text-amber-700 block uppercase tracking-wider mt-0.5">Grade 12 {reportStream.toUpperCase()} Stream</span>
                  </div>
                </div>

                {/* Main Certificate Title & Sub-badge */}
                <div className="text-center space-y-4 pt-4 relative z-10">
                  <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-300">
                    Official Examination Readiness Performance Record
                  </div>
                  <h3 className="text-3xl font-black text-slate-950 tracking-tight uppercase leading-none">
                    Grade 12 National Mock Examination Certificate
                  </h3>
                  <p className="text-xs font-bold text-slate-500 max-w-2xl mx-auto leading-relaxed">
                    This document certifies that the candidate declared below has fully completed the high-fidelity Grade 12 National Mock Evaluations modeled on the Federal EAES Examination Matrix.
                  </p>
                </div>

                {/* Student Bio Metadata Panel */}
                <div className="bg-slate-50 p-6 rounded-[24px] border-2 border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold uppercase tracking-wide text-slate-700 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <span className="text-[10px] font-black text-slate-400">Student Full Name:</span>
                      <span className="font-extrabold text-slate-900">{activeStudent?.fullName || activeStudent?.name}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <span className="text-[10px] font-black text-slate-400">National Registration ID:</span>
                      <span className="font-black text-slate-900 font-mono tracking-wider">{activeStudent?.sid || 'NOT ASSIGNED'}</span>
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
                        <tr className="bg-slate-900 text-white border-b-2 border-slate-950 uppercase text-[10px] font-black tracking-widest">
                          <th className="px-6 py-4 border-r border-slate-800">Subject Area / Barnoota</th>
                          <th className="px-6 py-4 text-center border-r border-slate-800">Assessment Type</th>
                          <th className="px-6 py-4 text-center border-r border-slate-800">National Max Score</th>
                          <th className="px-6 py-4 text-center border-r border-amber-500 bg-amber-500 text-slate-950">Score Obtained (100)</th>
                          <th className="px-6 py-4 text-center border-r border-slate-800">Letter Grade</th>
                          <th className="px-6 py-4 text-center">Status / Milkaa'ina</th>
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

                {/* Mock Cumulative Summary Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 relative z-10 text-center">
                  <div className="bg-amber-50/50 border-2 border-amber-300 p-4 rounded-[22px]">
                    <span className="text-[8px] font-black text-amber-800 uppercase tracking-widest block leading-tight">Total Subjects (7n)</span>
                    <strong className="text-2xl font-black text-slate-950 block mt-1">{recordedMockSubjectsCount} / 7</strong>
                    <span className="text-[7px] font-bold text-slate-400 block uppercase mt-1 leading-none">Afaan Oromoo, HPE, Civics Excluded</span>
                  </div>
                  <div className="bg-yellow-50/40 border-2 border-yellow-300 p-4 rounded-[22px]">
                    <span className="text-[8px] font-black text-yellow-800 uppercase tracking-widest block leading-tight">Total Points Obtained</span>
                    <strong className="text-2xl font-black text-slate-950 block mt-1">
                      {recordedMockSubjectsCount > 0 ? totalMockPointsObtained : '-'} <span className="text-xs font-medium text-slate-400">/ 700</span>
                    </strong>
                    <span className="text-[7px] font-bold text-slate-400 block uppercase mt-1 leading-none">Max 100 per Subject</span>
                  </div>
                  <div className="bg-slate-900 text-white p-4 rounded-[22px]">
                    <span className="text-[8px] font-black text-yellow-400 uppercase tracking-widest block leading-tight">National AGPA Score</span>
                    <strong className="text-2xl font-black text-white block mt-1">
                      {mockAGPA} <span className="text-xs font-normal text-slate-400">/ 4.00</span>
                    </strong>
                    <span className="text-[7px] font-bold text-yellow-500/80 block uppercase mt-1 leading-none">Average: {mockAverage}%</span>
                  </div>
                  <div className="bg-slate-50 border-2 border-slate-900 p-4 rounded-[22px] flex flex-col justify-center items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-tight">National Status</span>
                    <span className={`text-[11px] font-black uppercase tracking-wider block mt-1.5 ${
                      doesQualifyForEAESNational ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {recordedMockSubjectsCount === 0 ? 'NO RECORD' : doesQualifyForEAESNational ? '✓ QUALIFIED (PASSED)' : '✗ UNQUALIFIED'}
                    </span>
                    <span className="text-[7px] font-bold text-slate-400 block uppercase mt-1 leading-none">Based on min 50%</span>
                  </div>
                </div>

                {/* Certified Validation Seals & Official Coordinators signatures */}
                <div className="print-signature-area grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t-2 border-dashed border-amber-300 relative z-10">
                  <div className="text-center font-bold text-slate-600 uppercase text-[10px]">
                    <div className="w-16 h-16 rounded-full border-4 border-double border-amber-600 bg-amber-50/50 mx-auto mb-2 flex flex-col items-center justify-center font-black text-[7px] text-amber-800 tracking-wider shadow-sm select-none leading-none relative">
                      <span className="text-[6px] font-black text-amber-500">★ ★ ★</span>
                      <span className="font-extrabold mt-0.5">VALID</span>
                      <span className="text-[5px] text-amber-500 font-bold uppercase mt-0.5">EAES PORTAL</span>
                    </div>
                    <p className="font-extrabold text-slate-900">EAES PORTAL VALIDATED</p>
                    <p className="text-[9px] text-slate-400 font-medium">Biftu Beri Examinations Board</p>
                  </div>
                  <div className="text-center font-bold text-slate-600 uppercase text-[10px] flex flex-col justify-end">
                    <div className="w-16 h-16 rounded-full border-4 border-double border-red-600/40 bg-red-50/20 mx-auto mb-2 flex flex-col items-center justify-center font-black text-[7px] text-red-800/80 tracking-wider shadow-none select-none leading-none relative">
                      <span className="text-[5px] font-bold text-red-500/85 text-center scale-90">BIFTU BERI</span>
                      <span className="font-extrabold mt-0.5">APPROVED</span>
                      <span className="text-[4px] text-red-500/80 font-bold uppercase mt-0.5">EXAM OFFICE</span>
                    </div>
                    <p className="border-b border-slate-350 pb-1 h-8 w-48 mx-auto font-serif italic text-amber-700 text-center font-semibold pt-1">
                       Jemal Fano Haji
                    </p>
                    <p className="font-extrabold text-slate-900 mt-1">IT & Examination Coordinator</p>
                    <p className="text-[9px] text-slate-400 font-medium">Validation Stamp</p>
                  </div>
                  <div className="text-center font-bold text-slate-600 uppercase text-[10px] flex flex-col justify-end">
                    <div className="w-16 h-16 rounded-full border-4 border-double border-blue-600/40 bg-blue-50/20 mx-auto mb-2 flex flex-col items-center justify-center font-black text-[7px] text-blue-800/80 tracking-wider shadow-none select-none leading-none relative">
                      <span className="text-[5px] font-bold text-blue-500/85 text-center scale-90">SECONDARY</span>
                      <span className="font-extrabold mt-0.5">CERTIFIED</span>
                      <span className="text-[4px] text-blue-500/80 font-bold uppercase mt-0.5">PRINCIPAL</span>
                    </div>
                    <p className="border-b border-slate-350 pb-1 h-8 w-48 mx-auto font-serif italic text-blue-900 text-center font-semibold pt-1">
                       School Principal
                    </p>
                    <p className="font-extrabold text-slate-900 mt-1">School Principal Signature</p>
                    <p className="text-[9px] text-slate-400 font-medium">Official Certified Seal</p>
                  </div>
                </div>
              </div>
            ) : (
              /* THE PRINTABLE CARD LAYOUT */
              <div id="printable-report-card" className="printable-report-card bg-white rounded-[40px] border-8 border-slate-900 shadow-2xl p-8 md:p-12 max-w-4xl mx-auto space-y-10 relative overflow-hidden print:border-none print:shadow-none print:p-0">
                {/* School Header Graphic Banner */}
                <div className="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="w-20 h-20 bg-slate-900 text-yellow-400 rounded-[28px] border-4 border-slate-800 flex items-center justify-center text-4xl font-extrabold shadow-lg select-none">
                      B
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tight">
                        Biftu Beri Secondary School
                      </h2>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                        Sinnii Boqonnaa Lammii - National EAES Examination Portal
                      </p>
                      <p className="text-[10px] text-slate-400 leading-none font-bold mt-1">
                        Adama, Ethiopia • Established to Empower Academic Scholars
                      </p>
                    </div>
                  </div>
                  <div className="text-center md:text-right border-2 border-slate-900 p-2.5 rounded-2xl bg-slate-100 font-sans">
                    <div className="text-xs font-black text-slate-900 uppercase">OFFICIAL EXAM RECORD</div>
                    <div className="text-[13px] font-black text-blue-700">ANNUAL STUDENT REPORT</div>
                    <div className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">{new Date().getFullYear()} E.C Academic Year</div>
                  </div>
                </div>

                {/* PROFILE METADATA SECTION */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-[28px] border-4 border-slate-900">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Student Full Name</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm truncate">{activeStudent?.fullName || activeStudent?.name || 'Academic Scholar'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Student ID Number</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm">{activeStudent?.sid || 'STDT_' + selectedStudentId.slice(0, 6).toUpperCase()}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grade & Stream</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm">
                      Grade {reportGrade} • <span className="uppercase">{reportStream}</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Academic Year</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm">2018 E.C / 2026 G.C</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age / Umrii</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm">{activeStudent?.age || '18'} Years</span>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Residential Address</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm">{activeStudent?.address || 'Adama, Ethiopia'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Affiliation School</span>
                    <span className="font-black text-slate-950 block text-xs md:text-sm truncate">{activeStudent?.school || 'Biftu Beri Secondary'}</span>
                  </div>
                </div>

                {/* ACADEMIC PROGRESS TABLE - EXTRA BOLD STYLES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                    <h3 className="text-xs md:text-sm font-black text-slate-950 uppercase tracking-widest flex items-center gap-1.5">
                      <FileSpreadsheet className="text-blue-600 animate-pulse" size={18} />
                      Classroom Assessments & Performance Record (CRUD)
                    </h3>
                    <span className="text-[9px] font-black text-slate-400 uppercase">Unit Weighted Average System</span>
                  </div>

                  <div className="border-[5px] border-slate-900 rounded-3xl overflow-hidden shadow-md">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-900 text-white border-b-2 border-slate-800">
                            <th className="px-4 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest border-r-2 border-slate-800 min-w-[140px]" rowSpan={2}>Subject Name / Barnoota</th>
                            <th className="px-4 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest border-r-2 border-slate-800 text-center" colSpan={3}>First Semester (Semisteera 1)</th>
                            <th className="px-4 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest border-r-2 border-slate-800 text-center" colSpan={3}>Second Semester (Semisteera 2)</th>
                            <th className="px-4 py-3 text-[10px] md:text-xs font-black uppercase tracking-widest text-center" colSpan={3}>Annual Summary</th>
                          </tr>
                          <tr className="bg-slate-800 text-slate-200 border-b-4 border-slate-900 text-[8px] md:text-[9px] uppercase font-black text-center">
                            <th className="px-2 py-2 border-r border-slate-705">Mid (30)</th>
                            <th className="px-2 py-2 border-r border-slate-705">Final (70)</th>
                            <th className="px-2 py-2 border-r-2 border-slate-800 bg-slate-900 text-yellow-400">Total (100)</th>
                            <th className="px-2 py-2 border-r border-slate-705">Mid (30)</th>
                            <th className="px-2 py-2 border-r border-slate-705">Final (70)</th>
                            <th className="px-2 py-2 border-r-2 border-slate-800 bg-slate-900 text-yellow-400">Total (100)</th>
                            <th className="px-2 py-2 border-r border-slate-705 bg-slate-950 text-white font-black text-xs">Average</th>
                            <th className="px-2 py-2 border-r border-slate-705">Grade</th>
                            <th className="px-2 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-300 bg-white">
                          {reportRowKeys.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-extrabold uppercase text-xs">
                                No classroom marks recorded yet for selected Grade level & Stream curriculum. Use the "Record Marks" form above or click "Auto-Fill" to populate beautiful mock assessments instantly!
                              </td>
                            </tr>
                          ) : (
                            reportRowKeys.map((subj) => {
                              const scores = subjectsReport[subj];
                              const grd = getGrade(scores.average);
                              const passed = scores.average >= 50;
                              const hasSubData = scores.t1_recorded || scores.t2_recorded;

                              return (
                                <tr key={subj} className="hover:bg-slate-50 font-bold text-slate-950 text-[11px] border-b border-slate-200">
                                  <td className="px-4 py-3 border-r-2 border-slate-900 font-black tracking-tight bg-slate-50/50">{subj}</td>
                                  
                                  {/* Semester 1 */}
                                  <td className="px-2 py-3 border-r border-slate-200 text-center text-slate-600 font-mono font-bold">{scores.t1_recorded ? scores.t1_mid : '-'}</td>
                                  <td className="px-2 py-3 border-r border-slate-200 text-center text-slate-600 font-mono font-bold">{scores.t1_recorded ? scores.t1_final : '-'}</td>
                                  <td className="px-2 py-3 border-r-2 border-slate-900 text-center font-black bg-slate-100 text-blue-900 font-mono">{scores.t1_recorded ? `${scores.t1_total}` : '-'}</td>
                                  
                                  {/* Semester 2 */}
                                  <td className="px-2 py-3 border-r border-slate-200 text-center text-slate-600 font-mono font-bold">{scores.t2_recorded ? scores.t2_mid : '-'}</td>
                                  <td className="px-2 py-3 border-r border-slate-200 text-center text-slate-600 font-mono font-bold">{scores.t2_recorded ? scores.t2_final : '-'}</td>
                                  <td className="px-2 py-3 border-r-2 border-slate-900 text-center font-black bg-slate-100 text-blue-900 font-mono">{scores.t2_recorded ? `${scores.t2_total}` : '-'}</td>
                                  
                                  {/* Yearly Average Summary */}
                                  <td className="px-2 py-3 border-r border-slate-200 text-center font-black bg-slate-950 text-white font-mono text-sm">{hasSubData ? `${scores.average}` : '-'}</td>
                                  <td className="px-2 py-3 border-r border-slate-200 text-center">
                                    {hasSubData ? (
                                      <span className={`px-2 py-0.5 text-[10px] rounded font-black block text-center ${
                                        scores.average >= 90 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                        scores.average >= 80 ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                                        scores.average >= 70 ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                        scores.average >= 60 ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                                        scores.average >= 50 ? 'bg-orange-100 text-orange-850 border border-orange-300' :
                                        'bg-rose-100 text-rose-800 border border-rose-300'
                                      }`}>{grd}</span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-2 py-3 text-right bg-slate-50/30">
                                    {hasSubData ? (
                                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider ${
                                        passed ? 'text-emerald-700' : 'text-rose-700'
                                      }`}>
                                        {passed ? 'PASS' : 'FAIL'}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* OVERALL TERM STATISTICS CARD BOX */}
                {subjectsWithActiveMarks > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[28px] border-4 border-slate-900 font-sans">
                    <div className="text-center p-3 bg-white rounded-2xl border-2 border-slate-900 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">CUMULATIVE AVERAGE</span>
                      <strong className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight">{cumulativeAverage}%</strong>
                    </div>

                    <div className="text-center p-3 bg-white rounded-2xl border-2 border-slate-900 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">COURSES PASSED</span>
                      <strong className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight">{passedSubjectsCount} <span className="text-slate-400 text-xs">/ {subjectsWithActiveMarks}</span></strong>
                    </div>

                    <div className="text-center p-3 bg-white rounded-2xl border-2 border-slate-900 space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">TOTAL SYLLABUS LIST</span>
                      <strong className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight">{totalPossibleSubjects} Subjects</strong>
                    </div>

                    <div className="text-center p-3 rounded-2xl border-2 border-slate-900 flex flex-col items-center justify-center space-y-0.5 shadow-sm text-white bg-slate-950">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OFFICIAL BOARD STATUS</span>
                      <span className={`text-xl font-black uppercase tracking-wider ${isCumulativePromoted ? 'text-green-400' : 'text-rose-400'}`}>
                        {isCumulativePromoted ? 'PROMOTED / DARBE' : 'RETAINED / KUFE'}
                      </span>
                    </div>
                  </div>
                )}

                {/* INTEGRATION WITH ONLINE EXAMS SYSTEM - REAL LATEST ATTEMPTS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                    <Award className="text-blue-600 animate-bounce" size={18} />
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-widest font-bold">
                      Live Portal Virtual Mock Attempts / Yaaliiwwan History
                    </h4>
                  </div>

                  {loadingAttempts ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold animate-pulse">Loading system activity...</div>
                  ) : attempts.length === 0 ? (
                    <div className="p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                      No online examination attempts / yaaliiwwan registered yet on the portal.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {attempts.map(att => {
                        const pct = att.totalPoints ? Math.round((att.score || 0) / att.totalPoints * 100) : 0;
                        return (
                          <div key={att.id} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-900 flex items-center justify-between">
                            <div>
                              <strong className="font-extrabold text-xs text-slate-900 block truncate max-w-[200px]">{att.examTitle || 'National Syllabus Practice'}</strong>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{att.examSubject || 'General Examination'}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-xs text-slate-900 block">{att.score}/{att.totalPoints} Pts</span>
                              <span className={`px-1.5 py-0.5 text-[8px] font-black text-white rounded uppercase tracking-wider ${
                                pct >= 50 ? 'bg-emerald-600' : 'bg-red-600'
                              }`}>{pct}% ({pct >= 50 ? 'Pass' : 'Fail'})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* OFFICIAL VALIDATION SIGNATURE FOOTER */}
                <div className="print-signature-area grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t-4 border-slate-900 text-center">
                  <div className="flex flex-col items-center justify-end space-y-2">
                    <div className="font-serif italic text-sm text-slate-800">Jemal Fano Haji</div>
                    <div className="w-48 h-0.5 bg-slate-900" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Coordinator & IT Director Signature</span>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-full border-4 border-double border-slate-900 flex items-center justify-center relative overflow-hidden text-[9px] font-black text-slate-900 bg-slate-50 select-none uppercase tracking-widest leading-tight text-center">
                      BIFTU BERI<br/>SECO. SCHOOL<br/>★ STAMP ★
                    </div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Institution Official Seal</span>
                  </div>

                  <div className="flex flex-col items-center justify-end space-y-2">
                    <div className="font-sans font-bold text-sm text-slate-800">Biftu Beri Principal</div>
                    <div className="w-48 h-0.5 bg-slate-900" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Office of the School Principal / Signature</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeSubTab === 'audit_logs' && isAdmin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <AuditLogsTab />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrintConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden" id="print-confirmation-dialog">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-[32px] border-4 border-slate-900 shadow-2xl p-8 max-w-md w-full space-y-6 overflow-hidden text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border-2 border-blue-101 shrink-0">
                  <Printer size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Confirm Print Action
                  </h3>
                  <p className="text-xs font-black text-slate-401 uppercase tracking-widest leading-none">
                    Mirkaneessi Printii
                  </p>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed pt-2">
                    Are you sure you want to open the system print dialog? This will format and layout the selected student report cards or blank mark sheets for physical printing or saving as a standard PDF file.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPrintConfirm(false);
                    setPendingPrintFn(null);
                  }}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer border border-slate-200"
                >
                  Cancel / Hambisi
                </button>
                <button
                  onClick={() => {
                    setShowPrintConfirm(false);
                    if (pendingPrintFn) {
                      if (isAdmin) {
                        createAuditLog(
                          'print_report',
                          'MarksAndReports',
                          selectedStudentId || undefined,
                          activeStudent ? (activeStudent.fullName || activeStudent.name) : 'Blank Marksheet / View'
                        );
                      }
                      pendingPrintFn();
                    }
                    setPendingPrintFn(null);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-150 shadow-md shadow-blue-500/20 hover:scale-105 cursor-pointer"
                >
                  Confirm & Print
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
