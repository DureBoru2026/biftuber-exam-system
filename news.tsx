import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Calendar, ChevronRight, Info, ExternalLink, Megaphone, Plus, Send, Loader2, X, Trash2, Share2, Copy, Check, Download } from 'lucide-react';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { format } from 'date-fns';

export default function News() {
  const { t, language } = useLanguage();
  const { profile, user } = useAuth();
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [posting, setPosting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    category: 'General',
    imageUrl: ''
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const handleDownloadContent = (title: string, text: string, filename: string) => {
    try {
      const blob = new Blob([`${title}\n\n${text}`], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download file", err);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? format(doc.data().date.toDate(), 'MMM dd, yyyy') : 'Recently'
      }));
      setNews(items);
      setLoading(false);
    }, (error) => {
      console.error("News fetch error:", error);
      handleFirestoreError(error, OperationType.GET, 'news');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.summary) return;

    setPosting(true);
    try {
      await addDoc(collection(db, 'news'), {
        ...formData,
        date: serverTimestamp(),
        creatorId: user.uid,
        isNew: true
      });
      setShowForm(false);
      setFormData({ title: '', summary: '', category: 'General', imageUrl: '' });
      alert(t('news.success'));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'news');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'news', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'news');
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Exam Updates': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'System Update': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'School Event': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Urgent': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const categories = ['General', 'Exam Updates', 'System Update', 'School Event', 'Urgent'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-12">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-150"
          >
            <Bell size={12} className="animate-bounce" />
            Live Hub Updates
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-black text-slate-900 uppercase tracking-tight"
          >
            {t('news.title')}
          </motion.h2>
        </div>
        
        {profile?.role === 'admin' && (
          <button 
            onClick={() => setShowForm(true)}
            className="px-8 py-4 bg-slate-950 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 flex items-center gap-2"
          >
            <Plus size={18} />
            {t('news.add')}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handlePost} className="bg-white p-8 md:p-12 rounded-[48px] border-4 border-slate-900 shadow-2xl space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Create Announcement</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Share news with students and staff</p>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="p-3 hover:bg-slate-50 rounded-full text-slate-400"><X size={24}/></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Headline</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-900 transition-all"
                    placeholder="E.g., Physics Exam Published..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-900 transition-all cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Main Narrative / Announcement Content</label>
                <textarea 
                  required
                  rows={5}
                  value={formData.summary}
                  onChange={e => setFormData({...formData, summary: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-medium text-slate-900 transition-all"
                  placeholder={t('news.placeholder')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cover Image Source (Unsplash/Direct URL)</label>
                <input 
                  type="url" 
                  value={formData.imageUrl}
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-900 transition-all"
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>

              <button 
                type="submit"
                disabled={posting}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                {posting ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                Publish to Live News Feed
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-12">
        {/* Pinned Official Announcement */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-[48px] border-4 border-slate-800 shadow-[24px_24px_64px_-16px_rgba(0,0,0,0.4)] p-8 md:p-12 space-y-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600 rounded-full blur-[160px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity" />
          
          <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <span className="px-5 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]"></span>
                Priority Broadcast
              </span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Verification: BBS2 Official
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Calendar size={14} className="text-blue-500" />
              Strategic Portal Bulletin
            </div>
          </div>

          <div className="space-y-8 relative z-10">
            <h3 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tight leading-[0.9]">
              {language === 'en' ? 'Exclusive Student Performance Portal' : 'Gabaasa Barattoota BBS2'}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-6">
                <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-800 backdrop-blur-xl group-hover:border-blue-500/30 transition-colors">
                  <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-3">🇺🇸 Official Directives</p>
                  <p className="text-[16px] text-slate-300 font-medium leading-relaxed italic">
                    "I developed the <span className="text-white font-black underline decoration-blue-500">Biftu Beri Exam System</span> so you can dominate online assessments. Click the mirror link to access EAES national mock trials."
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg">J</div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight leading-none">Jemal Fano Haji</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Lead System Developer</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-800/50 rounded-3xl border border-slate-800 backdrop-blur-xl group-hover:border-amber-500/30 transition-colors">
                  <p className="text-[11px] font-black text-amber-400 uppercase tracking-widest mb-3">🔴 Qajeelfama Afaan Oromoo</p>
                  <p className="text-[16px] text-slate-300 font-medium leading-relaxed italic">
                    "Link kana tuquun irratti shaakala gaafiilee EAES irratti fe'ame hojjachuun ofiif anas akka jajjabeesitan hubachiifna."
                  </p>
                </div>
                <div className="flex gap-3">
                  <a 
                    href="https://ais-pre-nn3fgse3evbdlw2lakdr2l-107893339879.europe-west2.run.app/"
                    target="_blank"
                    className="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all text-center flex items-center justify-center gap-2"
                  >
                    Launch Simulator <ExternalLink size={14} />
                  </a>
                  <button 
                    onClick={() => handleCopy("https://ais-pre-nn3fgse3evbdlw2lakdr2l-107893339879.europe-west2.run.app/", "portal-link")}
                    className="p-4 bg-slate-800 text-white rounded-2xl hover:bg-slate-700 transition-all border border-slate-700"
                  >
                    {copiedId === "portal-link" ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2].map(n => (
              <div key={n} className="h-64 bg-slate-100 rounded-[40px] animate-pulse" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="bg-white p-20 rounded-[48px] text-center border-4 border-dashed border-slate-100">
             <Megaphone className="mx-auto text-slate-200 mb-8" size={64} />
             <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Waiting for new system announcements...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
            {news.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-[40px] border-2 border-slate-100 hover:border-slate-900 transition-all group flex flex-col shadow-sm hover:shadow-2xl overflow-hidden"
              >
                <div className="relative h-64 bg-slate-50 overflow-hidden">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 font-bold"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 font-bold">
                      <Megaphone size={48} className="text-slate-200 group-hover:text-blue-500/20 transition-colors" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-2 shadow-sm ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                  </div>
                </div>
                
                <div className="p-8 flex-1 flex flex-col space-y-6">
                  <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Calendar size={14} className="text-slate-300" />
                    {item.date}
                  </div>
                  
                  <div className="space-y-3 flex-1 text-left">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-[1.1] group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-slate-500 font-medium leading-relaxed line-clamp-3">
                      {item.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest group-hover:gap-4 transition-all">
                      Details <ChevronRight size={14} />
                    </div>
                    {profile?.role === 'admin' && (
                      <button 
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
