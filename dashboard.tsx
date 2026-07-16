import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError, auth, createAuditLog } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { Exam, ExamAttempt, StudentMark, Question } from '@/src/types';
import { 
  Plus, 
  BookOpen, 
  Clock, 
  Calendar, 
  ChevronRight, 
  ChevronDown,
  Settings, 
  LogOut,
  Target,
  Trophy,
  Activity,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  Globe,
  Lock,
  FileText,
  Archive,
  Download,
  Info,
  Bell,
  AlertCircle,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Award,
  Search,
  GraduationCap,
  Presentation,
  User,
  UserPlus,
  ShieldCheck,
  Mail,
  Monitor,
  Smartphone,
  Laptop,
  MousePointerClick,
  MoreVertical,
  Trash2,
  Send,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { formatDuration } from '@/src/lib/utils';
import About from './About';
import News from './News';
import UserManagement from './UserManagement';
import MarksAndReports from './MarksAndReports';
import StudentStats from './StudentStats';
import PerformanceDashboard from './PerformanceDashboard';
import { OnlineMonitor } from './OnlineMonitor';
import { SlideBuilder } from './SlideBuilder';
import { StudentCalendar } from './StudentCalendar';
import { PerformanceTrendChart } from './PerformanceTrendChart';
import { SubjectMastery } from './SubjectMastery';
import { SubjectHeatmap } from './SubjectHeatmap';
import { CountdownTimer } from './CountdownTimer';
import schoolLogo from '@/src/assets/images/bbs2_logo_1779651854520.png';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { SupplementaryClassScheduler } from './SupplementaryClassScheduler';
import RegistrationRequestsManager from './RegistrationRequestsManager';
import { generateQuestionsFromTopic } from '../services/aiService';
import { ALL_SUBJECTS, normalizeSubject } from '../constants';

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'exams' | 'users' | 'about' | 'news' | 'reports' | 'presentations' | 'sms' | 'online' | 'remedial' | 'requests' | 'feedback' | 'analytics'>('exams');
  const [initialUserView, setInitialUserView] = useState<'student' | 'staff'>('student');
  const [draftGrade, setDraftGrade] = useState<string | null>(null);
  const [dbSubjects, setDbSubjects] = useState<string[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [sendingSms, setSendingSms] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedingStatus, setSeedingStatus] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [allAttempts, setAllAttempts] = useState<ExamAttempt[]>([]);
  const [liveAttempts, setLiveAttempts] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [showQuickStats, setShowQuickStats] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- HEARTBEAT LOGIC FOR ONLINE PRESENCE ---
  useEffect(() => {
    if (!user || !profile) return;

    const updateHeartbeat = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
      } catch (e) {
        console.error("Heartbeat update failed:", e);
      }
    };

    // Initial update
    updateHeartbeat();

    // Set interval to update every 2 minutes
    const interval = setInterval(updateHeartbeat, 120 * 1000);
    
    return () => clearInterval(interval);
  }, [user, profile]);

  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  // Real-time online monitor for admins
  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(collection(db, 'users'), orderBy('lastSeen', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const activeThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const active = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(u => {
          const lastSeen = u.lastSeen?.toDate ? u.lastSeen.toDate() : (u.lastSeen ? new Date(u.lastSeen) : null);
          return lastSeen && lastSeen > activeThreshold;
        });
      setOnlineUsers(active);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        setLoading(true);
        
        // Fetch Total Students for stats
        if (profile.role === 'admin') {
          const studentQ = query(collection(db, 'users'), where('role', '==', 'student'));
          const studentSnapshot = await getDocs(studentQ);
          setTotalStudents(studentSnapshot.size);
        }
        let examSnapshot;
        if (profile.role === 'admin') {
          const examQ = query(collection(db, 'exams'));
          examSnapshot = await getDocs(examQ);
        } else {
          // Strictly filter by status AND student's own grade/stream if they are not admin
          // This ensures students only see what belongs to their specific academy class.
          const baseConstraints = [where('status', '==', 'published')];
          
          if (profile.grade && (profile.grade as any) !== 'all') {
            baseConstraints.push(where('grade', '==', profile.grade));
          }
          
          if (profile.stream && (profile.stream as any) !== 'all' && profile.stream !== 'general') {
            baseConstraints.push(where('stream', 'in', ['general', profile.stream]));
          }

          const examQ = query(
            collection(db, 'exams'),
            ...baseConstraints
          );
          examSnapshot = await getDocs(examQ);
        }
        
        let examList = examSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data
          } as Exam;
        });
        
        // Apply default client-side auto-selection in state instead of discarding data here
        // This ensures they load all exams and can use the grade/stream filters dynamically.

        examList.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        setExams(examList);

        // Fetch Recent Attempts
        let attemptQ;
        if (profile.role === 'admin' || profile.role === 'staff') {
          attemptQ = query(collection(db, 'attempts'));
        } else if (user) {
          attemptQ = query(
            collection(db, 'attempts'),
            where('userId', '==', user.uid)
          );
        }

        if (attemptQ) {
          const attemptSnapshot = await getDocs(attemptQ);
          const attemptList = attemptSnapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              ...data
            } as ExamAttempt;
          });

          setAllAttempts(attemptList);

          const sortedAttempts = [...attemptList].sort((a, b) => {
            const dateA = a.startedAt?.toDate?.() || new Date(0);
            const dateB = b.startedAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

          setAttempts(sortedAttempts.slice(0, 5));
        }
      } catch (error) {
        console.error("Dashboard Fetch Error:", error);
        // Don't crash the whole dashboard if one fetch fails, but show error if it's critical
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time live status for admins
    let unsubscribeLive: any;
    if (profile?.role === 'admin') {
      const liveQ = query(
        collection(db, 'attempts'),
        where('status', '==', 'ongoing')
      );
      // Filter only those active in the last 15 minutes
      unsubscribeLive = onSnapshot(liveQ, (snapshot) => {
        const liveList = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data
          } as any;
        }).filter(att => {
          const lastUpdate = att.updatedAt?.toDate?.() || new Date(0);
          return (new Date().getTime() - lastUpdate.getTime()) < 15 * 60 * 1000;
        });
        setLiveAttempts(liveList);
      });
    }

    return () => {
      if (unsubscribeLive) unsubscribeLive();
    };
  }, [profile, user]);

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStream, setFilterStream] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (profile) {
      if (profile.role !== 'admin') {
        if (profile.grade) {
          setFilterGrade(profile.grade);
        }
        if (profile.stream) {
          setFilterStream(profile.stream);
        }
      }
    }
  }, [profile]);

  // --- DYNAMIC SUBJECTS FETCH & AUTO SEED ---
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsSnap = await getDocs(collection(db, 'subjects'));
        if (subjectsSnap.empty) {
          // Automatic seeding of core subjects list dynamically
          const batch = writeBatch(db);
          ALL_SUBJECTS.forEach(subj => {
            const docRef = doc(collection(db, 'subjects'), subj.replace(/\s+/g, '_').toLowerCase());
            batch.set(docRef, { name: subj });
          });
          await batch.commit();
          setDbSubjects(ALL_SUBJECTS);
        } else {
          const loaded = subjectsSnap.docs.map(doc => doc.data().name as string);
          setDbSubjects(loaded.sort());
        }
      } catch (err) {
        console.error("Error fetching dynamic core course options:", err);
        setDbSubjects(ALL_SUBJECTS);
      }
    };
    fetchSubjects();
  }, []);

  // --- MOCK SMS CORRESPONDENCE AUDIT LIST LOGGER ---
  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) return;
    const qSms = query(collection(db, 'sms_logs'), orderBy('sentAt', 'desc'), limit(100));
    const unsubscribeSms = onSnapshot(qSms, (snap) => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSmsLogs(logs);
    });
    return () => unsubscribeSms();
  }, [profile]);

  // --- BACKGROUND OFFLINE STUDY/EXAM SYNC CONTROLLER ---
  useEffect(() => {
    if (!user || !profile) return;

    const syncPendingAttempts = async () => {
      const offlineQueue = JSON.parse(localStorage.getItem('offline_attempts_queue') || '[]');
      if (offlineQueue.length === 0) return;
      if (!navigator.onLine) return;

      console.log(`Connection online. Syncing ${offlineQueue.length} offline attempts...`);
      const updatedQueue = [...offlineQueue];
      let syncedCount = 0;

      for (let i = 0; i < offlineQueue.length; i++) {
        const item = offlineQueue[i];
        if (item.userId !== user.uid) continue; // Safety check

        try {
          // 1. Write the main attempt
          const attemptRef = doc(db, 'attempts', item.attemptId);
          await setDoc(attemptRef, {
            userId: item.userId,
            userName: item.userName,
            examId: item.examId,
            examTitle: item.examTitle,
            examSubject: item.examSubject,
            score: item.score,
            totalPoints: item.totalPoints,
            status: item.status,
            violations: item.violations,
            startedAt: serverTimestamp(),
            finishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isOfflineSynced: true
          });

          // 2. Write answers to subcollection
          const batch = writeBatch(db);
          item.questions.forEach((q: any) => {
            const selected = item.answers[q.id];
            const isCorrect = selected === q.correctOptionIndex;
            const answerRef = doc(collection(db, 'attempts', item.attemptId, 'answers'));
            batch.set(answerRef, {
              questionId: q.id,
              selectedOptionIndex: selected !== undefined ? selected : -1,
              isCorrect,
              answeredAt: serverTimestamp()
            });
          });

          // 3. Scale score write to permanent Marks
          try {
            const scaledScore = item.score;
            const markDocRef = doc(collection(db, 'marks'));
            batch.set(markDocRef, {
              studentId: item.userId,
              studentName: item.userName,
              studentSid: profile?.sid || 'Offline',
              subject: item.examSubject,
              term: 'term_1',
              assessmentType: item.examType === 'mid' ? 'mid_exam' : 'final_exam',
              score: scaledScore,
              totalPoints: item.totalPoints,
              recordedBy: 'offline_sync',
              recordedAt: serverTimestamp()
            });
          } catch (e) {
            console.error("Could not register mark:", e);
          }

          // 4. Send SMS to parent after the exam syncs successfully
          try {
            const cleanPhone = profile?.address || "+251 900 000000"; // Fallback simulated parent advisor line
            await addDoc(collection(db, 'sms_logs'), {
              recipientName: item.userName,
              parentPhone: cleanPhone,
              messageContent: `ALERT: Student ${item.userName} exam result on ${item.examSubject} recorded: Score Obtained ${item.score}/${item.totalPoints}. Standings status updated!`,
              sentAt: serverTimestamp(),
              deliveryStatus: 'DELIVERED',
              triggerEvent: 'EXAM_SUBMISSION_SYNC'
            });
          } catch (smsErr) {
            console.error("Mock parent SMS failure:", smsErr);
          }

          await batch.commit();

          // Remove item from copy of queue
          const idx = updatedQueue.findIndex(q => q.attemptId === item.attemptId);
          if (idx > -1) updatedQueue.splice(idx, 1);
          syncedCount++;
        } catch (err) {
          console.error("Failed to sync item:", item.attemptId, err);
        }
      }

      // Restore remaining failed entries back to queue
      localStorage.setItem('offline_attempts_queue', JSON.stringify(updatedQueue));

      if (syncedCount > 0) {
        alert(language === 'en' 
          ? `🎉 Sync complete! Successfully uploaded ${syncedCount} offline attempt(s) and logged parent advisor SMS.` 
          : `🎉 Synciin xumurameera! Yaaliin qormaataa ooflaayinii ${syncedCount} karaa weebsaayitiitti ol-olameera, SMS maatiis ergameera.`
        );
        window.location.reload();
      }
    };

    syncPendingAttempts();
    window.addEventListener('online', syncPendingAttempts);
    return () => window.removeEventListener('online', syncPendingAttempts);
  }, [user, profile, language]);
  
  // Combine dynamic subjects from exams and common subjects list
  const availableSubjects = Array.from(new Set([
    ...dbSubjects,
    ...exams.map(e => e.subject)
  ])).filter(Boolean).sort();

  const filteredExams = exams.filter(e => {
    const matchesSubject = filterSubject === 'all' || e.subject === filterSubject;
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchesStream = filterStream === 'all' || e.stream === filterStream;
    const matchesType = filterType === 'all' || (e.type || 'model') === filterType;
    const matchesGrade = filterGrade === 'all' || e.grade === filterGrade;
    const matchesSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesStatus && matchesStream && matchesType && matchesGrade && matchesSearch;
  });

  const stats = {
    totalExams: exams.length,
    totalStudents: totalStudents,
    published: exams.filter(e => e.status === 'published').length,
    drafts: exams.filter(e => e.status === 'draft').length,
    attempts: allAttempts.length,
    live: liveAttempts.length
  };

  const handleDownloadAdminGuide = () => {
    const guide = `
# BIFTU BERI EXAM SYSTEM: ADMIN SETUP GUIDE
==========================================

This guide outlines the steps to configure school computers for a safe and secure examination environment.

## 1. BROWSER LOCKDOWN (Safe Exam Setup)
To prevent students from switching tabs or searching for answers:
- We recommend using Chrome in "Kiosk Mode" or a dedicated "Student" profile.
- Disable keyboard shortcuts like Alt+Tab or Cmd+Tab if possible via system group policies.
- Disable Chrome's "Incognito" mode to ensure session tracking works correctly.

## 2. NETWORK REQUIREMENTS
Ensure your school network allows outgoing traffic to the following domains:
- firebase.googleapis.com
- firestore.googleapis.com
- identitytoolkit.googleapis.com
- firebasestorage.googleapis.com

## 3. CLIENT CONFIGURATION
1. Open the application URL in the browser.
2. Click the "Settings" icon (three dots) in Chrome.
3. Select "More Tools" > "Create Shortcut".
4. Check "Open as window" to give it a native app feel.
5. Place this shortcut on every student computer desktop.

## 4. ACCOUNT MANAGEMENT
- Admins can manage users via the "Users" tab in the dashboard.
- Always ensure "Role", "Grade", and "Stream" are correctly assigned.

## 5. INTEGRITY MONITORING
- The system automatically logs "Violations" if a student switches tabs or minimizes the browser.
- Admins can see these live in the "Live Status" panel.

For technical support: jemalfano030@gmail.com
Generated on: ${new Date().toLocaleDateString()}
    `;
    
    const blob = new Blob([guide], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "Biftu_Beri_Admin_Guide.md";
    link.click();
    URL.revokeObjectURL(url);
  };

  const isParent = false;
  
  // Calculate real performance data
  const chartData = React.useMemo(() => {
    if (allAttempts.length === 0) {
      return [
        { subject: 'Biology', score: 0 },
        { subject: 'Physics', score: 0 },
        { subject: 'Math', score: 0 },
        { subject: 'English', score: 0 },
        { subject: 'History', score: 0 },
      ];
    }

    const subjectPerformance = allAttempts.reduce((acc, attempt) => {
      // Find subject name. We might have it in the attempt itself or need to look up in exams
      const rawSubject = attempt.examSubject || exams.find(e => e.id === attempt.examId)?.subject || 'Others';
      const subjectName = normalizeSubject(rawSubject);
      
      if (!acc[subjectName]) {
        acc[subjectName] = { totalScore: 0, count: 0 };
      }
      
      const percentage = (attempt.score || 0) / (attempt.totalPoints || 1) * 100;
      acc[subjectName].totalScore += percentage;
      acc[subjectName].count += 1;
      return acc;
    }, {} as Record<string, { totalScore: number, count: number }>);

    return Object.entries(subjectPerformance).map(([subject, data]) => ({
      subject,
      score: Math.round(data.totalScore / data.count)
    })).sort((a, b) => b.score - a.score);
  }, [allAttempts, exams]);

  const gradePerformanceData = React.useMemo(() => {
    if (allAttempts.length === 0) {
      return [
        { gradeValue: '9', grade: 'Grade 9', score: 0 },
        { gradeValue: '10', grade: 'Grade 10', score: 0 },
        { gradeValue: '11', grade: 'Grade 11', score: 0 },
        { gradeValue: '12', grade: 'Grade 12', score: 0 },
      ];
    }

    const gradePerformance = allAttempts.reduce((acc, attempt) => {
      const exam = exams.find(e => e.id === attempt.examId);
      const grade = exam?.grade || 'Other';
      
      if (!acc[grade]) {
        acc[grade] = { totalScore: 0, count: 0 };
      }
      
      const percentage = (attempt.score || 0) / (attempt.totalPoints || 1) * 100;
      acc[grade].totalScore += percentage;
      acc[grade].count += 1;
      return acc;
    }, {} as Record<string, { totalScore: number, count: number }>);

    return ['9', '10', '11', '12'].map(grade => ({
      gradeValue: grade,
      grade: `Grade ${grade}`,
      score: gradePerformance[grade] ? Math.round(gradePerformance[grade].totalScore / gradePerformance[grade].count) : 0
    }));
  }, [allAttempts, exams]);

  const handleSeedData = async () => {
    if (!user) {
      alert('You must be logged in to seed data.');
      return;
    }
    
    const gradeInput = window.prompt('Maaloo, qorumsa kutaa meeqaa qopheessuu barbaaddu? (9, 10, 11 ykn 12 barreessi):', '12');
    if (!gradeInput) return;
    
    const selectedGrade = gradeInput.trim();
    if (!['9', '10', '11', '12'].includes(selectedGrade)) {
      alert('Kutaa sirrii galchi (9, 10, 11 ykn 12 qofa).');
      return;
    }

    const typeInput = window.prompt('Maaloo, gosa qorumsaa filadhu:\n1 - EAES Mid-Term Prep (Qormaata Gidduu - Gaaffilee 5)\n2 - Model Exam (Qormaata Mude - Gaaffilee 10)\n3 - Final Exam (Qormaata Xumuraa - Gaaffilee 10)\n4 - National Preparation Mock Exam (Qormaata Biyyoolessaa EAES - Gaaffilee 5 - Daqiiqaa 120)\n(Lakkoofsa 1, 2, 3 ykn 4 barreessi):', '1');
    if (!typeInput) return;

    let examType: 'mid' | 'model' | 'final' | 'eaes_mock' = 'mid';
    let questionCountToGenerate = 5;
    let typeLabel = 'EAES Mid-Term Preparation';
    let durationMinutesToSet = 45;

    if (typeInput.trim() === '2') {
      examType = 'model';
      questionCountToGenerate = 10;
      typeLabel = 'Model Exam';
    } else if (typeInput.trim() === '3') {
      examType = 'final';
      questionCountToGenerate = 10;
      typeLabel = 'Final Exam';
    } else if (typeInput.trim() === '4') {
      examType = 'eaes_mock';
      questionCountToGenerate = 5;
      typeLabel = 'National Preparation Exam Mock';
      durationMinutesToSet = 120;
    }

    if (!confirm(`Maaloo: Qorumsa AI ${typeLabel} kan Kutaa ${selectedGrade} qopheessuuf qophiidhaa? Barnoota hundaaf gaaffilee ${questionCountToGenerate} ni qopheessaa.`)) return;
    
    setSeeding(true);
    setSeedingStatus('Qopheessaa jirra...');
    
    try {
      // Create subjects dynamically based on the selected grade
      let subjectsToSeed: { name: string, stream: 'natural' | 'social' | 'general' }[] = [];
      
      if (selectedGrade === '9' || selectedGrade === '10') {
        subjectsToSeed = [
          { name: 'Biology', stream: 'general' },
          { name: 'Physics', stream: 'general' },
          { name: 'Chemistry', stream: 'general' },
          { name: 'Mathematics', stream: 'general' },
          { name: 'History', stream: 'general' },
          { name: 'Geography', stream: 'general' },
          { name: 'Economics', stream: 'general' },
          { name: 'English', stream: 'general' },
          { name: 'Civics', stream: 'general' }
        ];
      } else if (selectedGrade === '11') {
        subjectsToSeed = [
          { name: 'Biology', stream: 'natural' },
          { name: 'Physics', stream: 'natural' },
          { name: 'Chemistry', stream: 'natural' },
          { name: 'Mathematics (Natural)', stream: 'natural' },
          { name: 'History', stream: 'social' },
          { name: 'Geography', stream: 'social' },
          { name: 'Economics', stream: 'social' },
          { name: 'Mathematics (Social)', stream: 'social' },
          { name: 'English', stream: 'general' },
          { name: 'Civics', stream: 'general' }
        ];
      } else {
        // Grade 12 default
        subjectsToSeed = [
          { name: 'Biology', stream: 'natural' },
          { name: 'Physics', stream: 'natural' },
          { name: 'Chemistry', stream: 'natural' },
          { name: 'Mathematics (Natural)', stream: 'natural' },
          { name: 'History', stream: 'social' },
          { name: 'Geography', stream: 'social' },
          { name: 'Economics', stream: 'social' },
          { name: 'Mathematics (Social)', stream: 'social' },
          { name: 'English', stream: 'general' },
          { name: 'Civics', stream: 'general' },
          { name: 'Scholastic Aptitude', stream: 'general' }
        ];
      }

      for (let i = 0; i < subjectsToSeed.length; i++) {
        const sub = subjectsToSeed[i];
        setSeedingStatus(`${i + 1}/${subjectsToSeed.length}: AI-tiin ${sub.name} (Kutaa ${selectedGrade}) qopheessaa jirra...`);
        
        let questions: any[] = [];
        try {
          questions = await generateQuestionsFromTopic(
            `Ethiopian Grade ${selectedGrade} ${sub.name} Curriculum ${typeLabel} Essentials`, 
            questionCountToGenerate, 
            sub.name, 
            selectedGrade
          );
          
          if (!questions || !Array.isArray(questions) || questions.length === 0) {
            console.warn(`No valid questions returned for ${sub.name}`);
            continue;
          }
        } catch (aiErr) {
          console.error(`AI generation failed for ${sub.name}:`, aiErr);
          setSeedingStatus(`⚠️ AI-n ${sub.name} qopheessuu dadhabe. Itti fufa...`);
          continue; 
        }

        // Random distribution of exam dates for calendar demonstration
        const randomDays = Math.floor(Math.random() * 15) + 1;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + randomDays);

        const examData = {
          title: `Grade ${selectedGrade} ${sub.name} ${examType === 'mid' ? 'EAES Mid-Term Prep' : examType === 'eaes_mock' ? 'EAES National Mock' : examType === 'final' ? 'Final Exam' : 'Mock Final'}`,
          subject: sub.name,
          grade: selectedGrade,
          stream: sub.stream,
          type: examType,
          durationMinutes: examType === 'eaes_mock' ? 120 : (sub.name.includes('Mathematics') ? 45 : 30),
          status: 'published',
          dueDate: futureDate,
          creatorId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          description: `${typeLabel} for Grade ${selectedGrade} ${sub.name} students. AI-generated based on curriculum.`
        };

        const examRef = await addDoc(collection(db, 'exams'), examData);

        const savePromises = questions.map((q, j) => 
          addDoc(collection(db, 'exams', examRef.id, 'questions'), {
            text: q.text || 'Question text missing',
            options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
            correctOptionIndex: q.correctOptionIndex ?? 0,
            explanation: q.explanation || '',
            points: q.points || 1,
            orderIndex: j,
            type: 'multiple-choice'
          })
        );
        
        await Promise.all(savePromises);
      }

      setSeedingStatus('Hojjechuun xumurameera!');
      alert(`Milkaa'ina! Qorumstoonni ${typeLabel} Kutaa ${selectedGrade} guutummaatti qophaa'aniiru.`);
      window.location.reload();
    } catch (err) {
      console.error('Seeding Error:', err);
      alert(`Do it again later or check connection.`);
    } finally {
      setSeeding(false);
      setSeedingStatus('');
    }
  };

  const pieChartData = React.useMemo(() => {
    return chartData.slice(0, 5).map(item => ({
      name: item.subject,
      value: item.score
    }));
  }, [chartData]);

  const gradeLevelAnalytics = React.useMemo(() => {
    const grades = ['9', '10', '11', '12'];
    
    return grades.map(grade => {
      const gradeAttempts = allAttempts.filter(attempt => {
        const exam = exams.find(e => e.id === attempt.examId);
        return exam?.grade === grade;
      });
      
      const count = gradeAttempts.length;
      let avgScore = 0;
      let passRate = 0;
      let passedCount = 0;
      
      if (count > 0) {
        const totalPct = gradeAttempts.reduce((sum, att) => {
          const pct = (att.score || 0) / (att.totalPoints || 1) * 100;
          if (pct >= 50) passedCount++;
          return sum + pct;
        }, 0);
        avgScore = Math.round(totalPct / count);
        passRate = Math.round((passedCount / count) * 100);
      }
      
      // Determine academic support requirement
      let supportLevel = {
        label: "Stable / Tasgabbaa'aa",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        desc: "Academic standards are met. Continue routine progress."
      };
      
      if (count === 0) {
        supportLevel = {
          label: "No Data / Ragaan Hin Jiru",
          color: "text-slate-500",
          bg: "bg-slate-50",
          border: "border-slate-200",
          desc: "No examination records submitted yet for this grade."
        };
      } else if (avgScore < 50 || passRate < 45) {
        supportLevel = {
          label: "Critical / Deeggarsa Guddaa 🚨",
          color: "text-red-700",
          bg: "bg-red-50",
          border: "border-red-200",
          desc: "Requires immediate supplementary classes and model mocks."
        };
      } else if (avgScore < 65 || passRate < 60) {
        supportLevel = {
          label: "Moderate / Deggarsa Giddu-galeessaa ⚠️",
          color: "text-amber-700",
          bg: "bg-amber-50",
          border: "border-amber-200",
          desc: "Needs reinforcement in key topics to elevate average mastery."
        };
      }
      
      return {
        grade,
        count,
        avgScore,
        passRate,
        supportLevel
      };
    });
  }, [allAttempts, exams]);

  // --- BRAND NEW COMPONENT: SYSTEM SUPPORT DIAGNOSTICIAN ---
  function SystemSupportDiagnostician() {
    return (
      <div className="bg-slate-900 rounded-[40px] border-4 border-slate-800 shadow-2xl p-8 space-y-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[120px] opacity-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Activity className="text-blue-500" size={28} />
              Analytics & Support Diagnostician
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Aggregated continuous assessment & mock performance support directory
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-2xl border border-slate-700">
            <Monitor size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">System Operational</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {gradeLevelAnalytics.map((item) => (
            <motion.div 
              key={item.grade}
              whileHover={{ y: -5 }}
              className={`p-6 rounded-[32px] border-2 ${item.supportLevel.border} ${item.supportLevel.bg} space-y-4`}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Level Sector</span>
                  <h4 className="text-xl font-black text-slate-900 uppercase">Grade {item.grade}</h4>
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight block">Kutaa {item.grade}</span>
                </div>
                <div className="px-2 py-1 bg-white/50 rounded-lg text-[9px] font-black text-slate-900 border border-slate-200">
                  {item.count} attempts / yaaliiwwan
                </div>
              </div>

              <div className="space-y-2">
                <div className={`px-3 py-1.5 rounded-xl border ${item.supportLevel.border} text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-2 bg-white/80`}>
                  {item.supportLevel.label}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/60 p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Avg Score:</span>
                  <span className={`text-lg font-black ${item.avgScore < 50 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {item.avgScore}%
                  </span>
                </div>
                <div className="bg-white/60 p-3 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Pass Rate:</span>
                  <span className="text-lg font-black text-slate-900">
                    {item.passRate}%
                  </span>
                </div>
              </div>

              <p className="text-[9px] font-bold text-slate-600 leading-normal uppercase">
                {item.supportLevel.desc}
              </p>

              <button 
                onClick={() => {
                  setDraftGrade(item.grade);
                  setActiveTab('remedial');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Sparkles size={12} className="text-purple-400" />
                Schedule Remedial
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  const PIE_COLORS = ['#2563EB', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

  return (
    <div className="min-h-screen bg-[#f1f6fc] relative">
        {/* Immersive BBS2 Branded Background Layer */}
        <div 
          className="fixed inset-0 z-0 opacity-[0.07] pointer-events-none overflow-hidden flex items-center justify-center p-4 md:p-20"
        >
          <img 
            src={schoolLogo} 
            alt="" 
            className="w-full h-full max-w-[800px] max-h-[800px] object-contain filter blur-[40px] scale-150 transform-gpu"
            referrerPolicy="no-referrer"
          />
        </div>

        <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center">
          {/* 1. HOME / LOGO */}
          <div 
            onClick={() => setActiveTab('exams')}
            className="flex items-center gap-3 font-bold text-lg text-slate-900 border-r border-slate-100 pr-6 mr-4 h-10 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
          >
            <img 
              src={schoolLogo} 
              alt="Biftu Beri Logo" 
              className="w-8 h-8 object-contain rounded-lg shadow-sm"
              referrerPolicy="no-referrer"
            />
            <span className="bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent font-black uppercase tracking-tight hidden md:inline">HOME</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 py-1">
            {/* 2. EXAM */}
            <button 
              onClick={() => setActiveTab('exams')}
              className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'exams' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Target size={16} />
              {t('nav.exams')}
            </button>

            {/* 3. LIVE (Online Sync) */}
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('online')}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'online' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Activity size={16} className="animate-pulse text-emerald-400" />
                Live
              </button>
            )}

            {/* 4. USERS */}
            {profile?.role === 'admin' && (
              <div className="relative group/users">
                <button 
                  onClick={() => {
                    setActiveTab('users');
                    setInitialUserView('student');
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                    activeTab === 'users' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Users size={16} />
                  Users
                  <ChevronDown size={14} className="opacity-60" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 hidden group-hover/users:block z-50">
                  <button onClick={() => { setActiveTab('users'); setInitialUserView('student'); }} className="w-full text-left px-5 py-3 text-xs font-black text-slate-700 hover:text-blue-600 hover:bg-blue-50 uppercase tracking-widest">Students</button>
                  <button onClick={() => { setActiveTab('users'); setInitialUserView('staff'); }} className="w-full text-left px-5 py-3 text-xs font-black text-slate-700 hover:text-blue-600 hover:bg-blue-50 uppercase tracking-widest">Staff</button>
                </div>
              </div>
            )}

            {/* REQUESTS */}
            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <button 
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'requests' 
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserPlus size={16} />
                {t('nav.requests')}
              </button>
            )}

            {/* 5. REPORTS */}
            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <button 
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'reports' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText size={16} />
                Reports
              </button>
            )}

            {/* 6. SMS & SUBJECTS */}
            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <button 
                onClick={() => setActiveTab('sms')}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'sms' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Smartphone size={16} />
                SMS
              </button>
            )}

            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <button 
                onClick={() => setActiveTab('remedial')}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'remedial' 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles size={16} className="text-purple-400" />
                {t('nav.remedial')}
              </button>
            )}

            {/* FEEDBACK & CHAT */}
            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <button 
                onClick={() => setActiveTab('feedback')}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'feedback' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MessageSquare size={16} />
                Feedback & Chat
              </button>
            )}

            {/* ANALYTICS DIAGNOSTICS */}
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'analytics' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity size={16} className={activeTab === 'analytics' ? 'animate-pulse' : ''} />
              {language === 'om' ? 'Gahumsa' : 'Analytics'}
            </button>

            {/* 7. NEWS */}
            <button 
              onClick={() => setActiveTab('news')}
              className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'news' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell size={16} />
              News
            </button>

            {/* 8. ABOUT */}
            <button 
              onClick={() => setActiveTab('about')}
              className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'about' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Info size={16} />
              About
            </button>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'om' : 'en')}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title={language === 'en' ? 'Switch to Afan Oromo' : 'Gara Ingiliffaatti Jijjiiri'}
            >
              <Globe size={16} />
            </button>
            
            <div className="hidden lg:flex flex-col items-end mr-2 px-3 border-l border-slate-100">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{profile?.fullName || profile?.name}</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{profile?.role}</span>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-rose-100"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 py-8 space-y-12">
        {activeTab === 'users' ? (
          <UserManagement initialView={initialUserView} />
        ) : activeTab === 'requests' ? (
          <RegistrationRequestsManager />
        ) : activeTab === 'analytics' ? (
          <PerformanceDashboard 
            attempts={allAttempts} 
            role={profile?.role} 
            userName={profile?.fullName || profile?.name}
            grade={profile?.grade}
            stream={profile?.stream}
          />
        ) : activeTab === 'remedial' ? (
          <SupplementaryClassScheduler 
            exams={exams} 
            allAttempts={allAttempts} 
            initialGrade={draftGrade || undefined}
          />
        ) : activeTab === 'online' && profile?.role === 'admin' ? (
          <OnlineMonitor />
        ) : activeTab === 'feedback' && (profile?.role === 'admin' || profile?.role === 'staff') ? (
          <FeedbackAndChatPanel />
        ) : activeTab === 'about' ? (
          <About />
        ) : activeTab === 'news' ? (
          <News />
        ) : (activeTab === 'reports' && (profile?.role === 'admin' || profile?.role === 'staff')) ? (
          <MarksAndReports />
        ) : (activeTab === 'sms' && (profile?.role === 'admin' || profile?.role === 'staff')) ? (
          <SmsAndSubjectsPanel />
        ) : activeTab === 'presentations' ? (
          <SlideBuilder />
        ) : (
          <>
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
               {/* ONLINE PARTICIPANTS MONITOR (Admin ONLY) */}
               {profile?.role === 'admin' && onlineUsers.length > 0 && (
                 <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
                   <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-2xl">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-[9px] font-black text-white uppercase tracking-widest">
                       {onlineUsers.length} Online Now
                     </span>
                   </div>
                   <div className="flex -space-x-2 overflow-hidden items-center group cursor-help">
                     {onlineUsers.slice(0, 5).map((u, i) => (
                       <div key={u.id} className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[8px] font-black text-white uppercase shadow-sm" title={u.fullName}>
                         {(u.fullName || 'U')[0]}
                       </div>
                     ))}
                     {onlineUsers.length > 5 && (
                       <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center text-[7px] font-black text-white uppercase">
                         +{onlineUsers.length - 5}
                       </div>
                     )}
                   </div>
                 </div>
               )}

               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-10 -mr-32 -mt-32 opacity-60" />
               
               <div className="flex flex-col md:flex-row items-center gap-8 relative z-10 w-full lg:w-auto">
                 <motion.div 
                   whileHover={{ scale: 1.05, rotate: 2 }}
                   className="shrink-0"
                 >
                   <img 
                     src={schoolLogo} 
                     alt="School Logo" 
                     className="w-40 h-40 md:w-48 md:h-48 object-contain rounded-[32px] shadow-2xl border-4 border-slate-50"
                     referrerPolicy="no-referrer"
                   />
                 </motion.div>
                 
                 <div className="space-y-3 text-center md:text-left">
                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                     <Sparkles size={12} />
                     Officially Developed Platform
                   </div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none uppercase mb-2">
                {profile?.role === 'admin' ? t('nav.admin') : profile?.role === 'staff' ? 'Staff Portal' : `Welcome, ${(profile?.fullName || profile?.name || 'Student').split(' ')[0]}`}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                  <User size={14} className="text-blue-600" />
                  <span className="text-xs font-extrabold text-blue-600 uppercase tracking-widest">Dev: Jemal Fano Haji</span>
                </div>
                {(profile?.role === 'admin' || profile?.role === 'staff') && (
                  <Link 
                    to="/admin/exams/new"
                    className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-white rounded-2xl border border-slate-900 shadow-sm hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <Plus size={14} className="text-blue-400" />
                    {profile?.role === 'staff' ? 'Create Exam Account' : 'New Examination'}
                  </Link>
                )}
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Biftu Beri Secondary</span>
                </div>
              </div>
            </div>
          </div>

               <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 shrink-0 relative z-10">
                {(profile?.role === 'admin' || profile?.role === 'staff') && (
                  <>
                    <button 
                      onClick={() => setShowQuickStats(!showQuickStats)}
                      className={`px-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 ${showQuickStats ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                    >
                      {showQuickStats ? <EyeOff size={18} /> : <Eye size={18} />}
                      {showQuickStats ? 'Hide Stats' : 'Show Stats'}
                    </button>
                    <button 
                      onClick={handleSeedData}
                      disabled={seeding}
                      className="px-6 py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-all shadow-xl shadow-purple-100 flex items-center gap-2 min-w-[160px] justify-center"
                    >
                      {seeding ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={18} />}
                      {seeding ? seedingStatus || 'Qopheessaa jirra...' : 'Qorumsa AI-tiin Qopheessi'}
                    </button>
                    <Link 
                      to="/admin/exams/new"
                      className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center gap-2"
                    >
                      <Plus size={20} />
                      {t('admin.createExam')}
                    </Link>
                  </>
                )}
              </div>
            </header>

            {/* SYSTEM SUPPORT DIAGNOSTICIAN (Admin ONLY) */}
            {profile?.role === 'admin' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-1000">
                <SystemSupportDiagnostician />
              </div>
            )}

            <AnimatePresence>
              {showQuickStats && (profile?.role === 'admin' || profile?.role === 'staff') && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-200 flex flex-col justify-between h-32">
                       <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Total Registered Students</span>
                       <div className="flex items-end justify-between">
                         <span className="text-4xl font-black">{totalStudents || 0}</span>
                         <Users size={32} className="opacity-30" />
                       </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 rounded-3xl text-white shadow-xl shadow-purple-200 flex flex-col justify-between h-32">
                       <span className="text-[10px] font-black uppercase tracking-widest text-purple-100">Exams Conducted</span>
                       <div className="flex items-end justify-between">
                         <span className="text-4xl font-black">{allAttempts.length || 0}</span>
                         <BookOpen size={32} className="opacity-30" />
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Published Exams</span>
                       <div className="flex items-end justify-between">
                         <span className="text-4xl font-black text-slate-900">{exams.filter(e => e.status === 'published').length}</span>
                         <Activity size={32} className="text-emerald-500 opacity-20" />
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Online Now</span>
                       <div className="flex items-end justify-between">
                         <span className="text-4xl font-black text-emerald-600">{liveAttempts.length}</span>
                         <div className="w-8 h-8 rounded-full bg-emerald-500 animate-pulse opacity-40 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              <div className="lg:col-span-3 space-y-8">
                {(profile?.role === 'admin' || profile?.role === 'staff' || isParent) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                     <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('admin.analytics')}</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isParent ? t('parent.childPerformance') : "Performance by Subject"}</p>
                           </div>
                           <Activity size={24} className="text-blue-600" />
                        </div>
                        <div className="h-64 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                 <XAxis 
                                   dataKey="subject" 
                                   axisLine={false} 
                                   tickLine={false} 
                                   tick={{ fontSize: 10, fontWeight: 'bold' }} 
                                 />
                                 <YAxis hide domain={[0, 100]} />
                                 <Tooltip 
                                   cursor={{ fill: '#F1F5F9' }}
                                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                 />
                                 <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={24}>
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2563EB' : '#8B5CF6'} />
                                    ))}
                                 </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Grade Level Mastery</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Score % per Grade</p>
                           </div>
                           <GraduationCap size={24} className="text-indigo-600" />
                        </div>
                        <div className="h-64 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={gradePerformanceData}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                 <XAxis 
                                   dataKey="gradeValue" 
                                   axisLine={false} 
                                   tickLine={false} 
                                   tick={{ fontSize: 10, fontWeight: 'bold' }} 
                                 />
                                 <YAxis hide domain={[0, 100]} />
                                 <Tooltip 
                                   cursor={{ fill: '#F1F5F9' }}
                                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                   formatter={(value: any) => [`${value}%`, 'Average Score']}
                                 />
                                 <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={32}>
                                    {gradePerformanceData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'][index % 4]} />
                                    ))}
                                 </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Subject Excellence</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top 5 Performing Departments</p>
                           </div>
                           <Trophy size={24} className="text-amber-500" />
                        </div>
                        <div className="h-64 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                 <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                 >
                                    {pieChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                 </Pie>
                                 <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`${value}%`, 'Score']}
                                 />
                                 <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    content={({ payload }) => (
                                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
                                        {payload?.map((entry: any, index: number) => (
                                          <div key={`item-${index}`} className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{entry.name || entry.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                 />
                              </PieChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 md:col-span-2 xl:col-span-1">
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t('admin.liveStatus')}</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ongoing Examinations</p>
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{liveAttempts.length} Active</span>
                           </div>
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-64 pr-2">
                           {liveAttempts.length === 0 ? (
                             <div className="h-48 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <Activity size={32} className="text-slate-300 mb-2" />
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Active Sessions</p>
                             </div>
                           ) : (
                             liveAttempts.map(att => (
                               <div key={att.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">
                                        {att.userName?.charAt(0)}
                                     </div>
                                     <div>
                                        <p className="text-sm font-bold text-slate-900">{att.userName}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{att.examTitle}</p>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                        <Clock size={10} />
                                        Just now
                                     </p>
                                     {att.violations > 0 && (
                                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Warning: {att.violations} Violations</p>
                                     )}
                                  </div>
                               </div>
                             ))
                           )}
                        </div>
                     </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Activity size={20} className="text-blue-600" />
                      {profile?.role === 'admin' ? 'All Examinations' : 'Available for You'}
                    </h2>
                    
                    <div className="flex items-center gap-2">
                       <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                         {filteredExams.length} {filteredExams.length === 1 ? 'Exam' : 'Exams'} Found
                       </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
                      <Search size={16} className="text-slate-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Search Exams</p>
                        <input 
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search exam by title..."
                          className="w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 text-sm p-0 h-auto outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
                      <BookOpen size={16} className="text-slate-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Subject</p>
                        <select 
                          value={filterSubject}
                          onChange={(e) => setFilterSubject(e.target.value)}
                          className="w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer text-sm p-0 h-auto"
                        >
                          <option value="all">All Subjects</option>
                          {availableSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
                      <Activity size={16} className="text-slate-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                        <select 
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer text-sm p-0 h-auto"
                        >
                          <option value="all">All Status / Haala Hundaa</option>
                          <option value="draft">Draft / Duroo (Kan qophaawaa jiru)</option>
                          <option value="published">Published / Kan Maxxanfame</option>
                          <option value="archived">Archived / Kuusame (Cufamaa)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
                      <Globe size={16} className="text-slate-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Stream / Department</p>
                        <select 
                          value={filterStream}
                          onChange={(e) => setFilterStream(e.target.value)}
                          className="w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer text-sm p-0 h-auto"
                        >
                          <option value="all">All Streams</option>
                          <option value="general">General (9-10)</option>
                          <option value="natural">Natural Science (11-12)</option>
                          <option value="social">Social Science (11-12)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
                      <FileText size={16} className="text-slate-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Exam Type</p>
                        <select 
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer text-sm p-0 h-auto"
                        >
                          <option value="all">All Types</option>
                          <option value="mid">Mid Exam / Qormaata Gidduu</option>
                          <option value="model">Model Exam</option>
                          <option value="final">Final Exam</option>
                          <option value="eaes_mock">EAES Mock Exam</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 min-w-[200px]">
                      <GraduationCap size={16} className="text-slate-400" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Grade Level</p>
                        <select 
                          value={filterGrade}
                          onChange={(e) => setFilterGrade(e.target.value)}
                          className="w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 cursor-pointer text-sm p-0 h-auto"
                        >
                          <option value="all">All Grades</option>
                          <option value="9">Grade 9</option>
                          <option value="10">Grade 10</option>
                          <option value="11">Grade 11</option>
                          <option value="12">Grade 12</option>
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setFilterSubject('all');
                        setFilterStatus('all');
                        setFilterStream('all');
                        setFilterType('all');
                        setFilterGrade(profile?.grade || 'all');
                        setSearchQuery('');
                      }}
                      className="px-4 py-3 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Clear Filters"
                    >
                      <LogOut size={18} className="rotate-90" />
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 4].map(i => (
                      <div key={i} className="h-64 bg-white rounded-3xl animate-pulse border border-slate-100 shadow-sm" />
                    ))}
                  </div>
                ) : filteredExams.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Target size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {filterSubject === 'all' ? 'No exams found' : `No ${filterSubject} exams found`}
                    </h3>
                    <p className="text-slate-500 max-w-sm mx-auto">
                      {exams.length === 0 
                        ? 'New examinations will be published soon for your grade and stream. Please check back later.' 
                        : 'No exams match your current filters. Try selecting a different subject or status.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {filteredExams.map((exam) => (
                       <ExamCard key={exam.id} exam={exam} role={profile?.role} attempts={allAttempts} />
                     ))}
                  </div>
                )}

                {profile?.role === 'student' && (
                  <div className="pt-8 border-t border-slate-200 space-y-8">
                    {/* EAES MOCK COUNTDOWN */}
                    <CountdownTimer exams={exams} />

                    {/* STUDENT CALENDAR WIDGET */}
                    <StudentCalendar exams={exams} />

                    {/* SUBJECT MASTERY HEATMAP (D3.js) */}
                    <SubjectHeatmap attempts={allAttempts} />

                    {/* SUBJECT MASTERY DIAGNOSTICS */}
                    <SubjectMastery attempts={allAttempts} />

                    {/* NEW: STUDENT STATS PERFORMANCE ENGINE */}
                    <StudentStats />

                    {/* STUDENT PERFORMANCE TRENDS */}
                    <PerformanceTrendChart attempts={allAttempts} />

                    {/* STUDENT COMPARATIVE ANALYTICS GATEWAY */}
                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                      <div className="mb-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-150 inline-block mb-2 font-bold whitespace-nowrap">
                          Interactive Academic Diagnostics
                        </span>
                        <h4 className="text-xl font-black text-slate-900 uppercase">My Analytics & Study Targets Dashboard</h4>
                        <p className="text-xs text-slate-500 font-bold uppercase col-span-2">Identify weak target subjects and evaluate scores relative to school averages</p>
                      </div>
                      <StudentComparativeAnalytics uid={user?.uid || ""} grade={profile?.grade} stream={profile?.stream} />
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6 animate-fade-in">
                      <div className="mb-4">
                        <h4 className="text-xl font-black text-slate-900 uppercase">My Official Report Card / Gabaasa Qabxii Kiyya</h4>
                        <p className="text-xs text-slate-500 font-bold uppercase col-span-2">All continuous assessments and official results recorded in system</p>
                      </div>
                      <MarksAndReports />
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-8">
                {(profile?.role === 'student' || isParent) && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                      <Trophy size={18} className="text-amber-500" />
                      <h3 className="font-bold text-slate-900">{t('dashboard.recentResults')}</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {attempts.length === 0 ? (
                        <div className="py-8 text-center px-4">
                          <p className="text-sm text-slate-400 font-medium italic">{t('dashboard.noResults')}</p>
                        </div>
                      ) : (
                        attempts.map(attempt => (
                          <div 
                            key={attempt.id}
                            className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100 group space-y-3"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {format(attempt.startedAt?.toDate?.() || new Date(), 'MMM dd, h:mm a')}
                              </span>
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                (attempt.score || 0) / (attempt.totalPoints || 1) >= 0.5 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-650'
                              }`}>
                                {attempt.score}/{attempt.totalPoints}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-850 line-clamp-1 group-hover:text-blue-700 transition-colors">
                              {exams.find(e => e.id === attempt.examId)?.title || 'Exam Completed'}
                            </h4>
                            <div className="flex gap-2">
                              <Link 
                                to={`/results/${attempt.id}`}
                                className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
                              >
                                {t('nav.results')}
                              </Link>
                              <button 
                                onClick={() => navigate(`/exam/${attempt.examId}/review/${attempt.id}`)}
                                className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-2"
                              >
                                <Eye size={12} />
                                {t('results.detailedReview')}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {(profile?.role === 'admin' || profile?.role === 'staff') && (
                  <>
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-8 shadow-xl space-y-6 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                         <Info size={120} className="rotate-12" />
                      </div>
                      <div className="relative z-10 space-y-4">
                        <h3 className="font-black text-xl uppercase tracking-tight text-white">Admin Resources</h3>
                        <p className="text-sm text-blue-100">Configure school browsers and manage local network settings for secure exams.</p>
                        
                        <button 
                          onClick={handleDownloadAdminGuide}
                          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/40"
                        >
                          <Download size={18} />
                          Download Admin Guide
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Quick Tips</h3>
                      <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
                        <li className="flex gap-3">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                          <p>Draft exams are only visible to admins.</p>
                        </li>
                        <li className="flex gap-3">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0" />
                          <p>Switch to "Published" to make exams live for students.</p>
                        </li>
                      </ul>
                    </div>
                  </>
                )}
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Dynamic Ethiopian Branded Footer */}
      <footer className="max-w-[1600px] mx-auto px-6 py-2 mb-12">
        <div className="bg-white rounded-[32px] border-2 border-slate-200 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
          {/* Subtle logo alignment watermark */}
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] select-none pointer-events-none">
            <img src={schoolLogo} alt="" className="w-48 h-48 object-contain" referrerPolicy="no-referrer" />
          </div>

          <div className="space-y-2 text-center md:text-left z-10">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">
              Biftu Beri Secondary School Portal
            </h4>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
              Empowering academic excellence in Oromia high school classrooms.
            </p>
          </div>

          {/* Ethiopian Flag Colored Text Elements with dark pill backgrounds for supreme contrast */}
          <div className="flex flex-wrap items-center justify-center gap-3 z-10">
            <div className="flex items-center gap-1 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-[#078930] shrink-0 animate-pulse" />
              <span className="text-[#078930] font-black text-[10px] uppercase tracking-widest px-1">
                Hope & Prosperity
              </span>
              <span className="text-slate-700 font-black text-[10px] mx-1">|</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#FCD116] shrink-0 animate-pulse" />
              <span className="text-[#FCD116] font-black text-[10px] uppercase tracking-widest px-1">
                Harmony & Justice
              </span>
              <span className="text-slate-700 font-black text-[10px] mx-1">|</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#DA121A] shrink-0 animate-pulse" />
              <span className="text-[#DA121A] font-black text-[10px] uppercase tracking-widest px-1">
                Valor & Resilience
              </span>
            </div>

            <div className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <span className="text-[14px] leading-none">🇪🇹</span>
              <span>Ethiopian Pride</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Draggable Quick Stats Widget for Admins/Staff */}
      {(profile?.role === 'admin' || profile?.role === 'staff') && (
        <AnimatePresence>
          {showQuickStats && (
            <motion.div
              drag
              dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 100 }}
              className="fixed bottom-8 left-8 z-[100] w-72 cursor-grab active:cursor-grabbing"
            >
              <div className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-6 shadow-[0_32px_64px_-16px_rgba(30,41,59,0.25)] border border-white relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
                
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quick Metrics</h4>
                    <p className="text-sm font-black text-slate-900 uppercase">Live Stats</p>
                  </div>
                  <button 
                    onClick={() => setShowQuickStats(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <Settings size={14} className="rotate-90" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <div className="leading-none">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Students</p>
                        <p className="text-xl font-black text-slate-900 leading-none">{stats.totalStudents}</p>
                      </div>
                    </div>
                    <Activity size={16} className="text-emerald-500 opacity-50" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                        <BookOpen size={18} />
                      </div>
                      <div className="leading-none">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Exams</p>
                        <p className="text-xl font-black text-slate-900 leading-none">{stats.totalExams}</p>
                      </div>
                    </div>
                    <Plus size={16} className="text-blue-500 opacity-50" />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Real-time Data</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">
                    ID: {user?.uid.substring(0, 8)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {!showQuickStats && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setShowQuickStats(true)}
              className="fixed bottom-8 left-8 z-[100] w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-500/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            >
              <Activity size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Floating Support Modal */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="dashboard-contact-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-[32px] border-4 border-slate-900 shadow-2xl p-8 max-w-lg w-full space-y-6 overflow-hidden text-left relative"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border-2 border-blue-100 shrink-0">
                  <Mail size={24} />
                </div>
                <div className="space-y-3 flex-1 col-span-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    Contact Us / Nu Qunnamaa
                  </h3>
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">
                    Support, comments & Questions / Deeggarsaa fi Yaada
                  </div>
                  
                  {/* English Instruction */}
                  <div className="space-y-1 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">English</p>
                    <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                      If you have any feedback, suggestions, questions, or need technical support regarding the application, please reach out to us by sending an email.
                    </p>
                  </div>

                  {/* Afaan Oromoo Instruction */}
                  <div className="space-y-1 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Afaan Oromoo</p>
                    <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                      Karaa ittiin nu qunnamanii yaada, gaaffii, fi deeggarsa kkf nuuf erguuf imeelii gadii kanaan nu qunnamaa.
                    </p>
                  </div>

                  <div className="font-mono text-xs font-extrabold text-slate-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex justify-between items-center">
                    <span>Email: jemalfano030@gmail.com</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowContactModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer border border-slate-200"
                >
                  Close / Cufi
                </button>
                <a
                  href="mailto:jemalfano030@gmail.com?subject=Biftu%20Beri%20App%20Support%20Feedback"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-150 shadow-md shadow-blue-500/20 hover:scale-102 cursor-pointer flex items-center gap-2"
                >
                  <Mail size={12} />
                  <span>Send Email / Imeelii Ergi</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Installation & Shortcut Guide Modal */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="dashboard-install-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-[32px] border-4 border-slate-900 shadow-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-left relative scrollbar-none animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border-2 border-emerald-100 shrink-0">
                  <Laptop size={24} />
                </div>
                <div className="space-y-1.5 flex-grow">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                    Chrome Shortcut & Shortcut Setup / Fe'iinsaa fi Toora Gabaabaa
                  </h3>
                  <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                    Guide for school computers & student mobile screens
                  </div>
                </div>
              </div>

              {/* Instructions content - Dual tabs or side-by-side grids */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-left">
                {/* School Computers Section */}
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                    <Monitor className="text-blue-500 shrink-0" size={18} />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      1. School Computers / Compiitara M.B
                    </h4>
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Open Chrome</strong>
                        <span className="text-slate-600">Ensure Google Chrome is open and you are on our assessment system page.</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Chrome banuun gara fuula qorumsa kanaatti deemi.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Menu Option (⋮)</strong>
                        <span className="text-slate-600">Click the 3 dots in the upper-right corner of Google Chrome's toolbar.</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Tuqaalee sadii (⋮) gara mirga olii cuqiisi.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Save / Install App</strong>
                        <span className="text-slate-600">Choose <strong className="font-extrabold text-slate-850">"Save and share" &rarr; "Install page as app"</strong>, or choose <strong className="font-extrabold text-slate-850">"More tools" &rarr; "Create shortcut..."</strong>.</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">"Save and share" filadhuu "Install page as app" filadhu yookaan "More tools" filadhuu "Create shortcut" cuqaasi.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[10px]">4</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Desktop Shortcut</strong>
                        <span className="text-slate-600">Check <strong className="font-extrabold text-slate-850">"Open as window"</strong> and click <strong className="font-extrabold text-slate-850">"Create"</strong>. The app launcher shortcut now lives on your school computer Desktop!</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Sandiqa "Open as window" saasiliitii, Desktop irratti mallattoo uumi.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student Mobiles Section */}
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                    <Smartphone className="text-emerald-500 shrink-0" size={18} />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      2. Mobile Screen / Moobaayila Irratti
                    </h4>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5 font-bold">Browser Choice</strong>
                        <span className="text-slate-600">Visit this assessment Link on your mobile via Google Chrome or Safari browser.</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Gara linkii kanaatti Moobaayila keessaniin Chrome ykn Safari fayyadamuun seenaa.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Click Menu (⋮) / Share</strong>
                        <span className="text-slate-600">On Android, tap 3-dots (⋮). On iPhone, tap the Share button (arrow icon at the bottom center).</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Android irratti qabduu (⋮) cuqaasaa, iPhone irratti share (qooduu) tuqaa.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Pin to Screen</strong>
                        <span className="text-slate-600">Select <strong className="font-extrabold text-slate-850">"Add to Home Screen"</strong> or <strong className="font-extrabold text-slate-850">"Install App"</strong>.</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Sajoo "Add to Home Screen" yookaan "Appii Fe'i" filadhaa kuusaa.</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px]">4</span>
                      <div>
                        <strong className="text-slate-950 font-black block mb-0.5">Ready to Practice</strong>
                        <span className="text-slate-600">The "Biftu Beri Exam" logo icon will now sit elegantly next to your other mobile apps!</span>
                        <span className="block text-[11px] font-medium leading-snug text-slate-400 mt-1">Amma saffisaan appilikeeshiniicatti fayyadamuu ni dandeessu!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer / Deployment Support Note */}
              <div className="bg-slate-950 text-white p-5 rounded-2xl flex items-center gap-4 shadow-lg text-left">
                <Info size={28} className="text-blue-400 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold leading-normal text-slate-200">
                    <strong className="text-blue-400 font-extrabold uppercase tracking-wide">PWA & Caching Ready:</strong> This system uses automatic state caching with Firebase. When student laptops/phones have it pinned as an app icon, launching and loading assessments works at peak speed!
                  </p>
                  <p className="text-[10px] text-slate-400 leading-snug italic font-medium">
                    Sisteemichi qulqullina olaanaan waan tolfameef, shortcuts fi desktop app uumtanii fe'uun barattootaaf madaallii hundra saffisa handa tajaajila addaa kenna!
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowInstallGuide(false)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer border border-slate-200"
                >
                  Close / Cufi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StudentChatWidget />
    </div>
  );
}

function ExamCard({ exam, role, attempts }: { exam: Exam, role?: string, attempts?: ExamAttempt[] }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const downloadOfflineExamPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGeneratingPDF || !exam.id) return;

    try {
      setIsGeneratingPDF(true);
      
      const qSnapshot = await getDocs(
        query(
          collection(db, 'exams', exam.id, 'questions'), 
          orderBy('orderIndex', 'asc')
        )
      );
      
      const qList = qSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)) as Question[];
      
      if (qList.length === 0) {
        alert(language === 'om' ? 'Qorumsa kana keessatti gaaffiin hin argamne.' : 'No questions found in this exam yet.');
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const margin = 15;
      const pageWidth = 210;
      const pageHeight = 297;
      const maxContentHeight = 265;
      
      let y = 20;

      const drawPageDecorations = (pageNum: number, totalPagesPlaceholder: string | number) => {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

        doc.setFillColor(22, 101, 52);
        doc.rect(10, 10, pageWidth - 20, 3, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page / Fuellee ${pageNum} of ${totalPagesPlaceholder}`, pageWidth / 2, pageHeight - 13, { align: 'center' });
        doc.text('BIFTU BERI SECONDARY SCHOOL PORTAL', 15, pageHeight - 13, { align: 'left' });
        doc.text('OFFLINE PRACTICE COPY / DEEBII MALEE', pageWidth - 15, pageHeight - 13, { align: 'right' });
      };

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 24, 2, 2, 'F');
      doc.setDrawColor(22, 101, 52);
      doc.setLineWidth(0.5);
      doc.rect(margin, y, pageWidth - (margin * 2), 24);

      doc.setFillColor(22, 101, 52);
      doc.roundedRect(margin + 4, y + 4, 16, 16, 2, 2, 'F');
      doc.setTextColor(250, 204, 21);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('B', margin + 12, y + 15, { align: 'center' });

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Biftu Beri Secondary School Portal', margin + 24, y + 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Student Self-Practice Resource Paper - Standard Offline Preparation', margin + 24, y + 13);
      doc.text('Practicing Mock Exam under real timelines builds confidence!', margin + 24, y + 17);

      y += 32;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 35, 2, 2, 'FD');

      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      const splitTitle = doc.splitTextToSize((exam.title || 'Untitled Exam') + ' (PRACTICE)', 170);
      doc.text(splitTitle, margin + 6, y + 8);

      const titleDelta = (splitTitle.length - 1) * 6;
      y += titleDelta;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
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
      doc.text(`TOTAL QUESTIONS:`, margin + 110, y + 24);
      doc.setTextColor(15, 23, 42);
      doc.text(`${qList.length} Questions for practice`, margin + 140, y + 24);

      y += 42;

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, pageWidth - (margin * 2), 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text("STUDENT'S IDENTITY (FILLING BLOCK FOR SELF-EVALUATION ROOM)", margin + 6, y + 5);

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);

      doc.setTextColor(100, 116, 139);
      doc.text("Candidate Full Name: _________________________________", margin + 6, y + 14);
      doc.text("Student ID (SID): ____________________", margin + 110, y + 14);

      y += 30;

      doc.setFillColor(254, 243, 199);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 15, 1.5, 1.5, 'F');
      doc.setDrawColor(245, 158, 11);
      doc.rect(margin, y, pageWidth - (margin * 2), 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(146, 64, 14);
      doc.text("PRACTICE RULES:", margin + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text("1. Set a silent stopwatch of exactly " + (exam.durationMinutes || 60) + " minutes. Do not search Web or consult others.", margin + 4, y + 9);
      doc.text("2. Circle your answers on the practice block layout at the end of this packet.", margin + 4, y + 12);
      
      y += 22;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("PART I: MULTIPLE-CHOICE QUESTIONS (CHOOSE THE SINGLE BEST OPTION)", margin, y);
      y += 8;

      qList.forEach((question, idx) => {
        const qText = question.text || 'Question Text Missing';
        const scoreTag = `[${question.points || 1} mark/qabxii]`;
        const fullQText = `${idx + 1}. ${qText} ${scoreTag}`;
        
        const wrappedQ = doc.splitTextToSize(fullQText, pageWidth - (margin * 2));
        const qHeight = wrappedQ.length * 5;

        let optionsLines: string[][] = [];
        let totalOptionsHeight = 0;
        const opts = question.options || [];

        opts.forEach((opt, oIdx) => {
          const letter = String.fromCharCode(65 + oIdx);
          const wrappedOpt = doc.splitTextToSize(`  ${letter}) ${opt}`, pageWidth - (margin * 2) - 10);
          optionsLines.push(wrappedOpt);
          totalOptionsHeight += (wrappedOpt.length * 4.5) + 1.5;
        });

        const totalItemHeight = qHeight + totalOptionsHeight + 7;

        if (y + totalItemHeight > maxContentHeight) {
          doc.addPage();
          y = 25;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        wrappedQ.forEach((line: string) => {
          doc.text(line, margin, y);
          y += 5;
        });

        y += 1;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        optionsLines.forEach((optLines) => {
          optLines.forEach((line: string) => {
            doc.text(line, margin + 4, y);
            y += 4.5;
          });
          y += 1.5;
        });

        y += 2.5;
      });

      const totalAnswers = qList.length;
      const rowsNeeded = Math.ceil(totalAnswers / 10);
      const gridBlockHeight = 12 + (rowsNeeded * 10);

      if (y + gridBlockHeight + 15 > maxContentHeight) {
        doc.addPage();
        y = 25;
      }

      y += 5;
      doc.setDrawColor(22, 101, 52);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(22, 101, 52);
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

      try {
        await createAuditLog('export_pdf', 'DashboardStudentPractice', exam.id, `${exam.title} (Practice - Deebii Malee)`);
      } catch (logErr) {
        console.error("Audit logging error:", logErr);
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawPageDecorations(i, totalPages);
      }

      doc.save(`bbs2_practice_${exam.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to download offline practice exam questions. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-3xl border-2 border-slate-200/60 p-8 flex flex-col shadow-sm hover:shadow-xl transition-all h-full"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="p-3 bg-[#e8f1fc] rounded-2xl text-blue-600 border border-blue-100">
          <BookOpen size={28} />
        </div>
        <div className="flex items-center gap-2">
          {(role === 'admin' || role === 'staff') && (
            <button 
              onClick={() => navigate(`/review/${exam.id}`)}
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
              title="Review Question Key"
            >
              <Eye size={20} />
            </button>
          )}
          {(() => {
            const statusConfig = {
              published: { icon: Globe, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', border: 'border-emerald-200', label: 'Published / Maxxanfame' },
              draft: { icon: FileText, bg: 'bg-amber-50 border-amber-200 text-amber-700', border: 'border-amber-200', label: 'Draft / Duroo' },
              archived: { icon: Lock, bg: 'bg-rose-50 border-rose-200 text-rose-700', border: 'border-rose-200', label: 'Archived / Kuusame' }
            }[exam.status || 'draft'];
            const StatusIcon = statusConfig.icon;
            return (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${statusConfig.bg} ${statusConfig.border}`}>
                <StatusIcon size={12} />
                {statusConfig.label}
              </span>
            );
          })()}
        </div>
      </div>

      <div className="flex-1 space-y-3 mb-8">
        <h3 className="text-2xl font-black text-slate-900 leading-tight line-clamp-2 uppercase tracking-tight">
          {exam.grade === '12' && exam.mockNumber ? `MOCK ${exam.mockNumber} • ` : ''}{exam.title}
        </h3>
        {exam.description && (
          <p className="text-sm text-slate-600 line-clamp-2 font-medium mt-2">
            {exam.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {exam.grade === '12' && exam.mockNumber && (
            <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse shadow-sm shadow-orange-100">
              Mock Exam #{exam.mockNumber}
            </span>
          )}
          <span className="px-3 py-1 bg-blue-50 text-blue-850 rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-150">Grade {exam.grade}</span>
          <span className="px-3 py-1 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-150">{exam.subject}</span>
          {exam.stream !== 'general' && (
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
              exam.stream === 'natural' ? 'bg-emerald-50 text-emerald-800 border-emerald-150' : 'bg-purple-50 text-purple-800 border-purple-150'
            }`}>
              {exam.stream}
            </span>
          )}
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
            exam.type === 'eaes_mock' ? 'bg-amber-50 text-amber-805 border-amber-150' :
            exam.type === 'final' ? 'bg-rose-50 text-rose-850 border-rose-150' :
            exam.type === 'mid' ? 'bg-indigo-50 text-indigo-850 border-indigo-150' :
            'bg-blue-50 text-blue-850 border-blue-150'
          }`}>
            {exam.type === 'eaes_mock' ? 'EAES Mock' : exam.type === 'final' ? 'Final Exam' : exam.type === 'mid' ? 'Mid Exam / Mide' : 'Model Exam'}
          </span>
        </div>
      </div>

      <div className="space-y-4 mb-10 p-4 bg-[#f5f9ff] border border-blue-100/50 rounded-2xl">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <Clock size={18} className="text-slate-400" />
          <span>{formatDuration(exam.durationMinutes)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <Calendar size={18} className="text-slate-400" />
          <span>Created: {format(exam.createdAt?.toDate?.() || new Date(), 'MMM d, yyyy')}</span>
        </div>
        {exam.dueDate && (
          <div className={`flex items-center gap-3 text-sm font-bold p-2 rounded-xl border ${
            (exam.dueDate?.toDate?.() || new Date(exam.dueDate)) < new Date() 
              ? 'bg-red-50 text-red-600 border-red-150' 
              : 'bg-amber-50 text-amber-705 border-amber-150'
          }`}>
            <AlertCircle size={18} />
            <span>Due: {format(exam.dueDate?.toDate?.() || new Date(exam.dueDate), 'MMM d, h:mm a')}</span>
          </div>
        )}
      </div>

      <div className="mt-auto">
        {showConfirmDelete ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-rose-50 border border-rose-150 rounded-2xl text-center space-y-3"
          >
            <p className="text-xs font-black text-rose-700 uppercase tracking-tight">
              {language === 'om' 
                ? 'Mirkaneessi: Qorumsa/Gosa barnootaa kana haquu barbaadduu? Qabxiin barattootaa hundi ni haqamu.' 
                : 'Confirm deletion? All questions and student marks for this exam will be permanently lost.'}
            </p>
            <div className="flex gap-2">
              <button
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteDoc(doc(db, 'exams', exam.id));
                  } catch (err) {
                    console.error("Error deleting exam:", err);
                    handleFirestoreError(err, OperationType.WRITE, `exams/${exam.id}`);
                  } finally {
                    setIsDeleting(false);
                    setShowConfirmDelete(false);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : (language === 'om' ? 'Eeyyee, Haqi' : 'Yes, Delete')}
              </button>
              <button
                disabled={isDeleting}
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center gap-3 w-full">
            {(role === 'admin' || role === 'staff') ? (
              <>
                <Link
                  to={`/admin/exams/${exam.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold border border-blue-500 transition-all shadow-md shadow-blue-100/50 text-xs uppercase tracking-widest cursor-pointer hover:scale-[1.02]"
                >
                  <Settings size={20} />
                  Manage Exam
                </Link>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="p-4 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-2xl transition-all flex items-center justify-center cursor-pointer"
                  title={language === 'om' ? 'Haquuf' : 'Delete Exam'}
                >
                  <Trash2 size={20} />
                </button>
              </>
            ) : (() => {
              const examAttempts = (attempts || []).filter(a => a.examId === exam.id && (a.status === 'completed' || a.status === 'timed-out'));
              const completedCount = examAttempts.length;
              
              // Calculate highest score for G12 Mock Exams or any other exams
              let highestScore = 0;
              let bestAttempt: ExamAttempt | undefined = undefined;
              if (completedCount > 0) {
                highestScore = Math.max(...examAttempts.map(a => a.score || 0));
                bestAttempt = examAttempts.find(a => (a.score || 0) === highestScore);
              }
              const maxPoints = bestAttempt ? (bestAttempt.totalPoints || exam.questionCount || 0) : (exam.questionCount || 0);
              const highestPct = maxPoints > 0 ? Math.round((highestScore / maxPoints) * 100) : 0;
              const hasPassed = highestPct >= 50;
              const isG12Mock = exam.grade === '12' && exam.mockNumber !== undefined;

              return (
                <div className="w-full space-y-3">
                  {completedCount > 0 && (
                    <div className="p-4 bg-blue-50/50 border border-blue-105/70 rounded-2xl text-center space-y-1">
                      <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none">
                        Highest Score / Qabxii Gidduugaleessaa Olaanaa
                      </div>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-black text-blue-700">{highestScore}</span>
                        <span className="text-xs font-bold text-slate-500">/ {maxPoints}</span>
                        <span className="text-xs font-black text-emerald-600 block ml-1.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">({highestPct}%)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                        Attempt Count: {completedCount} {completedCount === 1 ? 'yaalii' : 'yaaliiwwan'}
                      </p>
                    </div>
                  )}

                  {isG12Mock ? (
                    // For G12 Mock Exams, always allow continuous retakes to perfect their skills!
                    <Link
                      to={`/exam/${exam.id}/take`}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-[1.02] text-xs uppercase tracking-widest cursor-pointer shadow-md shadow-blue-100"
                    >
                      <Award size={18} />
                      <span>{completedCount > 0 ? 'Retake Mock Exam' : 'Start Mock Exam / Qorumsa Jalqabi'}</span>
                      <ChevronRight size={16} />
                    </Link>
                  ) : hasPassed ? (
                    <div className="w-full space-y-2">
                      <div className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-emerald-300">
                        <CheckCircle size={18} />
                        <span>Exam Passed / Qormaata Dabriteerta</span>
                      </div>
                      <div className="flex justify-center text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">
                        Result Secured (Addeessa Galmaa'eera)
                      </div>
                    </div>
                  ) : completedCount >= 1 ? (
                    <div className="w-full space-y-2">
                      <Link
                        to={`/exam/${exam.id}/take`}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-black shadow-md shadow-amber-100/50 transition-all hover:scale-[1.02] text-xs uppercase tracking-widest cursor-pointer border border-amber-400"
                      >
                        <Award size={18} />
                        <span>Retake Exam / Irra-deebi'ii Qorami</span>
                      </Link>
                      <div className="flex justify-center text-[10px] text-amber-600 font-extrabold uppercase tracking-widest">
                        {completedCount} failed attempts • Practice to pass!
                      </div>
                    </div>
                  ) : (
                    <Link
                      to={`/exam/${exam.id}/take`}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-md shadow-green-100/50 hover:bg-green-700 transition-all hover:scale-[1.02] text-xs uppercase tracking-widest cursor-pointer"
                    >
                      Take Exam / Qorumsa Seeni <ChevronRight size={20} />
                    </Link>
                  )}

                  {/* Practice Offline Download Button */}
                  <button
                    type="button"
                    disabled={isGeneratingPDF}
                    onClick={downloadOfflineExamPDF}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-50 hover:bg-slate-150 disabled:opacity-50 text-slate-700 hover:text-slate-900 rounded-2xl font-black border-2 border-slate-200/80 transition-all hover:scale-[1.01] text-[10px] uppercase tracking-widest cursor-pointer mt-2"
                    title={language === 'om' ? 'Qormaata kana deebii malee buufachuun offline shaakali' : 'Download this exam without answers to practice offline'}
                  >
                    <Download size={14} className={isGeneratingPDF ? "animate-bounce text-green-600" : "text-slate-500"} />
                    <span>{isGeneratingPDF ? (language === 'om' ? "Qorumsi Qophaawaa Jira..." : "Compiling Practice PDF...") : (language === 'om' ? "Buufadhu Qorami (Offline PDF)" : "Practice Offline (Download PDF)")}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// BRAND NEW COMPONENT: STUDENT COMPARATIVE PERFORMANCE ANALYTICS
// ============================================================================
function StudentComparativeAnalytics({ uid, grade, stream }: { uid: string, grade?: string, stream?: string }) {
  const { language } = useLanguage();
  const [chartData, setChartData] = useState<any[]>([]);
  const [weakCategories, setWeakCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        // Fetch all marks of the DB to compute school-wide averages for this grade level
        const marksSnap = await getDocs(collection(db, 'marks'));
        const allMarks = marksSnap.docs.map(doc => doc.data() as StudentMark);

        // Subjects list matching Grade/Stream of student
        const gradeStr = grade || '12';
        const streamStr = stream || 'natural';
        
        let subjectsToLoad = ['Biology', 'Physics', 'Chemistry', 'Mathematics', 'English', 'Citizenship', 'IT'];
        if (gradeStr === '11' || gradeStr === '12') {
          if (streamStr === 'social') {
            subjectsToLoad = ['History', 'Geography', 'Economics', 'Mathematics', 'English', 'Citizenship', 'IT'];
          }
        }

        const stats = subjectsToLoad.map(subj => {
          // My personal average in this subject
          const ownSubj = allMarks.filter(m => m.studentId === uid && m.subject.toLowerCase() === subj.toLowerCase());
          const myAvg = ownSubj.length > 0
            ? Math.round(ownSubj.reduce((sum, curr) => sum + (curr.score / curr.totalPoints), 0) / ownSubj.length * 105)
            : 0;

          // School grade level average for this subject
          const schoolSubj = allMarks.filter(m => m.subject.toLowerCase() === subj.toLowerCase() && m.studentId !== uid);
          const schoolAvg = schoolSubj.length > 0 
            ? Math.round(schoolSubj.reduce((sum, curr) => sum + (curr.score / curr.totalPoints), 0) / schoolSubj.length * 105)
            : 60; // realistic default average benchmark

          return {
            subject: subj,
            myScore: Math.min(myAvg, 100),
            schoolAverage: Math.min(schoolAvg, 100)
          };
        });

        setChartData(stats);

        // Filter out weak subject areas where myScore is less than schoolAverage or less than 50%
        const weak = stats.filter(s => s.myScore < s.schoolAverage || s.myScore < 50);
        setWeakCategories(weak);
      } catch (err) {
        console.error("Error loader comparative student diagrams:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [uid, grade, stream]);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 rounded-2xl animate-pulse text-center font-bold text-xs uppercase tracking-widest text-slate-400">
        Constructing Comparative Analytics Diagram...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Visual Chart Card */}
      <div className="lg:col-span-2 bg-slate-50 p-6 rounded-[32px] border border-slate-200/80 space-y-4">
        <div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Academic Stream Performance Analysis</h4>
          <p className="text-[9px] font-bold text-slate-400 col-span-2 uppercase tracking-wide">
            Comparative illustration of your average scores against school-wide grade averages (%)
          </p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="subject" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 'bold' }} 
              />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'medium' }} />
              <Tooltip 
                cursor={{ fill: '#F8FAFC' }}
                contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={32}
                content={() => (
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      <div className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                      {language === 'om' ? 'Qabxii Kiyya (My Score)' : 'My Average Score'}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      <div className="w-2.5 h-2.5 rounded-sm bg-indigo-200" />
                      {language === 'om' ? 'Giddugalaa Mana Barumsaa' : 'School Average'}
                    </div>
                  </div>
                )}
              />
              <Bar dataKey="myScore" name="My Score" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={16} />
              <Bar dataKey="schoolAverage" name="School Average" fill="#C7D2FE" radius={[4, 4, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weak Categories Study Targets Panel */}
      <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200/85 flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shrink-0" />
            {language === 'om' ? 'Barnoota Saffisaan Xiyyeeffatamuu Qaban' : 'Weak Categories & Study Targets'}
          </h4>

          {weakCategories.length === 0 ? (
            <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl space-y-1">
              <p className="text-xs font-black uppercase tracking-wide">🎉 Outstanding Mastery!</p>
              <p className="text-[10px] uppercase font-bold leading-normal text-emerald-600">Your average score is above school benchmark levels in all subjects!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {weakCategories.map(weak => (
                <div key={weak.subject} className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-1">
                  <div>
                    <span className="text-xs font-black text-slate-900 uppercase block">{weak.subject}</span>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                      Your Score: <strong className="text-rose-600">{weak.myScore}%</strong> vs Avg: <strong className="text-slate-800">{weak.schoolAverage}%</strong>
                    </span>
                  </div>
                  <span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-[8px] font-black uppercase tracking-wider border border-red-150 shrink-0">
                    Needs Study
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50/50 p-3.5 border-2 border-dashed border-blue-200/60 rounded-2xl space-y-1">
          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block font-bold">💡 Proactive Guidance Tip:</span>
          <p className="text-[10px] text-slate-500 leading-normal font-bold">
            {language === 'om' 
              ? "Qormaata madaallii bilisaa fiduuf 'National Countdown Simulator' irra deebi'ii hojjadhu. Adeemsi kun milkaa'ina dabala!"
              : "Launch any subject preparatory exam, complete focus countdowns, and practice until your scores are above 85% to comfortably clear national boundaries!"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BRAND NEW COMPONENT: SMS NOTIFICATION GATEWAY & COURSE SUBJECTS PANEL
// ============================================================================
function SmsAndSubjectsPanel() {
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [addingSubj, setAddingSubj] = useState(false);
  const [smsLogsList, setSmsLogsList] = useState<any[]>([]);
  const [broadcasting, setBroadcasting] = useState(false);

  // SMS Broadcast form fields
  const [broadcastGrade, setBroadcastGrade] = useState("12");
  const [broadcastType, setBroadcastType] = useState("transcript");
  const [customMsg, setCustomMsg] = useState("");

  const [loading, setLoading] = useState(true);

  const fetchSubjectsAndLogs = async () => {
    try {
      setLoading(true);
      // Fetch dynamic course subjects
      const subSnap = await getDocs(collection(db, 'subjects'));
      const loadedSubjs = subSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
      setSubjectsList(loadedSubjs.map(s => s.name).sort());

      // Fetch SMS Outbox logs
      const qSms = query(collection(db, 'sms_logs'), orderBy('sentAt', 'desc'), limit(50));
      const smsSnap = await getDocs(qSms);
      const loadedLogs = smsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSmsLogsList(loadedLogs);
    } catch (e) {
      console.error("Error setting up SMS and dynamic subjects panel:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjectsAndLogs();
  }, []);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;

    try {
      setAddingSubj(true);
      const cleanName = newSubject.trim();
      const subjectDocId = cleanName.replace(/\s+/g, '_').toLowerCase();
      
      const subjRef = doc(db, 'subjects', subjectDocId);
      await setDoc(subjRef, { name: cleanName });

      setNewSubject("");
      alert(language === 'en' 
        ? `Course subject "${cleanName}" added successfully to the School Curriculum!` 
        : `Gosti Barnootaa "${cleanName}" haala milkaa'een sirna barnootaa irratti dabalamuun kuufameera!`
      );
      fetchSubjectsAndLogs();
    } catch (err) {
      console.error("Failed to add subject:", err);
      alert("Error adding subject to Firestore. Please try again.");
    } finally {
      setAddingSubj(false);
    }
  };

  const handleDeleteSubject = async (subjectName: string) => {
    if (!confirm(language === 'en' 
      ? `⚠️ WARNING: Are you sure you want to delete the subject "${subjectName}"? This will immediately remove it from all blank report template downloads and future exams.` 
      : `⚠️ EEGGANNUU: Gosa barnootaa "${subjectName}" sirna keessaa haquu akka barbaaddu mirkaneeffadhu? Balteessuun kun dabalataa weebsaayiitii hunda jallisa.`)) {
      return;
    }

    try {
      const subjectDocId = subjectName.replace(/\s+/g, '_').toLowerCase();
      await deleteDoc(doc(db, 'subjects', subjectDocId));

      alert(language === 'en' 
        ? `Subject "${subjectName}" deleted successfully.` 
        : `Gosti barnootaa "${subjectName}" guutummaatti haqameera.`
      );
      fetchSubjectsAndLogs();
    } catch (err) {
      console.error("Failed to delete subject:", err);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBroadcasting(true);

      // Determine text message template content
      let textContent = "";
      if (broadcastType === 'transcript') {
        textContent = `BIFTU BERI HIGH SCHOOL ALERT: Official Report Cards and Exam Transcript Results for Grade ${broadcastGrade} are ready for collection. Please contact your Parent Advisor or Registrar.`;
      } else if (broadcastType === 'prep') {
        textContent = `BIFTU BERI ALERT: Students of Grade ${broadcastGrade} are requested to maximize usage of the 120-minute national countdown simulator prior to school mock trials. Practice to succeed!`;
      } else {
        textContent = customMsg.trim() || `BIFTU BERI SMS GATEWAY BROADCAST: General notice to all Grade ${broadcastGrade} parents and scholars regarding calendar activities.`;
      }

      // Simulate sending to students in selected grade level
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'student'), where('grade', '==', broadcastGrade));
      const snap = await getDocs(q);

      if (snap.empty) {
        // Send a generalized test logger if no students found
        await addDoc(collection(db, 'sms_logs'), {
          recipientName: `Parents of Grade ${broadcastGrade}`,
          parentPhone: "+251 911 000 000 (Test Group)",
          messageContent: textContent,
          sentAt: serverTimestamp(),
          deliveryStatus: 'DELIVERED',
          triggerEvent: 'BROADCAST_MANUAL'
        });
      } else {
        const batch = writeBatch(db);
        snap.docs.forEach(studentDoc => {
          const s = studentDoc.data();
          const pDocRef = doc(collection(db, 'sms_logs'));
          batch.set(pDocRef, {
            recipientName: s.fullName || s.name || 'Student Parent',
            parentPhone: s.address || "+251 900 123 456", // Fallback simulated parent connection
            messageContent: textContent,
            sentAt: serverTimestamp(),
            deliveryStatus: 'DELIVERED',
            triggerEvent: 'BROADCAST_GRADE_LEVEL'
          });
        });
        await batch.commit();
      }

      setCustomMsg("");
      alert(language === 'en' 
        ? `🎉 Broadcast dispatched! Simulated SMS alerts successfully delivered to Grade ${broadcastGrade} parents via Standard Ethio Telecom SMS API gateway.` 
        : `🎉 Ergaan dabarsamee jira! Ergaaleen madaallii maatii hunda Kutaa ${broadcastGrade} weeb-kaariyaan 'Ethio Telecom' hafuura gaariin gahan.`
      );
      fetchSubjectsAndLogs();
    } catch (err) {
      console.error("SMS Broadcast dispatch error:", err);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleTestStandingsSms = async (standing: 'Darbe' | 'Kufe') => {
    try {
      const msg = standing === 'Darbe' 
        ? "ALERT FOR PARENT: Biftu Beri Student promotional assessment standing updated for 2018 E.C: status: 'Promoted / Darbe' based on overall grade performance benchmarks."
        : "ALERT FOR PARENT: Biftu Beri Student promotional assessment standing updated for 2018 E.C: status: 'Retained / Kufe' based on core score averages limitation. Please schedule teacher guidance.";

      await addDoc(collection(db, 'sms_logs'), {
        recipientName: "Demo Parent Representative",
        parentPhone: "+251 911 556 789",
        messageContent: msg,
        sentAt: serverTimestamp(),
        deliveryStatus: 'DELIVERED',
        triggerEvent: `ALERT_PROMOTION_STANDING_${standing.toUpperCase()}`
      });

      alert(language === 'en'
        ? `🔥 Test Stands SMS sent! Logged parent promotional standing "${standing}" update alert.`
        : `🔥 SMS qabxii 'Darbe/Kufe' yaalii kanaan maatiif ergameera!`
      );
      fetchSubjectsAndLogs();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <RefreshCw className="animate-spin text-blue-600 mx-auto" size={36} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading SMS Outbox and Dynamic Curriculum List...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* SECTION 1: SMS COMMISSIONING & BROADCAST GATEWAY */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-250 inline-block mb-2">
              ● API CONNECTION ACTIVE
            </span>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Parent Advisor & Registrar SMS Portal</h3>
            <p className="text-xs text-slate-500 font-bold uppercase leading-snug">
              Link evaluations and promotional standings ("Promoted / Darbe" or "Retained / Kufe") instantly to simple parent mobile devices
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-150 rounded-2xl shrink-0 self-start md:self-auto font-black text-[10px] text-slate-500 uppercase tracking-widest leading-none">
            <Smartphone size={14} className="text-blue-500 shrink-0" />
            Gateway: Ethio Telecom Enterprise
          </div>
        </div>

        {/* MOCK ACTION TRIGGER RIG */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleSendBroadcast} className="bg-slate-50 p-6 rounded-[32px] border border-slate-200/80 space-y-4">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
              Broadcast Notification Center
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block select-id font-bold">Recipient Grade</label>
                <select
                  value={broadcastGrade}
                  onChange={(e) => setBroadcastGrade(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-xs"
                >
                  <option value="9">Grade 9 Parents</option>
                  <option value="10">Grade 10 Parents</option>
                  <option value="11">Grade 11 Parents</option>
                  <option value="12">Grade 12 Parents</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold block select-id">Notification Goal</label>
                <select
                  value={broadcastType}
                  onChange={(e) => setBroadcastType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-xs"
                >
                  <option value="transcript">Transcript & Report Card Readiness</option>
                  <option value="prep">National Exam Mock Study Guidance</option>
                  <option value="custom">Writable Custom SMS Announcement</option>
                </select>
              </div>
            </div>

            {broadcastType === 'custom' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold block select-id">Custom SMS Message Body (Max 160 Characters)</label>
                <textarea
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="E.g., Biftu Beri: Meeting for all parent advisors scheduled for Saturday morning regarding promotional boundaries..."
                  rows={3}
                  maxLength={160}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-xs leading-normal"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={broadcasting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-blue-200"
            >
              <Send size={14} />
              {broadcasting ? "Sending broadcast alerts..." : "Dispatch Broadcast Alerts (Maatiin Ergi)"}
            </button>
          </form>

          {/* STANDINGS AND AUTOMATION SETTINGS DEMO CAP */}
          <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200/80 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                  Gateway Automation Rule-Triggers
                </h4>
                <span className="text-[8px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase tracking-wider h-auto leading-none">
                  Fully Connected
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-150 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight block">Promotional Standings Alert</span>
                    <span className="text-[9px] text-slate-400 block leading-tight font-medium mt-0.5 font-bold">Alerts parent if student status scales "Promoted / Darbe" or "Retained / Kufe"</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleTestStandingsSms('Darbe')}
                      className="px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-black text-[8px] uppercase tracking-wider hover:bg-green-105 transition-all text-sm font-bold block"
                    >
                      Darbe
                    </button>
                    <button
                      onClick={() => handleTestStandingsSms('Kufe')}
                      className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-black text-[8px] uppercase tracking-wider hover:bg-red-105 transition-all text-sm font-bold block align-middle"
                    >
                      Kufe
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-slate-150 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight block">Submission Sync Push Hook</span>
                    <span className="text-[9px] text-slate-400 block leading-tight font-medium mt-0.5 font-bold">Triggers SMS automatically as soon as completed exam or offline test is synced</span>
                  </div>
                  <span className="px-3 py-1 text-[8px] font-extrabold bg-blue-50 text-blue-700 rounded-full uppercase shrink-0 border border-blue-100 font-bold block">
                    Active Hook
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[9px] font-extrabold text-amber-700 bg-amber-50 rounded-xl p-3 border border-amber-200 leading-normal mt-4 font-bold">
              ℹ&nbsp; Standard Ethio Telecom limits require all parental lines are mapped strictly by country identifiers (E.g. +251 9xx xxx xxx). Invalid formatted lines default to mock sandboxed carrier queues.
            </div>
          </div>
        </div>

        {/* OUTBOX LOGS TABLE */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest font-bold">Gateway Outbox Dispatch History / Galmee SMS Ergamee</h4>
          <div className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden max-h-80 overflow-y-auto">
            {smsLogsList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No SMS dispatches logged yet. Send a broadcast trigger or complete a test above!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-black text-slate-700 uppercase tracking-wider">
                      <th className="p-4">Recipient Target</th>
                      <th className="p-4">Parent Phone Line</th>
                      <th className="p-4">Message Context Sent</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Time Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {smsLogsList.map(log => (
                      <tr key={log.id} className="hover:bg-slate-100 transition-colors">
                        <td className="p-4 font-extrabold text-slate-900">{log.recipientName}</td>
                        <td className="p-4 font-mono text-slate-700 text-[10px]">{log.parentPhone}</td>
                        <td className="p-4 text-slate-500 leading-normal italic text-[11px] font-medium">{log.messageContent}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-md font-black text-[9px] uppercase tracking-wider font-bold block align-middle max-w-fit">
                            {log.deliveryStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-[10px] text-slate-400">
                          {log.sentAt?.toDate ? format(log.sentAt.toDate(), 'dd/MM HH:mm') : 'Now'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: DYNAMIC COURSE SUBJECTS & GRADE LEVEL CURRICULUM MANAGEMENT */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
        <div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Grade Course Subjects Curriculum List</h3>
          <p className="text-xs text-slate-500 font-bold uppercase leading-snug">
            Add or delete active assessment subjects. Deleted subjects are immediately purged offline from reporting matrices and dynamic template files.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* CREATE SUBJECT FORM */}
          <form onSubmit={handleCreateSubject} className="bg-slate-50 p-6 rounded-[32px] border border-slate-200/80 space-y-4">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
              Add Course Subject / Dabali
            </h4>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold leading-none mb-1">Subject Name (Afaan Oromoo or English)</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="E.g., Scholastic Aptitude, HPE..."
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl outline-none font-bold text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={addingSubj}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-green-100"
            >
              <Plus size={14} />
              {addingSubj ? "Recording..." : "Add Subject (Coomiin fidi)"}
            </button>
          </form>

          {/* ACTIVE SUBJECTS GRID FOR DELETING */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Curriculum Classes Subjects</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {subjectsList.map(subj => (
                <div 
                  key={subj}
                  className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 group hover:bg-white hover:border-slate-300 transition-all shadow-sm"
                >
                  <span className="font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">
                    {subj}
                  </span>
                  <button
                    onClick={() => handleDeleteSubject(subj)}
                    className="p-2 text-slate-300 hover:text-red-500 bg-transparent rounded-lg hover:bg-red-50 transition-all shrink-0 cursor-pointer"
                    title={language === 'en' ? `Delete subject "${subj}"` : `Haquu gosa "${subj}"`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BRAND NEW COMPONENT: LIVE STUDENT SUPPORT MESSENGER FLOATING COMPONENT
// ============================================================================
interface Message {
  id: string;
  studentId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

interface Feedback {
  id: string;
  userId: string;
  userEmail: string;
  examId: string;
  attemptId: string;
  subject: string;
  difficulty: string;
  comment: string;
  createdAt: any;
}

function StudentChatWidget() {
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // Load chat messages specifically for this logged-in student
  useEffect(() => {
    if (!user || !isOpen) return;
    const q = query(
      collection(db, 'chats'),
      where('studentId', '==', user.uid),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(list);
    }, (err) => {
      console.error("Error loading chat messages:", err);
    });
    return () => unsubscribe();
  }, [user, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'chats'), {
        studentId: user.uid,
        senderId: user.uid,
        senderName: profile?.fullName || profile?.name || user.email || 'Student',
        text: text.trim(),
        createdAt: serverTimestamp()
      });
      setText('');
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || profile?.role === 'admin' || profile?.role === 'staff') return null;

  return (
    <div className="fixed bottom-6 right-6 z-[90]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 sm:w-96 bg-white border-2 border-slate-200 rounded-[30px] shadow-2xl shadow-slate-900/10 overflow-hidden flex flex-col justify-between mb-4 h-[420px]"
          >
            {/* Window Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-white shrink-0" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider leading-none">Live Messenger Support</h4>
                  <span className="text-[8px] font-bold text-blue-100 uppercase tracking-widest block mt-1">Biftu Beri Admin Channel</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white transition-all cursor-pointer"
              >
                <AlertCircle size={18} />
              </button>
            </div>

            {/* Conversation Log */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/55 max-h-[280px]">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1">Send a message to Support / Admin!</p>
                  <p className="text-[9px] text-slate-400 font-medium">Barsiisaan hojii qulqullinaaf ergaa keessan hordofa.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isAdmin = m.senderId !== user.uid;
                  return (
                    <div key={m.id} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}>
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                        {isAdmin ? 'System Admin' : 'You'}
                      </span>
                      <div className={`p-3 max-w-[85%] rounded-2xl text-[11px] font-extrabold leading-relaxed ${
                        isAdmin 
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs' 
                          : 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input Control */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-150 flex gap-2 shrink-0">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={language === 'om' ? 'Yaada asitti barreessi...' : 'Type message to Admin support...'}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-[11px] text-slate-900"
              />
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white uppercase text-[9px] font-black rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <Send size={10} />
                Send
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-750 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-2xl shadow-blue-550/30 flex items-center gap-2 cursor-pointer transition-all active:scale-95 border border-blue-500"
      >
        <MessageSquare size={16} />
        <span>💬 chat</span>
      </button>
    </div>
  );
}

// ============================================================================
// BRAND NEW COMPONENT: SYSTEM ADMIN CONVERSATIONS AND STUDENT FEEDBACK VIEW
// ============================================================================
function FeedbackAndChatPanel() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<'feedback' | 'chat'>('feedback');
  
  // Feedback States
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  
  // Chat States
  const [chats, setChats] = useState<Message[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStudentName, setActiveStudentName] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Load feedbacks
  useEffect(() => {
    if (subTab !== 'feedback') return;
    setLoadingFeedback(true);
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Feedback));
      setFeedbacks(list);
      setLoadingFeedback(false);
    }, (err) => {
      console.error("Error reading feedbacks:", err);
      setLoadingFeedback(false);
    });
    return () => unsubscribe();
  }, [subTab]);

  // Load all chat messages (to group them by student)
  useEffect(() => {
    const qChat = query(collection(db, 'chats'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(qChat, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setChats(list);
    }, (err) => {
      console.error("Error reading chats:", err);
    });
    return () => unsubscribe();
  }, []);

  // Group chats by student
  const studentChatsMap = React.useMemo(() => {
    const groups: { [studentId: string]: { studentId: string; studentName: string; lastMessage: Message; unreadCount: number } } = {};
    chats.forEach(msg => {
      if (!groups[msg.studentId]) {
        groups[msg.studentId] = {
          studentId: msg.studentId,
          studentName: msg.senderId === msg.studentId ? msg.senderName : 'Student',
          lastMessage: msg,
          unreadCount: 0
        };
      } else {
        // If message is newer, update lastMessage
        const currentLast = groups[msg.studentId].lastMessage;
        const msgTime = msg.createdAt?.toDate?.() || new Date(msg.createdAt);
        const lastTime = currentLast.createdAt?.toDate?.() || new Date(currentLast.createdAt);
        if (msgTime > lastTime) {
          groups[msg.studentId].lastMessage = msg;
        }
        if (msg.senderId === msg.studentId && msg.senderName) {
          groups[msg.studentId].studentName = msg.senderName;
        }
      }
    });
    return Object.values(groups);
  }, [chats]);

  const activeMessages = React.useMemo(() => {
    if (!activeStudentId) return [];
    const list = chats.filter(m => m.studentId === activeStudentId);
    // Sort in ascending order
    return [...list].sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return aTime.getTime() - bTime.getTime();
    });
  }, [chats, activeStudentId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeStudentId || !user) return;
    setSendingReply(true);
    try {
      await addDoc(collection(db, 'chats'), {
        studentId: activeStudentId,
        senderId: user.uid,
        senderName: 'System Admin',
        text: replyText.trim(),
        createdAt: serverTimestamp()
      });
      setReplyText('');
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm(language === 'om' ? 'Yaada kana haquu barbaadduu?' : 'Are you sure you want to delete this feedback?')) return;
    try {
      await deleteDoc(doc(db, 'feedbacks', id));
    } catch (err) {
      console.error("Error deleting feedback:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none block mb-1">
              Communication Portal
            </span>
            <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tight">
              {language === 'om' ? 'Kallattii Yaada & Haasaa' : 'Feedback & Live Support'}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {language === 'om' 
                ? 'Yaada barataan erge sassaabi fi kallattiin haasaa gabaabaa waliin godhuu danda\'u' 
                : 'Manage student post-exam feedbacks and enjoy real-time messaging support with students.'}
            </p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0 gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab('feedback')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subTab === 'feedback' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Yaada Barattootaa ({feedbacks.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('chat')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                subTab === 'chat' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Messenger ({studentChatsMap.length})
            </button>
          </div>
        </div>

        {subTab === 'feedback' ? (
          <div className="pt-6 space-y-6">
            {loadingFeedback ? (
              <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                Loading Feedback...
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-150 rounded-3xl">
                <MessageSquare className="mx-auto text-slate-350 mb-3" size={32} />
                <p className="font-extrabold text-sm uppercase tracking-wider">No feedbacks registered yet / Ergaan hin jiru.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {feedbacks.map((f) => (
                  <motion.div
                    key={f.id}
                    layoutId={f.id}
                    className="p-6 rounded-3xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:shadow-lg hover:bg-white hover:border-slate-350 transition-all group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="space-y-1">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                            f.difficulty === 'very-easy' || f.difficulty === 'easy'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                              : f.difficulty === 'average'
                              ? 'bg-amber-50 text-amber-805 border-amber-100'
                              : 'bg-rose-50 text-rose-800 border-rose-100'
                          }`}>
                            Difficulty: {f.difficulty}
                          </span>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            Subject: {f.subject} • {f.userEmail}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(f.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-4 min-h-[60px]">
                        <p className="text-xs font-extrabold text-slate-750 leading-relaxed italic">
                          "{f.comment || 'No written comment provided / Fillannoo qofa'}"
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/60">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-700 uppercase">
                          {f.userEmail ? f.userEmail[0] : 'S'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-[150px]">{f.userEmail}</span>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        {f.createdAt?.toDate?.() ? format(f.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* CHAT AREA */
          <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
            {/* STUDENTS DIRECTORY LISTING */}
            <div className="lg:col-span-4 border border-slate-200 rounded-3xl p-4 space-y-3 bg-slate-50 max-h-[500px] overflow-y-auto">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Active Chats / Haasaawwan</h3>
              {studentChatsMap.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs font-bold uppercase tracking-wider">No active chat sessions / Haasaan hin jiru.</p>
                </div>
              ) : (
                studentChatsMap.map((sc) => {
                  const isSelected = activeStudentId === sc.studentId;
                  const lastMsgTime = sc.lastMessage.createdAt?.toDate?.() || new Date(0);
                  return (
                    <button
                      type="button"
                      key={sc.studentId}
                      onClick={() => {
                        setActiveStudentId(sc.studentId);
                        setActiveStudentName(sc.studentName);
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-100/50' 
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-150'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-xs font-black uppercase truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {sc.studentName || 'Student Contact'}
                          </span>
                          <span className={`text-[8px] font-black uppercase whitespace-nowrap ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                            {format(lastMsgTime, 'h:mm a')}
                          </span>
                        </div>
                        <p className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-500 font-medium'}`}>
                          {sc.lastMessage.text}
                        </p>
                      </div>
                      <ChevronRight size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    </button>
                  );
                })
              )}
            </div>

            {/* MESSAGES LOG VIEW */}
            <div className="lg:col-span-8 border border-slate-200 rounded-3xl flex flex-col justify-between bg-slate-50/30 overflow-hidden min-h-[450px]">
              {activeStudentId ? (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 bg-white border-b border-slate-250/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-xs font-black text-blue-700">
                        {activeStudentName ? activeStudentName[0] : 'S'}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                          {activeStudentName}
                        </h4>
                        <span className="text-[9px] text-green-600 font-extrabold uppercase tracking-wider block mt-1 animate-pulse">
                          ● Online Channel Active
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chat Messages Stream */}
                  <div className="flex-1 p-6 overflow-y-auto max-h-[320px] space-y-4 flex flex-col">
                    {activeMessages.map((msg) => {
                      const isAdminMsg = msg.senderId !== activeStudentId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[70%] ${isAdminMsg ? 'self-end items-end' : 'self-start items-start'}`}
                        >
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {isAdminMsg ? 'You (Admin)' : msg.senderName}
                          </span>
                          <div className={`p-4 rounded-3xl text-xs font-extrabold leading-relaxed ${
                            isAdminMsg
                              ? 'bg-blue-600 text-white rounded-tr-none'
                              : 'bg-white text-slate-850 border border-slate-200 rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Input Form */}
                  <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-slate-150 flex gap-3 items-center shrink-0">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={language === 'om' ? 'Asitti barreessi...' : 'Type short administrative response...'}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-medium text-xs text-slate-950"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-100"
                    >
                      <Send size={12} />
                      Send
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center p-12 text-slate-400">
                  <MessageSquare className="text-slate-350 animate-bounce mb-3" size={36} />
                  <p className="text-xs font-black uppercase tracking-wider">Select a student channel to trigger live messenger</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
