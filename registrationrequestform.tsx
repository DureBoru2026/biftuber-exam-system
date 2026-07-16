import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Send, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '@/src/lib/firebase';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface RegistrationRequestFormProps {
  onClose: () => void;
}

export default function RegistrationRequestForm({ onClose }: RegistrationRequestFormProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: '',
    registerType: 'Student',
    department: 'General',
    gradeLevel: '9',
    gender: 'Male',
    age: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    console.log("Starting registration request submission...", formData);
    setSubmitting(true);
    setError(null);

    const ageNum = parseInt(formData.age);
    if (isNaN(ageNum)) {
      setError("Maaloo umrii keessan sirriitti galchaa. (Please enter a valid age.)");
      setSubmitting(false);
      return;
    }

    try {
      const dataToSave = {
        fullName: formData.fullName.trim(),
        registerType: formData.registerType,
        department: formData.department,
        gradeLevel: formData.gradeLevel,
        gender: formData.gender,
        age: ageNum,
        message: formData.message.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      };

      console.log("Saving request to Firestore...", dataToSave);
      await addDoc(collection(db, 'registrationRequests'), dataToSave);
      
      console.log("Request saved successfully!");
      setSuccess(true);
      
      // Keep success message visible for a bit then close
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (err: any) {
      console.error("Submission error details:", err);
      const errorCode = err.code || 'unknown';
      const errorMessage = err.message || 'Unknown error';
      
      let userMsg = "Dadhabbii sirnaa: Ergaan keessan hin ergamne. Maaloo irra deebi'aa yaalaa. (System error: Your request was not sent. Please try again.)";
      
      if (errorCode === 'permission-denied' || errorMessage.includes('permission-denied')) {
        userMsg = "Hayyamni dhowwameera (Permission denied). Maaloo sirreeffama admin qunnamaa.";
      } else if (errorCode === 'unavailable') {
        userMsg = "Sabaaba tajaajilli hin jireef (Service Unavailable). Maaloo daqiiqaa muraasa booda yaalaa.";
      }
      
      setError(`${userMsg} [Error Code: ${errorCode}]`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-5 h-full">
          {/* Left Sidebar decorative */}
          <div className="hidden md:flex md:col-span-2 bg-blue-600 p-8 flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-white rounded-full blur-2xl" />
              <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-white rounded-full blur-2xl" />
            </div>
            
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <UserPlus size={24} />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight leading-none">Create Account Request</h2>
              <p className="text-sm font-medium text-blue-100 leading-relaxed">
                Fill out the form to request a new account. Our admin will process your request and send your credentials to jemalfano030@gmail.com once approved.
              </p>
            </div>

            <div className="pt-8 border-t border-white/20 relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-blue-200" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Portal Security</span>
              </div>
              <p className="text-[9px] font-medium text-blue-200 uppercase tracking-wider">Biftu Beri Secondary School Examination System</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="md:col-span-3 p-8 md:p-12 max-h-[90vh] overflow-y-auto relative">
            {submitting && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">Ergaa Keessan Ergaa Jirra... (Sending Request...)</p>
              </div>
            )}

            {success ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20"
              >
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-emerald-100/50">
                  <CheckCircle2 size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Request Sent!</h3>
                  <p className="text-emerald-600 font-extrabold uppercase text-[10px] tracking-[0.2em]">Milkaalaan Ergamera</p>
                </div>
                <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">
                  Galmeen keessan milkaalaan ergamuun isaa mirkanaa'eera. Gabaabaatti feedback isinii ni ergina. (Your request was sent successfully. We will send you feedback soon.)
                </p>
                <div className="pt-8">
                  <button 
                    onClick={onClose}
                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
                  >
                    Close Window
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Full Name / Maqaa Guutuu</label>
                  <input 
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="e.g. Jemal Fano Haji"
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Register Type</label>
                    <select 
                      value={formData.registerType}
                      onChange={(e) => setFormData(prev => ({ ...prev, registerType: e.target.value }))}
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all text-sm appearance-none"
                    >
                      <option value="Student">Student</option>
                      <option value="Teacher">Teacher</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">3. Department</label>
                    <select 
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all text-sm appearance-none"
                    >
                      <option value="General">General</option>
                      <option value="Social science">Social Science</option>
                      <option value="Natural science">Natural Science</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">4. Grade Level</label>
                    <select 
                      value={formData.gradeLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, gradeLevel: e.target.value }))}
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all text-sm appearance-none"
                    >
                      <option value="9">Grade 9</option>
                      <option value="10">Grade 10</option>
                      <option value="11">Grade 11</option>
                      <option value="12">Grade 12</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">5. Gender</label>
                    <div className="flex gap-2">
                       {['Male', 'Female'].map(g => (
                         <button
                           key={g}
                           type="button"
                           onClick={() => setFormData(prev => ({ ...prev, gender: g }))}
                           className={`flex-1 py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all ${
                             formData.gender === g ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                           }`}
                         >
                           {g}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">6. Age / Umrii</label>
                  <input 
                    required
                    type="number"
                    min="10"
                    max="100"
                    value={formData.age}
                    onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                    placeholder="Enter age"
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">7. Additional Message</label>
                  <textarea 
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Tell us more about your request..."
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all text-sm h-24 resize-none"
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3"
                  >
                    <AlertCircle className="text-rose-600 shrink-0" size={18} />
                    <p className="text-[11px] font-bold text-rose-800 leading-snug">{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Request to Admin
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
