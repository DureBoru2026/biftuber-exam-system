import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Search, GraduationCap, Mail, Lock, Loader2, CheckCircle2, AlertCircle, FileUp, Download, Users, Wifi, WifiOff, RefreshCw, FileDown, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, query, where, orderBy, setDoc, doc, getDoc, serverTimestamp, runTransaction, increment, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, registerSecondaryUser, auth } from '@/src/lib/firebase';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ALL_SUBJECTS } from '../constants';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface AppUser {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  role: 'admin' | 'student' | 'staff';
  grade?: string;
  stream?: string;
  department?: string;
  subject?: string;
  gender?: string;
  age?: number;
  sid?: string;
  pass?: string;
  isOfflineDraft?: boolean;
  year?: string;
  address?: string;
  studentId?: string;
  createdAt?: any;
  lastSeen?: any;
  currentActivity?: string;
  activeExamTitle?: string;
  activeExamId?: string;
}

export default function UserManagement({ initialView }: { initialView?: 'student' | 'staff' } = {}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [offlineUsers, setOfflineUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('offline_registrations');
    return saved ? JSON.parse(saved) : [];
  });
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return localStorage.getItem('is_offline_mode') === 'true';
  });
  const [syncing, setSyncing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [activeUserView, setActiveUserView] = useState<'student' | 'staff'>(initialView || 'student');
  const { language } = useLanguage();

  useEffect(() => {
    if (initialView) {
      setActiveUserView(initialView);
    }
  }, [initialView]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidSearchQuery, setSidSearchQuery] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStyleTab, setPrintStyleTab] = useState<'cards' | 'table'>('cards');

  const isOnlineUser = (usr: AppUser) => {
    const lastSeen = usr.lastSeen?.toDate ? usr.lastSeen.toDate() : (usr.lastSeen ? new Date(usr.lastSeen) : null);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeen && lastSeen > fiveMinAgo;
  };

  const getLastSeenText = (usr: any) => {
    if (!usr.lastSeen) return 'Never';
    const date = usr.lastSeen?.toDate ? usr.lastSeen.toDate() : new Date(usr.lastSeen);
    
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 0) return 'Just now';
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Persist offline configurations
  useEffect(() => {
    localStorage.setItem('offline_registrations', JSON.stringify(offlineUsers));
  }, [offlineUsers]);

  useEffect(() => {
    localStorage.setItem('is_offline_mode', isOfflineMode ? 'true' : 'false');
  }, [isOfflineMode]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student' as 'admin' | 'student' | 'staff',
    grade: '12',
    stream: 'natural',
    department: '',
    subject: '',
    gender: 'male',
    age: '18',
    address: '',
    year: '2018 E.C',
    studentId: ''
  });

  const [lastRegistered, setLastRegistered] = useState<{name: string, username: string, pass: string} | null>(null);

  const generateSid = async (role: string) => {
    try {
      const counterDocName = 
        role === 'student' ? 'studentCounter' : 
        role === 'staff' ? 'staffCounter' :
        'adminCounter';
      const counterRef = doc(db, 'metadata', counterDocName);
      let nextId = 1;
      
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (counterDoc.exists()) {
          nextId = counterDoc.data().count + 1;
          transaction.update(counterRef, { count: nextId });
        } else {
          transaction.set(counterRef, { count: 1 });
        }
      });
      
      const prefix = 
        role === 'student' ? 'STD' : 
        role === 'staff' ? 'STF' :
        'ADM';
      
      // Staff gets 6 digits (STF000001), others get 5 digits (STD00001, ADM00001)
      const padLength = role === 'staff' ? 6 : 5;
      const numPart = nextId.toString().padStart(padLength, '0');
      const sid = `${prefix}${numPart}`;
      const pass = sid; // Password is exactly the same as the SID (e.g. STD00001)
      return { sid, pass };
    } catch (err) {
      console.error("Counter transaction failed", err);
      const rand = Math.floor(10000 + Math.random() * 89999).toString();
      const prefix = role === 'student' ? 'STD' : role === 'staff' ? 'STF' : 'ADM';
      return { sid: `${prefix}${rand}`, pass: `${prefix}${rand}` };
    }
  };

  const fetchUsers = async () => {
    // Handled dynamically by the real-time onSnapshot listener below.
  };

  useEffect(() => {
    let q = query(collection(db, 'users'));
    if (roleFilter !== 'all' && roleFilter !== 'no-sid') {
      q = query(collection(db, 'users'), where('role', '==', roleFilter));
    }
    
    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      
      if (roleFilter === 'no-sid') {
        userList = userList.filter(u => !u.sid);
      }
      
      userList.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to users collection:", error);
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roleFilter]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingUser) {
        if (editingUser.isOfflineDraft) {
          // Editing offline draft locally in localStorage
            setOfflineUsers(prev => prev.map(u => u.id === editingUser.id ? {
              ...u,
              fullName: formData.name.trim(),
              role: formData.role,
              grade: formData.role === 'student' ? formData.grade : null,
              stream: formData.role === 'student' ? formData.stream : null,
              department: (formData.role === 'staff' || formData.role === 'admin') ? formData.department || null : null,
              subject: (formData.role === 'staff' || formData.role === 'admin') ? formData.subject || null : null,
              studentId: formData.role === 'student' ? formData.studentId : null,
              gender: formData.gender,
              age: parseInt(formData.age) || 18,
              address: formData.address || null,
              year: formData.year,
            } : u));
          setSuccess(`Offline draft for ${formData.name} updated locally!`);
          setEditingUser(null);
        } else {
          // Edit live user
          const updateData = {
            fullName: formData.name.trim(),
            role: formData.role,
            grade: formData.role === 'student' ? formData.grade : null,
            stream: formData.role === 'student' ? formData.stream : null,
            department: (formData.role === 'staff' || formData.role === 'admin') ? formData.department || null : null,
            subject: (formData.role === 'staff' || formData.role === 'admin') ? formData.subject || null : null,
            studentId: formData.role === 'student' ? formData.studentId : null,
            gender: formData.gender,
            age: parseInt(formData.age) || 18,
            address: formData.address || null,
            year: formData.year,
            updatedAt: serverTimestamp(),
          };

          await setDoc(doc(db, "users", editingUser.id), updateData, { merge: true });
          setSuccess(`GALMEEN MILKAA'EERA! Oodeeffannoon ${formData.name} fooyya'ee jira.`);
          setEditingUser(null);
        }
      } else {
        // Registering a new User
        if (isOfflineMode) {
          // OFFLINE REGISTRATION WORKspace ACTIVE
          const tempId = 'OFF_ID_' + Math.random().toString(36).substr(2, 9).toUpperCase();
          const tempSid = (formData.role === 'student' ? 'OFF_STD' : formData.role === 'staff' ? 'OFF_STF' : 'OFF_ADM') + Math.floor(10000 + Math.random() * 90000);
          const tempEmail = formData.email || `${tempSid}@school.exam`;

          const newOfflineUser: AppUser = {
            id: tempId,
            sid: tempSid,
            fullName: formData.name.trim(),
            email: tempEmail,
            role: formData.role,
            grade: formData.role === 'student' ? formData.grade : null,
            stream: formData.role === 'student' ? formData.stream : null,
            department: (formData.role === 'staff' || formData.role === 'admin') ? formData.department || null : null,
            subject: (formData.role === 'staff' || formData.role === 'admin') ? formData.subject || null : null,
            gender: formData.gender,
            age: parseInt(formData.age) || 18,
            address: formData.address || null,
            year: formData.year,
            studentId: formData.role === 'student' ? formData.studentId : null,
            createdAt: new Date().toISOString() as any,
            isOfflineDraft: true
          };

          setOfflineUsers(prev => [newOfflineUser, ...prev]);
          setSuccess(`[OFFLINE DRAFT RECORDED] Saved ${formData.name} offline in browser memory. Press 'Synchronize' to push to Live cloud servers!`);
        } else {
          // LIVE ONLINE REGISTRATION
          console.log("Starting registration process for:", formData.name);
          
          let sid, pass;
          try {
            const sidResult = await generateSid(formData.role);
            sid = sidResult.sid;
            pass = sidResult.pass;
            console.log("Generated SID:", sid);
          } catch (sidErr: any) {
            console.error("SID Generation Error:", sidErr);
            throw new Error(`Permission Denied: Could not generate Student ID. (Internal: metadata update failed). Detail: ${sidErr.message}`);
          }

          const userEmail = formData.email || `${sid}@school.exam`;
          
          let authUser;
          try {
            authUser = await registerSecondaryUser(userEmail, pass);
            console.log("Auth User Created:", authUser.uid);
          } catch (authErr: any) {
            console.error("Auth Registration Error:", authErr);
            throw authErr;
          }
          
          try {
            await setDoc(doc(db, "users", authUser.uid), {
              uid: authUser.uid,
              sid: sid,
              fullName: formData.name.trim(),
              email: userEmail,
              role: formData.role,
              grade: formData.role === 'student' ? formData.grade : null,
              stream: formData.role === 'student' ? formData.stream : null,
              department: (formData.role === 'staff' || formData.role === 'admin') ? formData.department || null : null,
              subject: (formData.role === 'staff' || formData.role === 'admin') ? formData.subject || null : null,
              gender: formData.gender,
              age: parseInt(formData.age) || 18,
              address: formData.address || null,
              year: formData.year,
              studentId: (formData.role === 'student') ? formData.studentId || null : null,
              createdAt: serverTimestamp(),
            });
            console.log("Firestore User Doc Created Successfully for UID:", authUser.uid);
          } catch (dbErr: any) {
            console.error("Firestore User Doc Creation Failed:", dbErr);
            const currentUser = auth.currentUser;
            if (dbErr.code === 'permission-denied') {
              throw new Error(`FIRESTORE PERMISSION DENIED: Admin (${currentUser?.email}) cannot create student record. UID: ${currentUser?.uid}. Please ensure this admin has the 'admin' role in Firestore users collection or is in the rules whitelist.`);
            }
            throw dbErr;
          }

          setLastRegistered({ name: formData.name, username: formData.name.trim(), pass: sid });
          setSuccess(`GALMEEN MILKAA'EERA! ${formData.name} akka ${formData.role}-tti galmaa'ee jira.`);
        }
      }

      setFormData({ 
        name: '', 
        email: '', 
        role: 'student',
        grade: '12', 
        stream: 'natural',
        department: '',
        subject: '',
        gender: 'male',
        age: '18',
        address: '',
        year: '2018 E.C',
        studentId: ''
      });
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      console.error("Full Registration Catch:", err);
      setError(err.message || 'Something went wrong');
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (u.isOfflineDraft) {
      if (!confirm(`Are you sure you want to delete the offline draft for ${u.fullName || u.name}?`)) return;
      setOfflineUsers(prev => prev.filter(usr => usr.id !== u.id));
      setSuccess(`Local offline draft user successfully deleted!`);
      return;
    }

    if (!confirm(`Are you sure you want to delete ${u.fullName || u.name}? This cannot be undone.`)) return;
    
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'users', u.id));
      setSuccess(`User ${u.fullName || u.name} deleted successfully.`);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const normalizeRowKeysAndValues = (rawRow: any) => {
    const clean: any = {};
    for (const key of Object.keys(rawRow)) {
      const normalizedKey = key
        .trim()
        .replace(/^['"\s\uFEFF\t]+|['"\s\uFEFF\t]+$/g, '')
        .toLowerCase();
      
      let val = rawRow[key];
      if (typeof val === 'string') {
        val = val.trim().replace(/^['"\s\uFEFF\t]+|['"\s\uFEFF\t]+$/g, '');
      }
      clean[normalizedKey] = val;
    }

    return {
      fullName: clean.fullname || clean.name || clean['full name'] || '',
      email: clean.email || clean['email address'] || clean.emailaddress || '',
      role: clean.role || 'student',
      grade: clean.grade || '',
      stream: clean.stream || '',
      department: clean.department || '',
      subject: clean.subject || '',
      gender: clean.gender || 'male',
      age: clean.age ? parseInt(clean.age) || 18 : 18,
      address: clean.address || '',
      year: clean.year || '',
    };
  };

  const processImportedRows = async (rows: any[]) => {
    setImportProgress({ current: 0, total: rows.length });
    let successCount = 0;
    let failCount = 0;

    if (isOfflineMode) {
      // Bulk Import completely offline
      const newOfflineList: AppUser[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const normalized = normalizeRowKeysAndValues(row);
        const role = (normalized.role || 'student') as 'admin' | 'student' | 'staff';
        const tempId = 'OFF_ID_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const tempSid = (role === 'student' ? 'OFF_STD' : role === 'staff' ? 'OFF_STF' : 'OFF_ADM') + Math.floor(10000 + Math.random()*90000);
        
        newOfflineList.push({
          id: tempId,
          sid: tempSid,
          fullName: normalized.fullName || 'Anonymous',
          email: normalized.email || `${tempSid}@school.exam`,
          role: role,
          grade: normalized.grade || (role === 'student' ? '12' : undefined),
          stream: normalized.stream || (role === 'student' ? 'natural' : undefined),
          department: normalized.department || ((role === 'staff' || role === 'admin') ? '' : undefined),
          gender: normalized.gender || 'male',
          age: normalized.age || 18,
          address: normalized.address || '',
          year: normalized.year || '2018 E.C',
          isOfflineDraft: true
        });
      }
      setOfflineUsers(prev => [...newOfflineList, ...prev]);
      setSuccess(`Offline Bulk Import finished: ${newOfflineList.length} rows imported locally.`);
      setImporting(false);
      return;
    }

    // Online bulk import using concurrent batches to speed up registration
    const CONCURRENCY_LIMIT = 5; // Process 5 users at a time to avoid rate limits/app exhaustion
    const chunks = [];
    for (let i = 0; i < rows.length; i += CONCURRENCY_LIMIT) {
      chunks.push(rows.slice(i, i + CONCURRENCY_LIMIT));
    }

    let processedCount = 0;
    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(async (row) => {
        const normalized = normalizeRowKeysAndValues(row);
        try {
          const role = (normalized.role || 'student') as 'admin' | 'student' | 'staff';
          const { sid, pass } = await generateSid(role);
          const email = normalized.email || `${sid}@school.exam`;
          const name = normalized.fullName || 'Unknown User';
          
          const authUser = await registerSecondaryUser(email, pass);
          
          await setDoc(doc(db, "users", authUser.uid), {
            uid: authUser.uid,
            sid: sid,
            fullName: name,
            email: email,
            role: role,
            grade: normalized.grade || (role === 'student' ? '12' : null),
            stream: normalized.stream || (role === 'student' ? 'natural' : null),
            department: normalized.department || ((role === 'staff' || role === 'admin') ? '' : null),
            gender: normalized.gender || 'male',
            age: normalized.age || 18,
            address: normalized.address || '',
            year: normalized.year || '2018 E.C',
            createdAt: serverTimestamp(),
          });

          return { success: true };
        } catch (err) {
          console.error('Import failed for row', err);
          return { success: false };
        }
      }));

      const chunkSuccess = results.filter(r => r.success).length;
      successCount += chunkSuccess;
      failCount += (chunk.length - chunkSuccess);
      processedCount += chunk.length;
      setImportProgress({ current: processedCount, total: rows.length });
    }

    setSuccess(`Bulk import finished: ${successCount} successful, ${failCount} failed.`);
    fetchUsers();
    setImporting(false);
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        await processImportedRows(rows);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
        setError(`CSV/Tab Parsing failed: ${err.message}`);
        setImporting(false);
      }
    });
  };

  const handlePasteImport = async () => {
    if (!pastedText.trim()) {
      setError("Maaloo ragaa dura asirratti paste godhaa! Please paste some valid table text first.");
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);

    Papa.parse(pastedText.trim(), {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) {
          setError("Ragaan paste gootan hin barbaadamne. No rows of data were found. Please check format.");
          setImporting(false);
          return;
        }
        await processImportedRows(rows);
        setPastedText('');
        setShowPasteBox(false);
      },
      error: (err) => {
        setError(`Paste Parsing failed: ${err.message}`);
        setImporting(false);
      }
    });
  };

  const downloadTemplate = (isEmpty: boolean, format: 'csv' | 'xlsx' = 'csv') => {
    // Template headers matching all registration form fields precisely
    const headers = ["fullName", "email", "role", "grade", "stream", "department", "subject", "gender", "age", "address", "year", "studentId"];
    const sampleRows = [
      { fullName: "Abbebe Balcha", email: "abbe@school.exam", role: "student", grade: "12", stream: "natural", department: "", subject: "", gender: "male", age: 18, address: "Beri 02", year: "2018 E.C", studentId: "" },
      { fullName: "Chaltu Gammada", email: "chaltu@school.exam", role: "student", grade: "11", stream: "social", department: "", subject: "", gender: "female", age: 17, address: "Beri 05", year: "2018 E.C", studentId: "" },
      { fullName: "Staff Member", email: "staff@school.exam", role: "staff", grade: "", stream: "", department: "Natural Science", subject: "Biology", gender: "male", age: 35, address: "Beri 01", year: "2018 E.C", studentId: "" },
      { fullName: "Admin User", email: "admin@school.exam", role: "admin", grade: "", stream: "", department: "", subject: "", gender: "male", age: 30, address: "Beri HQ", year: "2018 E.C", studentId: "" }
    ];
    
    const data = isEmpty ? [] : sampleRows;

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(data, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BiftuBeriTemplate");
      XLSX.writeFile(wb, isEmpty ? 'biftu_beri_user_template_empty.xlsx' : 'biftu_beri_user_template_sample.xlsx');
    } else {
      const csv = Papa.unparse({ fields: headers, data: data });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', isEmpty ? 'biftu_beri_user_template_empty.csv' : 'biftu_beri_user_template_sample.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadAllRegistry = (format: 'csv' | 'xlsx' = 'csv') => {
    const activeList = combinedUsers.map(usr => ({
      SID: usr.sid || '',
      FullName: usr.fullName || usr.name || '',
      Email: usr.email || '',
      Role: usr.role || 'student',
      Grade: usr.grade || '',
      Stream: usr.stream || '',
      Department: usr.department || '',
      Gender: usr.gender || '',
      Age: usr.age || '',
      Year: usr.year || '',
      Address: usr.address || '',
      StudentID: usr.studentId || '',
      CreatedAt: usr.createdAt?.toDate?.() ? usr.createdAt.toDate().toLocaleString() : 
                 usr.createdAt ? new Date(usr.createdAt).toLocaleString() : ''
    }));

    if (activeList.length === 0) {
      alert("No registered users found to download / Galmeen barattoo hin jiru.");
      return;
    }

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(activeList);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "UserRegistry");
      XLSX.writeFile(wb, `BBS2_Full_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const csv = Papa.unparse(activeList);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `BBS2_Full_Registry_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSyncOfflineUsers = async () => {
    if (offlineUsers.length === 0) {
      alert("No offline draft records found to synchronize / Hojii offline kuufame hin jiru.");
      return;
    }
    
    const confirmSync = window.confirm(`Found ${offlineUsers.length} offline registrations. Do you want to register all of them on the Live Cloud Server now? / Barattoota ${offlineUsers.length} offline qabaman gara live cloud server-tti fe'uu ni barbaadduu?`);
    if (!confirmSync) return;

    setSyncing(true);
    setError(null);
    setSuccess(null);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < offlineUsers.length; i++) {
      const offUsr = offlineUsers[i];
      try {
        const { sid, pass } = await generateSid(offUsr.role);
        const rawEmail = offUsr.email;
        const email = (rawEmail.includes('school.exam') && (rawEmail.includes('OFF_') || rawEmail.includes('off_'))) ? `${sid}@school.exam` : rawEmail;
        
        const authUser = await registerSecondaryUser(email, pass);
        
        await setDoc(doc(db, "users", authUser.uid), {
          uid: authUser.uid,
          sid: sid,
          fullName: offUsr.fullName || offUsr.name || 'Anonymous User',
          email: email,
          role: offUsr.role,
          grade: offUsr.grade || null,
          stream: offUsr.stream || null,
          studentId: offUsr.studentId || null,
          gender: offUsr.gender || 'male',
          age: Number(offUsr.age) || 18,
          address: offUsr.address || null,
          year: offUsr.year || '2018 E.C',
          createdAt: serverTimestamp()
        });
        
        successCount++;
      } catch (err) {
        console.error("Failed synchronizing user:", offUsr, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      if (failCount === 0) {
        setOfflineUsers([]);
        setSuccess(`Synchronization completed fully! ${successCount} users registered live / Cloud-tti fe'ameera!`);
      } else {
        // Keep failed ones
        const failedObjects = offlineUsers.slice(successCount);
        setOfflineUsers(failedObjects);
        setSuccess(`Sync results: ${successCount} registered live, ${failCount} failed. Please try again.`);
      }
      fetchUsers();
    } else {
      setError(`Synchronization failed. Please check network connection.`);
    }
    setSyncing(false);
  };

  const combinedUsers = [...offlineUsers, ...users];
  const filteredCombinedUsers = combinedUsers.filter(usr => {
    // 1. Filter by role
    if (activeUserView === 'student') {
      if (usr.role !== 'student') return false;
    } else {
      if (usr.role !== 'staff' && usr.role !== 'admin') return false;
    }

    if (roleFilter !== 'all') {
      if (roleFilter === 'admin' && usr.role !== 'admin') return false;
      if (roleFilter === 'student' && usr.role !== 'student') return false;
      if (roleFilter === 'staff' && usr.role !== 'staff') return false;
      if (roleFilter === 'no-sid' && usr.sid) return false;
    }

    // Filter students by Grade Level
    if (activeUserView === 'student' && gradeFilter !== 'all') {
      if (String(usr.grade || '').trim() !== String(gradeFilter).trim()) return false;
    }
    
    // 2. Filter by search query
    if (searchQuery.trim() !== '' || sidSearchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const sidQ = sidSearchQuery.toLowerCase();
      
      const nameMatch = searchQuery.trim() !== '' && (usr.fullName || usr.name || '').toLowerCase().includes(q);
      const emailMatch = searchQuery.trim() !== '' && (usr.email || '').toLowerCase().includes(q);
      const sidGlobalMatch = searchQuery.trim() !== '' && (usr.sid || '').toLowerCase().includes(q);
      const gradeMatch = searchQuery.trim() !== '' && (usr.grade || '').toLowerCase().includes(q);
      const streamMatch = searchQuery.trim() !== '' && (usr.stream || '').toLowerCase().includes(q);
      
      const sidDedicatedMatch = sidSearchQuery.trim() !== '' && (usr.sid || '').toLowerCase().includes(sidQ);
      
      if (searchQuery.trim() !== '' && sidSearchQuery.trim() !== '') {
        return (nameMatch || emailMatch || sidGlobalMatch || gradeMatch || streamMatch) && sidDedicatedMatch;
      }
      
      if (sidSearchQuery.trim() !== '') return sidDedicatedMatch;
      return nameMatch || emailMatch || sidGlobalMatch || gradeMatch || streamMatch;
    }
    
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Off-grid Admin Management Dashboard Banner */}
      <div className="bg-slate-950 text-white rounded-[40px] p-6 md:p-10 border-4 border-slate-900 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-3 z-10 max-w-xl text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/30">
            {isOfflineMode ? (
              <>
                <WifiOff size={12} className="text-rose-400 animate-pulse" />
                <span>OFFLINE MODE ACTIVE / DALQA HOJII OFFLINE</span>
              </>
            ) : (
              <>
                <Wifi size={12} className="text-emerald-400 animate-pulse" />
                <span>ONLINE MODE ACTIVE / GOCHAA LIVE CLOUD</span>
              </>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none text-white">
            User Management <span className="text-blue-500">/ Galmeessuu</span>
          </h2>
          <div className="flex items-center gap-2 mt-4">
            <button 
              onClick={() => setActiveUserView('student')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeUserView === 'student' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              Students
            </button>
            <button 
              onClick={() => setActiveUserView('staff')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeUserView === 'staff' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              Staff & Admins
            </button>
          </div>
        </div>
          
          {offlineUsers.length > 0 && (
            <div className="inline-block p-1 px-3 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase rounded-lg animate-pulse">
              ⚠️ {offlineUsers.length} records saved locally as offline drafts!
            </div>
          )}

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto z-10">
          <button 
            type="button"
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:scale-105 active:scale-95 border-2 ${
              isOfflineMode 
                ? 'bg-rose-500 border-rose-300 text-white hover:bg-rose-650 shadow-rose-900/10 shadow-lg' 
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white shadow-slate-900/10 shadow-lg'
            }`}
          >
            {isOfflineMode ? <WifiOff size={16} /> : <Wifi size={16} />}
            {isOfflineMode ? "Switch to Live Cloud" : "Record Offline Drafts"}
          </button>

          {offlineUsers.length > 0 && (
            <button 
              type="button"
              disabled={syncing}
              onClick={handleSyncOfflineUsers}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 border-2 border-emerald-300 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-950/10 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync {offlineUsers.length} Drafts
            </button>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-1/2 -right-12 -translate-y-1/2 w-64 h-64 bg-slate-900/45 pointer-events-none rounded-full" />
      </div>

      {/* Global Alerts (error, success, import progress) */}
      {(error || (success && !lastRegistered) || (importing && importProgress.total > 0)) && (
        <div className="space-y-4">
          {error && (
            <div className="p-5 bg-rose-50 border-4 border-slate-900 text-slate-100 bg-slate-950 rounded-[28px] flex items-center gap-3 text-xs font-black text-left shadow-md">
              <AlertCircle size={20} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && !lastRegistered && (
            <div className="p-5 bg-emerald-50 border-4 border-slate-900 text-slate-100 bg-slate-950 rounded-[28px] flex items-center gap-3 text-xs font-black text-left shadow-md">
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {importing && importProgress.total > 0 && (
            <div className="p-6 bg-slate-100 border-4 border-slate-900 rounded-[28px] space-y-3 text-left shadow-md">
              <div className="flex justify-between items-center text-xs font-black text-slate-900 uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  Barattoota galmeessaa jira... / Creating profile accounts...
                </span>
                <span className="font-mono text-sm bg-slate-200 px-3 py-1 rounded-full">{importProgress.current} / {importProgress.total}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden border-2 border-slate-900">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-150" 
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">
                Maaloo obsaan eegaa, galmeen live cloud irra deemaa jira... / Please wait, user accounts registration is currently syncing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Grid for Actions (Search, Downloads, Uploads) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-fade-in">
        {/* Search and Role Filter Cards */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border-4 border-slate-900 flex flex-col justify-between gap-5 text-left">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Quick SID Lookup / SID Barataa</span>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 group-focus-within:scale-110 transition-transform" size={16} />
                <input
                  type="text"
                  placeholder="Enter SID (e.g. STD00001)..."
                  value={sidSearchQuery}
                  onChange={(e) => setSidSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-blue-50/50 border-2 border-blue-600 rounded-xl text-xs font-black text-slate-750 placeholder-blue-300 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Filter by Details / Haala kanaan barbaadi</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by name, grade, or stream..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-750 placeholder-slate-400 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Filters & Roles</span>
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-750 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-sans cursor-pointer"
              >
                <option value="all">All accounts in current view</option>
                <option value="admin">Administrators Only (Adminii)</option>
                <option value="student">Students Only (Barattoota)</option>
                <option value="staff">Staff Only (Hojjetaa)</option>
                <option value="no-sid">Sample data records (No Student ID)</option>
              </select>
            </div>
          </div>
          
          <button 
            type="button"
            disabled={loading}
            onClick={async () => {
              const legacies = users.filter(u => !u.sid && u.role !== 'admin');
              if (legacies.length === 0) {
                alert("No sample records found to clear.");
                return;
              }
              if(!confirm(`Are you sure you want to delete ${legacies.length} sample users who don't have a Student ID (SID)? This will leave only the real students and admins you registered.`)) return;
              
              setLoading(true);
              try {
                await Promise.all(legacies.map(u => deleteDoc(doc(db, 'users', u.id))));
                setSuccess(`Successfully cleared ${legacies.length} sample records.`);
                fetchUsers();
              } catch (err) {
                setError("Failed to clear some samples.");
                console.error(err);
              } finally {
                setLoading(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-55 border-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
          >
            Clear Sample Records
          </button>
        </div>

        {/* Template Downloads & Upload Option Cards */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border-4 border-slate-900 flex flex-col md:flex-row gap-6 items-stretch justify-between text-left">
          <div className="flex-1 space-y-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Templates & Export Box / Gadi Buusi</span>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1">Download formats & student lists</h3>
              <p className="text-xs text-slate-500 font-bold uppercase leading-snug mt-1">
                Download formatted formats to excel, or export all currently registered students of Biftu Beri Secondary School instantly.
              </p>
            </div>
            
            <div className="flex flex-col gap-2.5 pt-1.5">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => downloadTemplate(true, 'xlsx')}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-950 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm text-left justify-start cursor-pointer"
                >
                  <FileDown size={14} className="shrink-0 text-blue-400" />
                  <span>Empty XLSX</span>
                </button>
                <button 
                  type="button"
                  onClick={() => downloadTemplate(true, 'csv')}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-700 transition-all shadow-sm text-left justify-start cursor-pointer"
                >
                  <FileDown size={14} className="shrink-0 text-blue-400" />
                  <span>Empty CSV</span>
                </button>
              </div>
              
              <button 
                type="button"
                onClick={() => downloadTemplate(false, 'xlsx')}
                className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-slate-900 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm w-full text-left justify-start cursor-pointer"
              >
                <Download size={14} className="shrink-0 text-amber-500" />
                <span>Download Sample Template (Excel) / Fakkeenya</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => downloadAllRegistry('xlsx')}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm text-left justify-start cursor-pointer font-sans"
                >
                  <Users size={14} className="shrink-0 text-white" />
                  <span className="flex-1">Download All (Excel)</span>
                </button>
                <button 
                  type="button"
                  onClick={() => downloadAllRegistry('csv')}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-2 border-emerald-600 text-emerald-800 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-sm text-left justify-start cursor-pointer font-sans"
                >
                  <FileDown size={14} className="shrink-0 text-emerald-600" />
                  <span className="flex-1">Download All (CSV)</span>
                </button>
              </div>

              <button 
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-2 border-blue-600 hover:bg-blue-100 text-blue-900 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-sm w-full text-left justify-start cursor-pointer font-sans"
              >
                <FileText size={14} className="shrink-0 text-blue-600 animate-pulse" />
                <span className="flex-1">Print Student Login Cards / Kaardii Seensaa ({filteredCombinedUsers.length})</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-3 min-w-[200px]">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleBulkImport}
            />
            <button 
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 border-2 border-dashed border-slate-300 hover:border-slate-900 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
              {importing ? 'Importing...' : 'Bulk Import CSV'}
            </button>

            <button 
              type="button"
              onClick={() => setShowPasteBox(!showPasteBox)}
              className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                showPasteBox 
                  ? 'bg-amber-500 border-amber-400 text-white shadow-lg' 
                  : 'bg-white border-dashed border-slate-300 hover:border-slate-900 text-slate-900'
              }`}
            >
              <FileText size={16} />
              {showPasteBox ? 'Hide Paste Area' : 'Paste Excel Table'}
            </button>

            <button 
              type="button"
              onClick={() => {
                setEditingUser(null);
                setFormData({ 
                  name: '', 
                  email: '', 
                  role: 'student',
                  grade: '12', 
                  stream: 'natural',
                  department: '',
                  subject: '',
                  gender: 'male',
                  age: '18',
                  address: '',
                  year: '2018 E.C',
                  studentId: ''
                });
                setShowForm(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-100 hover:scale-[1.03]"
            >
              <UserPlus size={18} />
              Register Single User
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPasteBox && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white rounded-3xl border-4 border-slate-900 p-6 space-y-4 text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">Direct Excel/TSV Paste Tool</span>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Kopii keessan asirratti fidadha / Paste Copied Spreadsheet Cells</h4>
              </div>
              <button 
                onClick={() => setShowPasteBox(false)}
                className="text-xs font-black uppercase text-slate-400 hover:text-red-500 cursor-pointer"
              >
                Hide
              </button>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-bold uppercase">
              Kopii gootanii asirratti paste gochuun (Tab-Separated or CSV) barattoota dachaatti galmeessi. Maqaa, email, gahee, darsa, stream, saala, umrii, fi waggaa haala kanaan kaa'aa:<br/>
              <code className="block bg-slate-50 p-3 rounded-xl font-mono text-[10px] text-blue-600 border border-slate-200 mt-2 whitespace-pre leading-normal overflow-x-auto select-all">
                {"fullName\temail\trole\tgrade\tstream\tgender\tage\tyear\n"}
                {"Abbebe Balcha\tabbe@test.com\tstudent\t12\tnatural\tmale\t18\t2018 E.C\n"}
                {"Chaltu Gammada\t\tstudent\t11\tsocial\tfemale\t17\t2018 E.C"}
              </code>
            </p>

            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="fullName	email	role	grade	stream	gender	age	year..."
              className="w-full p-4 border-2 border-slate-200 focus:border-slate-900 rounded-2xl font-mono text-xs font-semibold leading-relaxed outline-none transition-all placeholder:text-slate-300 bg-slate-50/50"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPastedText('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all"
              >
                Clear / Qulqulleessi
              </button>
              <button
                type="button"
                disabled={importing || !pastedText.trim()}
                onClick={handlePasteImport}
                className="px-6 py-3 bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Import Pasted Data / Barattoota Galmeessi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden">
              <form onSubmit={handleRegister} className="p-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {editingUser ? 'Update Profile' : 'New User Registration'}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {editingUser ? `Editing info for ${editingUser.fullName || editingUser.name}` : 'Create a new account with specific role'}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setShowForm(false); setEditingUser(null); }} className="text-slate-300 hover:text-slate-900 transition-colors cursor-pointer text-sm font-bold uppercase tracking-widest">CLOSE</button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block pl-1">Full Name</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                        placeholder="e.g. Abebe Balcha"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block pl-1">Email / Username</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="email"
                        disabled={!!editingUser}
                        value={formData.email || ''}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all disabled:opacity-50"
                        placeholder="Optional, leave blank to auto-generate"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block pl-1">Student ID / UID Link</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text"
                        value={formData.studentId || ''}
                        onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all font-mono"
                        placeholder="e.g. 52312 or student UID"
                      />
                    </div>
                    {formData.role === 'student' && <p className="text-[9px] text-slate-400 px-2">Optional secondary ID for school records.</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Role</label>
                    <select 
                      value={formData.role || 'student'}
                      onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                      className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all font-sans"
                    >
                      <option value="student">Student</option>
                      <option value="staff">Staff / Hojjetaa</option>
                      <option value="admin">Administrator / Adminii</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                    <select 
                      value={formData.gender || 'male'}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  {(formData.role === 'staff' || formData.role === 'admin') && (
                    <div className="space-y-4 lg:col-span-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department / Kutaa Hojii</label>
                        <input 
                          type="text"
                          placeholder="e.g. Natural Science"
                          value={formData.department || ''}
                          onChange={(e) => setFormData({...formData, department: e.target.value})}
                          className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all font-sans"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Specialized Subject / Gosa Barnootaa</label>
                        <select 
                          value={formData.subject || ''}
                          onChange={(e) => setFormData({...formData, subject: e.target.value})}
                          className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all font-sans"
                        >
                          <option value="">Select subject</option>
                          {ALL_SUBJECTS.map(subj => (
                            <option key={subj} value={subj}>{subj}</option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-400 px-2 font-bold uppercase tracking-wider">Hojjetaan kun gosa barnootaa qopheessu danda'u asitti fili.</p>
                      </div>
                    </div>
                  )}

                  {formData.role === 'student' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade</label>
                        <select 
                          value={formData.grade || '12'}
                          onChange={(e) => setFormData({...formData, grade: e.target.value})}
                          className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                        >
                          <option value="9">Grade 9</option>
                          <option value="10">Grade 10</option>
                          <option value="11">Grade 11</option>
                          <option value="12">Grade 12</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stream</label>
                        <select 
                          value={formData.stream || 'natural'}
                          onChange={(e) => setFormData({...formData, stream: e.target.value})}
                          className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                        >
                          <option value="natural">Natural Science</option>
                          <option value="social">Social Science</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Age</label>
                    <input 
                      type="number"
                      value={formData.age || ''}
                      onChange={(e) => setFormData({...formData, age: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</label>
                    <input 
                      type="text"
                      placeholder="e.g. Adama"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                    <input 
                      type="text"
                      value={formData.year || ''}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 border-2 border-transparent focus:border-blue-100 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-xs font-bold">
                    {error}
                  </div>
                )}

                <button 
                  disabled={registering}
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {registering ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {registering ? 'Processing...' : (editingUser ? 'Update User' : 'Create User')}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {success && lastRegistered && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-emerald-50 rounded-[32px] border-2 border-emerald-100 flex flex-col items-center gap-6 text-center shadow-lg shadow-emerald-500/5 max-w-2xl mx-auto mb-10"
        >
          <div className="w-16 h-16 bg-emerald-500 text-white rounded-[24px] flex items-center justify-center shadow-lg shadow-emerald-200">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-emerald-900 uppercase tracking-tight">Registration Complete!</h3>
            <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-widest mt-1">Student: {lastRegistered.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="bg-white p-6 rounded-3xl border border-emerald-100/50 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Student Full Name</span>
              <span className="text-sm font-black text-slate-900 tracking-wider break-all">{lastRegistered.username}</span>
              <p className="text-[9px] text-blue-500 mt-2 font-bold uppercase">(Fayyadamaan kanumaan seena)</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-emerald-100/50 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Student ID (Password)</span>
              <span className="text-sm font-black text-slate-900 font-mono tracking-wider">{lastRegistered.pass}</span>
              <p className="text-[9px] text-emerald-500 mt-2 font-bold uppercase">(Password-ni kanuma)</p>
            </div>
          </div>

          <div className="p-4 bg-emerald-100/50 rounded-2xl w-full text-left">
             <p className="text-[10px] font-bold text-emerald-800 uppercase mb-2">Instruction for Student:</p>
             <p className="text-[11px] text-emerald-900 font-medium leading-relaxed">
               1. Go to the login page.<br/>
               2. Type your <strong className="font-black">Full Name</strong> exactly as above.<br/>
               3. Type your Student ID <strong className="font-black">({lastRegistered.pass})</strong> as the password.
             </p>
          </div>

          <button 
            onClick={() => { setSuccess(null); setLastRegistered(null); }}
            className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors"
          >
            Finished & Close
          </button>
        </motion.div>
      )}

      <div className="bg-white rounded-[40px] border-4 border-slate-900 overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-6 bg-slate-50 border-b-4 border-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left">
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase">Records Table ({filteredCombinedUsers.length})</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Filtered views showing student and staff demographics.</p>
          </div>
        </div>

        {/* Grade Level filter category view for students */}
        {activeUserView === 'student' && (
          <div className="flex flex-wrap items-center gap-3 p-6 bg-slate-100/60 border-b-4 border-slate-900 text-left animate-fade-in">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 pr-4 mb-2 sm:mb-0">
              Grade Level / Sadarkaa Kutaa:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', labelEn: 'All Students', labelOm: 'Hunduma Barattootaa' },
                { value: '9', labelEn: 'Grade 9', labelOm: 'Kutaa 9' },
                { value: '10', labelEn: 'Grade 10', labelOm: 'Kutaa 10' },
                { value: '11', labelEn: 'Grade 11', labelOm: 'Kutaa 11' },
                { value: '12', labelEn: 'Grade 12', labelOm: 'Kutaa 12' }
              ].map(gOpt => {
                const count = combinedUsers.filter(u => u.role === 'student' && (gOpt.value === 'all' || String(u.grade || '').trim() === gOpt.value)).length;
                const isActive = gradeFilter === gOpt.value;
                return (
                  <button
                    key={gOpt.value}
                    type="button"
                    onClick={() => setGradeFilter(gOpt.value)}
                    className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 cursor-pointer flex items-center gap-2.5 border-2 ${
                      isActive 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10' 
                        : 'bg-white border-slate-900 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{language === 'en' ? gOpt.labelEn : gOpt.labelOm}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                      isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-505'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-4 border-slate-900">
                <th className="px-8 py-5 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">User Name / Umrii</th>
                <th className="px-8 py-5 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Role</th>
                <th className="px-8 py-5 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Status & Activity</th>
                <th className="px-8 py-5 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Contact</th>
                <th className="px-8 py-5 text-xs font-black text-slate-900 uppercase tracking-widest border-r-2 border-slate-200">Academic Info</th>
                <th className="px-8 py-5 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Actions (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-200">
              {filteredCombinedUsers.map(usr => (
                <tr key={usr.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6 border-r-2 border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="font-extrabold text-slate-900 text-sm">{usr.fullName || usr.name || 'Anonymous'}</div>
                      {usr.isOfflineDraft && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 border border-red-300 text-red-700 text-[8px] font-black uppercase rounded-lg shadow-xs animate-pulse">
                          <WifiOff size={10} className="inline mr-0.5 text-red-500" />
                          Offline Draft
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {usr.sid || (usr.role === 'admin' ? 'ADMIN' : usr.id.slice(0, 8))}</div>
                    {(usr.age || usr.address) && (
                      <div className="text-[10px] text-slate-700 bg-slate-100 px-2 py-1 rounded-md inline-block mt-2 font-bold uppercase tracking-wider">
                        {usr.age && <span className="font-black">Age: {usr.age} </span>}
                        {usr.address && <span className="font-black">• Address: {usr.address}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 border-r-2 border-slate-200">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 shadow-sm ${
                      usr.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-300' : 
                      usr.role === 'staff' ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 
                      'bg-blue-100 text-blue-700 border-blue-300'
                    }`}>
                      {usr.role}
                    </span>
                  </td>
                  <td className="px-8 py-6 border-r-2 border-slate-200">
                    <div className="flex flex-col gap-1.5 text-left">
                      {isOnlineUser(usr) ? (
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border border-emerald-400 shadow-sm animate-pulse block" />
                          <span>Online</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 bg-slate-200 rounded-full border border-slate-300 block" />
                          <span>Offline</span>
                        </div>
                      )}
                      
                      {/* Current Activity details */}
                      {(usr as any).currentActivity === 'working_exam' && (usr as any).activeExamTitle ? (
                        <div className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-[9px] font-bold text-rose-700 animate-pulse uppercase leading-snug max-w-[200px]">
                          <span className="block font-black text-[8px] text-rose-500 mb-0.5">✍️ TAKING EXAM:</span>
                          <span className="block truncate font-extrabold text-rose-800">{(usr as any).activeExamTitle}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 font-medium uppercase font-mono tracking-wider">
                          Seen: {getLastSeenText(usr)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-extrabold text-slate-800 border-r-2 border-slate-200">{usr.email || 'N/A'}</td>
                  <td className="px-8 py-6 border-r-2 border-slate-200">
                    {usr.role === 'student' ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg border border-blue-200 font-sans">G{usr.grade}</span>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-lg border border-slate-200">{usr.stream}</span>
                      </div>
                    ) : (usr.role === 'staff' || usr.role === 'admin') ? (
                      <div className="flex flex-col gap-1">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-200 font-sans w-fit">{usr.department || 'No Dept'}</span>
                        {usr.subject && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200 font-sans w-fit">{usr.subject}</span>}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs font-bold">—</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingUser(usr);
                        setFormData({
                          name: usr.fullName || usr.name || '',
                          email: usr.email,
                          role: usr.role,
                          grade: usr.grade || '12',
                          stream: usr.stream || 'natural',
                          department: usr.department || '',
                          subject: usr.subject || '',
                          gender: usr.gender || 'male',
                          age: (usr.age || 18).toString(),
                          address: usr.address || '',
                          year: usr.year || '2018 E.C',
                          studentId: usr.studentId || ''
                        });
                        setShowForm(true);
                      }}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-300 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                    >
                      Edit
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleDeleteUser(usr)}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-300 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCombinedUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-black uppercase tracking-widest text-xs">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[40px] border-4 border-slate-900 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b-4 border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-left">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <GraduationCap className="text-blue-600 animate-bounce" size={24} />
                  <span>Kaardii Seensa Barattootaa ({filteredCombinedUsers.length})</span>
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                  Print & Hand out Student Credentials / Odeeffannoo galmee print godhii kenniif.
                </p>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-white border-2 border-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer font-black text-[10px] uppercase tracking-widest text-slate-700"
              >
                ✕ Close
              </button>
            </div>

            {/* Layout Options Selector */}
            <div className="px-6 py-4 bg-slate-50 border-b-2 border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPrintStyleTab('cards')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    printStyleTab === 'cards'
                      ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-sm'
                      : 'bg-white text-slate-755 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  ✂ Slips Cutouts (Kaardii Muxuxii)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintStyleTab('table')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    printStyleTab === 'table'
                      ? 'bg-slate-900 text-white border-2 border-slate-900 shadow-sm'
                      : 'bg-white text-slate-755 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  📝 Compact List Ledger (Rallii Gabatee)
                </button>
              </div>

              <div className="text-left max-w-sm">
                <p className="text-[10px] text-slate-400 font-black uppercase">Filtara Ammaa (Current Filter):</p>
                <p className="text-xs text-slate-800 font-bold uppercase truncate">
                  Role: <span className="text-blue-600">{roleFilter}</span> | Search: <span className="text-amber-600">{searchQuery || 'None'}</span>
                </p>
              </div>
            </div>

            {/* Main Preview Container */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 text-left min-h-[400px]">
              {filteredCombinedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-4 border-dashed border-slate-300">
                  <p className="text-sm text-slate-400 font-black uppercase tracking-widest">Barataa qorumsa filatame hin jiru / No students found.</p>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">Check search filter or selected grade levels in background.</p>
                </div>
              ) : printStyleTab === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCombinedUsers.map((usr, i) => (
                    <div 
                      key={usr.id + i} 
                      className="p-4 border-3 border-dashed border-slate-300 hover:border-slate-900 hover:scale-[1.01] transition-all rounded-3xl bg-white space-y-4 relative overflow-hidden flex flex-col justify-between"
                    >
                      {/* Card Header */}
                      <div className="flex items-center gap-3 border-b-2 pb-2.5 border-slate-100">
                        <div className="p-2 bg-slate-900 text-white rounded-xl shadow-sm">
                          <GraduationCap size={18} />
                        </div>
                        <div className="leading-none text-left">
                          <h4 className="font-black text-[10px] text-slate-900 uppercase tracking-tight">Biftu Beri Secondary School</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">M.B. QOPHAAYINAA BIFTU BARII</p>
                        </div>
                      </div>

                      {/* Card Student Account info */}
                      <div className="space-y-2.5 text-xs flex-1">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Maqaa Guutuu / Name</span>
                          <span className="font-extrabold text-slate-900 text-sm tracking-wide">{usr.fullName || usr.name || 'Anonymous'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Email / Username</span>
                          <span className="font-extrabold text-blue-600 font-mono text-[11px] break-all select-all">{usr.email || `${usr.sid}@school.exam`}</span>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2.5 border-2 border-amber-200 shadow-sm">
                          <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block leading-none mb-1">PASSWORD (STUDENT ID) / JECHA ICCIITII</span>
                          <span className="font-black text-slate-900 font-mono text-xs select-all tracking-widest">{usr.sid || (usr.role === 'admin' ? 'ADMIN' : usr.id.slice(0, 8))}</span>
                        </div>

                        <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase pt-1 border-t-2 border-slate-100/50">
                          <span>Grade: G{usr.grade || '12'} ({usr.stream || 'Natural'})</span>
                          <span>Year: {usr.year || '2018 E.C'}</span>
                        </div>
                      </div>

                      {/* Card Footer Scissors */}
                      <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest text-center border-t-2 border-slate-150 pt-2 flex items-center justify-center gap-1.5 mt-2">
                        <span>✂ Kuti (Cut Here)</span>
                        <span>•</span>
                        <span>www.biftuberi.exam</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border-4 border-slate-900 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b-4 border-slate-900 font-sans">
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase border-r border-slate-200">S.No</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase border-r border-slate-200">FullName / Maqaa Guutuu</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase border-r border-slate-200">Email/Username</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase border-r border-slate-200">Password (ID)</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-900 uppercase">Academic Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredCombinedUsers.map((usr, index) => (
                        <tr key={usr.id + '_tbl_' + index} className="hover:bg-slate-50/50 text-xs">
                          <td className="px-6 py-4 font-mono font-bold text-slate-400 border-r border-slate-250">{index + 1}</td>
                          <td className="px-6 py-4 font-extrabold text-slate-900 border-r border-slate-250">{usr.fullName || usr.name || 'Anonymous'}</td>
                          <td className="px-6 py-4 font-mono text-slate-600 border-r border-slate-250 select-all">{usr.email || `${usr.sid}@school.exam`}</td>
                          <td className="px-6 py-4 font-mono font-black text-blue-700 select-all bg-blue-50/20 border-r border-slate-250">{usr.sid || (usr.role === 'admin' ? 'ADMIN' : usr.id.slice(0, 8))}</td>
                          <td className="px-6 py-4 font-bold text-slate-600">Grade {usr.grade || '12'} ({usr.stream || 'Natural'})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t-4 border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500 font-bold uppercase max-w-lg text-left leading-normal font-sans">
                Barattoonni gaafa seenan Maqaa ykn Email isaanii olii fi Password (Student ID fakkeenya <strong className="text-slate-900 font-black">STD00123</strong>) galchuun lixu.
              </p>
              <div className="flex gap-3 w-full sm:w-auto shrink-0">
                <button 
                  onClick={() => window.print()}
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] border-3 border-transparent active:scale-[0.98] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  <span>PRINT / GALII BUUSI (PRINT WINDOW)</span>
                </button>
              </div>
            </div>
          </div>

          {/* HIDDEN PRINT WRAPPER FOR NATIVE SYSTEM DIALOG - DESIGNED TO SHADOW EVERYTHING ELSE IN THE VIEW */}
          <div className="printable-login-slip hidden print:block text-slate-900 bg-white p-2">
            <div className="text-center pb-6 border-b-2 border-slate-900 mb-6">
              <h1 className="text-2xl font-black uppercase tracking-tight">MANA BARUMSAA QOPHAAYINAA BIFTU BARII</h1>
              <h2 className="text-md font-bold uppercase tracking-widest text-slate-600 mt-1">BIFTU BERI SECONDARY SCHOOL STUDENT REGISTRY</h2>
              <p className="text-[10px] uppercase font-mono mt-2 italic">Date Printed: {new Date().toLocaleDateString('en-US')} • Total Slips: {filteredCombinedUsers.length}</p>
            </div>

            {printStyleTab === 'cards' ? (
              <div className="grid grid-cols-2 gap-4">
                {filteredCombinedUsers.map((usr, i) => (
                  <div 
                    key={'print_card_' + usr.id + '_' + i} 
                    className="p-4 border-2 border-dashed border-slate-400 rounded-xl bg-white space-y-3 relative overflow-hidden flex flex-col justify-between"
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                  >
                    {/* Slip Header */}
                    <div className="flex items-center gap-2 border-b pb-1.5 border-slate-200">
                      <div className="p-1 bg-slate-900 text-white rounded">
                        <GraduationCap size={16} />
                      </div>
                      <div className="leading-none text-left">
                        <h4 className="font-black text-[9px] text-slate-900 uppercase">Biftu Beri Secondary School</h4>
                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">M.B. QOPHAAYINAA BIFTU BARII</p>
                      </div>
                    </div>

                    {/* Account specifications */}
                    <div className="space-y-1.5 text-xs text-left">
                      <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-0.5 font-sans">FullName / Maqaa Guutuu:</span>
                        <span className="font-extrabold text-slate-900 truncate block text-sm">{usr.fullName || usr.name || 'Anonymous'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-0.5 font-sans">Email / Username:</span>
                        <span className="font-extrabold text-slate-900 font-mono text-[10px] block truncate">{usr.email || `${usr.sid}@school.exam`}</span>
                      </div>
                      <div className="bg-slate-100 p-1.5 rounded border border-slate-300">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block leading-none mb-0.5 font-sans font-sans">Password / Jecha Icciitii:</span>
                        <span className="font-black text-slate-900 font-mono text-[11px] tracking-wider block">{usr.sid || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[7px] text-slate-500 font-bold uppercase pt-1 border-t border-slate-200">
                      <span>Grade {usr.grade || '12'} ({usr.stream || 'Natural'})</span>
                      <span>Year: {usr.year || '2018 E.C'}</span>
                    </div>

                    {/* Cutout details */}
                    <div className="text-[7px] text-slate-400 font-bold uppercase text-center border-t border-slate-100 pt-1 flex items-center justify-center gap-1">
                      <span>✂ Kuti (Cut Here)</span>
                      <span>•</span>
                      <span>www.biftuberi.exam</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-400 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-900 text-[10px] font-bold">
                      <th className="px-4 py-2 border-r border-slate-300">S.No</th>
                      <th className="px-4 py-2 border-r border-slate-300">FullName / Maqaa Guutuu</th>
                      <th className="px-4 py-2 border-r border-slate-300">Email/Username</th>
                      <th className="px-4 py-2 border-r border-slate-300">Password (ID)</th>
                      <th className="px-4 py-2">Academic Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-[10px]">
                    {filteredCombinedUsers.map((usr, index) => (
                      <tr key={'print_tbl_' + usr.id + '_' + index} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td className="px-4 py-2 font-mono text-slate-400 border-r border-slate-200">{index + 1}</td>
                        <td className="px-4 py-2 font-bold text-slate-900 border-r border-slate-200">{usr.fullName || usr.name || 'Anonymous'}</td>
                        <td className="px-4 py-2 font-mono text-slate-700 border-r border-slate-200">{usr.email || `${usr.sid}@school.exam`}</td>
                        <td className="px-4 py-2 font-mono font-black text-slate-900 border-r border-slate-200 bg-slate-50">{usr.sid || (usr.role === 'admin' ? 'ADMIN' : usr.id.slice(0, 8))}</td>
                        <td className="px-4 py-2 font-semibold text-slate-600">Grade {usr.grade || '12'} ({usr.stream || 'Natural'})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
