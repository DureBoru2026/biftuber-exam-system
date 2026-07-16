import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { UserRole, GradeLevel, AcademicStream } from '@/src/types';
import { ShieldCheck, User as UserIcon, Check, Atom, GraduationCap, Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [role, setRole] = useState<UserRole>('student');
  const [grade, setGrade] = useState<GradeLevel>('12');
  const [stream, setStream] = useState<AcademicStream>('natural');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [name, setName] = useState(user?.displayName || '');
  const [school, setSchool] = useState('Biftu Beri Secondary School');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const adminEmails = [
    'jemalfano030@gmail.com', 
    'jemalfan030@gmail.com',
    'jemalict2@gmail.com', 
    'jemalict@school.com', 
    'admint@bbschool.com', 
    'admin@bbschool.com',
    'jemalfano030@bbschool.com',
    'jemalict2@bbschool.com',
    'jemalict@gmail.com'
  ];

  useEffect(() => {
    if (user?.email && adminEmails.includes(user.email.toLowerCase())) {
      setRole('admin');
    } else {
      setRole('student');
    }
  }, [user]);

  const isApprovedEmail = !!(user?.email && adminEmails.includes(user.email.toLowerCase()));

  useEffect(() => {
    const demoRole = location.state?.demoRole as UserRole | undefined;
    if (demoRole) {
      setRole(demoRole);
      setName(demoRole === 'admin' ? 'Demo Admin' : 'Demo Student');
      if (demoRole === 'student') {
        setGrade('12');
        setStream('natural');
      }
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: name,
        email: user.email || null,
        role,
        grade: role === 'student' ? grade : null,
        stream: role === 'student' ? ((grade === '11' || grade === '12') ? stream : 'general') : 'general',
        department: (role === 'admin' || role === 'staff') ? department : null,
        subject: (role === 'admin' || role === 'staff') ? subject : null,
        school,
        age: age ? parseInt(age) : null,
        address: address || null,
        createdAt: serverTimestamp(),
      });
      await refreshProfile();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Complete Your Profile</h2>
          <p className="text-slate-500">Tell us a bit about yourself to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Full Name</label>
            <input 
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {isApprovedEmail ? (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">I am a...</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`py-3 px-2 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    role === 'student' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500'
                  }`}
                >
                  <UserIcon size={20} />
                  <span className="font-medium text-[10px] uppercase tracking-wider">Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('staff');
                    if (user?.email && adminEmails.includes(user.email.toLowerCase())) {
                      setRole('admin');
                    }
                  }}
                  className={`py-3 px-2 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    (role === 'staff' || role === 'admin') ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500'
                  }`}
                >
                  <ShieldCheck size={20} />
                  <span className="font-medium text-[10px] uppercase tracking-wider">Staff / Admin</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Access Role Enforcement</span>
              <p className="text-xs text-blue-850 leading-normal font-medium">
                Your account is configured for automatic <strong className="font-black">Student</strong> portal onboarding. Staff privileges require administrator approval and pre-registration.
              </p>
            </div>
          )}

          {role === 'student' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Age / Umrii</label>
                <input 
                  type="number"
                  min="5"
                  max="100"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 18"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Address / Teessoo</label>
                <input 
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Adama"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          )}

          {(role === 'staff' || role === 'admin') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Department</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Natural Science"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Major Subject</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Mathematics"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {role === 'student' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t('common.grade')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {['9', '10', '11', '12'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g as GradeLevel)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        grade === g ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {(grade === '11' || grade === '12') && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{t('common.stream')}</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStream('natural')}
                      className={`py-4 px-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                        stream === 'natural' ? 'border-emerald-600 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <Atom size={24} />
                      <span className="font-bold text-xs uppercase">Natural Sci</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStream('social')}
                      className={`py-4 px-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                        stream === 'social' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'border-slate-100 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <GraduationCap size={24} />
                      <span className="font-bold text-xs uppercase">Social Sci</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">School</label>
            <input 
              type="text"
              required
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? 'Setting up...' : (
              <>
                <Check size={20} />
                {t('common.save')}
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
