import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogIn, 
  GraduationCap, 
  ShieldCheck, 
  BookOpen, 
  Target, 
  Sparkles, 
  Binary, 
  Languages, 
  Info, 
  Bell, 
  User, 
  UserPlus,
  ChevronRight,
  Globe,
  Mail,
  Phone,
  MapPin,
  Trophy,
  Users,
  Award,
  Compass,
  MessageSquare,
  X,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { signInWithGoogle, signInDemoUser, auth, db } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, serverTimestamp, query, collection, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import About from './About';
import News from './News';
import FAQ from './FAQ';
import AboutBiftuSystemModal from './AboutBiftuSystemModal';
import RegistrationRequestForm from './RegistrationRequestForm';
import schoolLogo from '@/src/assets/images/bbs2_logo_1779651854520.png';
import examBackground from '@/src/assets/images/students_taking_exam_jpg_1779992811202.png';
import studentsIllustration from '@/src/assets/images/school_students_illustration_1780580125740.png';
import communityBg from '@/src/assets/images/bbs_community_bg_1782157440657.jpg';
import techExamBg from '@/src/assets/images/tech_exam_bg_1782160315971.jpg';
import biftuExamBlueprint from '@/src/assets/images/biftu_exam_blueprint_1783272362738.jpg';
import biftuPortalPreview from '@/src/assets/images/biftu_portal_preview_1783274571017.jpg';
import UserManualModal from '@/src/components/UserManualModal';

export default function Landing() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [authError, setAuthError] = React.useState<string | null>(null);
  const [showLoginForm, setShowLoginForm] = React.useState(false);
  const [credentials, setCredentials] = React.useState({ identifier: '', password: '' });
  const [signingIn, setSigningIn] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'hero' | 'about' | 'news'>('hero');
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState(false);
  const [isManualOpen, setIsManualOpen] = React.useState(false);
  const [isRegModalOpen, setIsRegModalOpen] = React.useState(false);
  const isHero = activeTab === 'hero';
  const [activeExams, setActiveExams] = React.useState<any[]>([]);
  const [loadingExams, setLoadingExams] = React.useState(false);
  const [latestNews, setLatestNews] = React.useState<any[]>([]);

  // Live Chat Integration States
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [visitorName, setVisitorName] = React.useState(() => localStorage.getItem('bbs_guest_name') || '');
  const [visitorEmail, setVisitorEmail] = React.useState(() => localStorage.getItem('bbs_guest_email') || '');
  const [chatInitDone, setChatInitDone] = React.useState(() => !!localStorage.getItem('bbs_guest_name'));
  const [chatMessages, setChatMessages] = React.useState<any[]>([]);
  const [chatInput, setChatInput] = React.useState('');
  const [chatSending, setChatSending] = React.useState(false);

  // Sync Live Chat messages in real-time
  React.useEffect(() => {
    if (!isChatOpen) return;
    const currentUid = user?.uid || auth.currentUser?.uid;
    // Auto trigger anonymous login if they are not logged in and not configured yet, so they are logged in.
    if (!currentUid && chatInitDone) {
      signInDemoUser().catch(err => console.error("Auto signin failed:", err));
    }
    if (!currentUid) return;

    const q = query(
      collection(db, 'chats'),
      where('studentId', '==', currentUid),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setChatMessages(list);
    }, (err) => {
      console.error("Error loading chat messages:", err);
    });
    return () => unsubscribe();
  }, [user, isChatOpen, chatInitDone]);

  // Handle setting name and doing background anonymous login
  const handleStartGuestChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) return;
    setChatSending(true);
    try {
      if (!auth.currentUser && !user) {
        await signInDemoUser();
      }
      localStorage.setItem('bbs_guest_name', visitorName.trim());
      localStorage.setItem('bbs_guest_email', visitorEmail.trim());
      setChatInitDone(true);
    } catch (err) {
      console.error("Chat setup failed:", err);
    } finally {
      setChatSending(false);
    }
  };

  // Send message
  const handleSendLandingChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    let currentUid = user?.uid || auth.currentUser?.uid;
    
    setChatSending(true);
    try {
      if (!currentUid) {
        // In case session expired or logged out without establishing guest session
        const tempUser = await signInDemoUser();
        currentUid = tempUser.uid;
      }
      if (!currentUid) return;

      const senderNameVal = user 
        ? (user.email || 'Student')
        : (visitorName.trim() || 'Visitor') + ' (Guest)';
      
      await addDoc(collection(db, 'chats'), {
        studentId: currentUid,
        senderId: currentUid,
        senderName: senderNameVal,
        text: chatInput.trim(),
        createdAt: serverTimestamp()
      });
      setChatInput('');
    } catch (err) {
      console.error("Error sending chat message:", err);
    } finally {
      setChatSending(false);
    }
  };

  React.useEffect(() => {
    const fetchData = async () => {
      if (activeTab !== 'hero') return;
      setLoadingExams(true);
      try {
        const { query, collection, where, getDocs, limit, orderBy } = await import('firebase/firestore');
        
        // Fetch Exams
        const examQ = query(
          collection(db, 'exams'),
          where('status', '==', 'published'),
          limit(3)
        );
        const examSnapshot = await getDocs(examQ);
        setActiveExams(examSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch News
        const newsQ = query(
          collection(db, 'news'),
          orderBy('date', 'desc'),
          limit(3)
        );
        const newsSnapshot = await getDocs(newsQ);
        setLatestNews(newsSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          dateFormatted: d.data().date?.toDate ? format(d.data().date.toDate(), 'MMM dd, yyyy') : 'Recently'
        })));

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoadingExams(false);
      }
    };
    fetchData();
  }, [activeTab]);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (!credentials.identifier || !credentials.password) {
      setAuthError("Maaloo maqaa fayyadamaa fi jecha icciitii guutaa.");
      return;
    }

    setSigningIn(true);
    try {
      let email = '';
      
      // If the identifier doesn't look like an email, it's either a SID or a Full Name
      if (credentials.identifier.includes('@')) {
        email = credentials.identifier;
      } else {
        // Try finding by Full Name (case-insensitive search) or SID
        const { query, collection, getDocs } = await import('firebase/firestore');
        const searchVal = credentials.identifier.trim().toLowerCase();
        
        // We fetch all students (usually small enough for this specific school dashboard)
        // or we could use targeted queries if full name was indexed properly
        const studentsQuery = query(collection(db, 'users'));
        const querySnapshot = await getDocs(studentsQuery);
        
        const foundUser = querySnapshot.docs.find(doc => {
          const data = doc.data();
          const fullName = (data.fullName || data.name || '').toLowerCase();
          const sid = (data.sid || '').toLowerCase();
          const emailPrefix = (data.email || '').split('@')[0].toLowerCase();
          
          if (fullName === searchVal) return true;
          if (sid === searchVal || emailPrefix === searchVal) return true;
          
          // Match normalized variations like STDT0001 or STD0001
          const targetNorm = searchVal.replace(/[^a-z0-9]/g, '');
          const sidNorm = sid.replace(/[^a-z0-9]/g, '');
          const stdtNorm = targetNorm.replace('stdt', 'std');
          const sidStdtNorm = sidNorm.replace('stdt', 'std');
          if (sidNorm && sidNorm === targetNorm) return true;
          if (sidStdtNorm && stdtNorm && sidStdtNorm === stdtNorm) return true;

          // Check if digits match (e.g. 0001 vs 00001 or STDT0001 vs STD00001)
          const searchDigits = searchVal.replace(/\D/g, '');
          const dbDigits = sid.replace(/\D/g, '');
          if (searchDigits && dbDigits && parseInt(searchDigits) === parseInt(dbDigits)) return true;
          
          return false;
        });
        
        if (foundUser) {
          const uData = foundUser.data();
          email = uData.email;
        } else if (credentials.identifier.toUpperCase().startsWith('STD')) {
          email = `${credentials.identifier.toLowerCase()}@school.exam`;
        } else if (credentials.identifier.toUpperCase().startsWith('STF')) {
          email = `${credentials.identifier.toLowerCase()}@school.exam`;
        } else if (credentials.identifier.toUpperCase().startsWith('ADM')) {
          email = `${credentials.identifier.toLowerCase()}@school.exam`;
        } else if (credentials.identifier.toLowerCase() === 'admin') {
          email = 'admin@bbschool.com';
        } else {
          email = credentials.identifier;
        }
      }

      if (!email) {
        throw { code: 'auth/invalid-credential' };
      }

      try {
        await signInWithEmailAndPassword(auth, email, credentials.password);
      } catch (error: any) {
        // If this is the specific requested admin, try to auto-create them if they don't exist
        const isTargetAdmin = (email === 'admin@bbschool.com');
        if (isTargetAdmin && credentials.password === 'admin1bbs') {
           try {
             // If it's operation-not-allowed, the provider is still disabled
             if (error.code === 'auth/operation-not-allowed') {
                setAuthError(`Email/Password login is DISABLED in Firebase. Please enable it in Authentication > Sign-in method in Firebase Console.`);
                return;
             }

             // We attempt to create the account if it's the target admin
             const userCred = await createUserWithEmailAndPassword(auth, email, credentials.password);
             await setDoc(doc(db, 'users', userCred.user.uid), {
               uid: userCred.user.uid,
               fullName: 'System Admin (Biftu Beri)',
                sid: 'ADMIN',
               email: email,
               role: 'admin',
               createdAt: serverTimestamp()
             });
           } catch (createError: any) {
             if (createError.code === 'auth/operation-not-allowed') {
                setAuthError("Email/Password provider is not enabled in Firebase Console (Sign-in method section).");
                return;
             }
             if (createError.code === 'auth/email-already-in-use' || createError.code === 'auth/invalid-credential') {
                setAuthError("Account'ni 'admin@bbschool.com' kanaan dura uumamee jira, garuu password'n isaa dogoggora. Maaloo Firebase Console keessatti (Authentication > Users) password isaa sirreessi ykn delete godhiitii lammata yaali.");
                return;
             }
             setAuthError(`Rakkoon uumame: ${createError.message}`);
             return;
           }
        } else {
           if (error.code === 'auth/invalid-credential') {
              setAuthError("Maqaa fayyadamaa (Name) ykn Jecha Icciitii (Password) dogoggoraati. Maaloo lammata yaalaa.");
              return;
           }
           throw error;
         }
      }
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        const config = (await import('@/firebase-applet-config.json'));
        setAuthError(`Email/Password Authentication is not enabled for project '${config.projectId}'. Please go to Firebase Console > Authentication > Sign-in method and enable 'Email/Password' (not Email Link).`);
      } else if (error.code === 'auth/invalid-email') {
        setAuthError("Email'ni keessan fudhatama hin qabu.");
      } else if (error.code === 'auth/invalid-credential') {
        setAuthError("Maqaa fayyadamaa ykn jecha icciitii dogoggoraati.");
      } else {
        setAuthError("Galeensa irratti rakkoon uumame. Maaloo lammata yaalaa.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  const [signingInGoogle, setSigningInGoogle] = React.useState(false);

  const handleLogin = async () => {
    if (signingInGoogle) return;
    setAuthError(null);
    setSigningInGoogle(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        const config = (await import('@/firebase-applet-config.json'));
        setAuthError(`Domain Not Authorized: "${domain}" is not in the authorized domains list for Firebase project "${config.projectId}". Add it in Firebase Console > Authentication > Settings > Authorized domains.`);
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError("Google Sign-in is not enabled in Firebase. Please go to Firebase Console > Authentication > Sign-in method and enable 'Google'.");
      } else if (error.code === 'auth/internal-error') {
        setAuthError("Google Login encountered an internal error. This often happens in iframes if popups are blocked or the connection is unstable. Try opening the app in a new tab if this persists.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError("Galeensa Google irratti rakkoon uumame. Maaloo lammata yaalaa.");
      }
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleDemoLogin = async (role: 'admin' | 'student') => {
    setAuthError(null);
    try {
      await signInDemoUser();
      navigate('/onboarding', { state: { demoRole: role } });
    } catch (error: any) {
      if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
        setAuthError("Anonymous Authentication is disabled. Please enable it in the Firebase Console (Auth > Sign-in method > Anonymous) to use the Demo login.");
      } else {
        setAuthError("Demo galeensi hin danda'amne. Lammata yaalaa.");
      }
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-500 font-sans selection:bg-blue-100 flex flex-col bg-[#F5F5F4] text-[#0A0A0A]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 transition-colors duration-300 backdrop-blur-md border-b bg-white/80 border-slate-200 text-slate-950 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab('hero')}>
              <div className="relative shrink-0">
                <img 
                  src={schoolLogo} 
                  alt="School Logo" 
                  className="w-14 h-14 object-contain rounded-2xl shadow-lg border-2 border-slate-900 bg-white"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="flex items-center gap-3.5 sm:gap-6 md:gap-8">
               <button onClick={() => setActiveTab('hero')} className={`text-xs sm:text-base font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${activeTab === 'hero' ? 'text-blue-600 underline decoration-4 underline-offset-8' : 'text-slate-950 hover:text-blue-600'}`}>{t('nav.home')}</button>
               <button onClick={() => setActiveTab('about')} className={`text-xs sm:text-base font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${activeTab === 'about' ? 'text-blue-600 underline decoration-4 underline-offset-8' : 'text-slate-950 hover:text-blue-600'}`}>{t('nav.about')}</button>
               <button onClick={() => setActiveTab('news')} className={`text-xs sm:text-base font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${activeTab === 'news' ? 'text-blue-600 underline decoration-4 underline-offset-8' : 'text-slate-950 hover:text-blue-600'}`}>{t('nav.news')}</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'om' : 'en')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl transition-all text-sm font-black uppercase tracking-widest cursor-pointer text-slate-700 hover:bg-slate-100"
            >
              <Languages size={18} />
              <span className="hidden md:inline">{language === 'en' ? 'Afaan Oromoo' : 'English'}</span>
              <span className="inline md:hidden">{language === 'en' ? 'OM' : 'EN'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 pt-36 pb-20 relative overflow-hidden">
        {/* Background Decorative Elements */}
        {activeTab === 'hero' ? (
          <div className="absolute inset-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-blue-50" />
            <img 
              src={examBackground} 
              alt="Students taking exam background" 
              className="w-full h-full object-cover select-none opacity-[0.52] saturate-[1.1] contrast-[1.05]"
              referrerPolicy="no-referrer"
            />
            {/* Soft, glassy radial light-blue wash to guarantee text clarity while exposing the photograph background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,247,252,0.9)_0%,rgba(244,247,252,0.72)_50%,rgba(219,234,254,0.35)_100%)]" />
            
            {/* Elegant glowing background accents */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-300 rounded-full blur-[140px] opacity-40 animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-200 rounded-full blur-[140px] opacity-30" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]" />
          </div>
        ) : (
          <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
             {/* Primary Blurs */}
             <div className="absolute top-[-15%] right-[-10%] w-[60%] h-[60%] bg-blue-100 rounded-full blur-[140px] animate-pulse" />
             <div className="absolute bottom-[-15%] left-[-10%] w-[60%] h-[60%] bg-emerald-50 rounded-full blur-[140px] opacity-60" />
             
             {/* Decorative Grid/Shapes */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
             
             {/* Floating Geometric Orbs */}
             <motion.div 
               animate={{ 
                 y: [0, 40, 0],
                 rotate: [0, 90, 0]
               }}
               transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
               className="absolute top-1/4 left-1/12 w-32 h-32 border-4 border-blue-500/10 rounded-3xl -rotate-12" 
             />
             <motion.div 
               animate={{ 
                 y: [0, -60, 0],
                 rotate: [0, -45, 0]
               }}
               transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
               className="absolute bottom-1/4 right-1/12 w-48 h-48 border-4 border-indigo-500/10 rounded-[48px] rotate-12" 
             />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-6">
          <AnimatePresence mode="wait">
            {activeTab === 'hero' && (
              <motion.div 
                key="hero"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-stretch max-w-6xl mx-auto py-12"
              >
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start text-left">
                  {/* Left Column: Title, Subtitle, Built-By info and Actions */}
                  <div className="w-full space-y-8 flex flex-col items-stretch text-left">
                    {/* Breathtaking, highly-visible School Logo Badge for prominent identification */}
                    <div className="relative overflow-hidden w-full flex flex-col sm:flex-row items-center gap-6 sm:gap-8 bg-white/95 backdrop-blur-lg p-6 sm:p-8 pr-10 rounded-[36px] border-[5px] border-slate-900 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] hover:shadow-[16px_16px_0px_0px_rgba(15,23,42,1)] hover:-translate-y-1 transition-all text-center sm:text-left self-stretch lg:self-start">
                      {/* Dynamic technology background: beautifully positioned on the right and full width on mobile */}
                      <img 
                        src={techExamBg} 
                        alt="Biftu Beri technology decoration background" 
                        className="absolute right-0 top-0 h-full w-full sm:w-[65%] object-cover opacity-50 sm:opacity-85 pointer-events-none select-none transition-all duration-300 z-0"
                        referrerPolicy="no-referrer"
                      />
                      {/* Left-to-right modern gradient overlay to guarantee perfect high-contrast legibility for text while showcasing illustrations on the right */}
                      <div className="absolute inset-0 bg-gradient-to-b sm:bg-gradient-to-r from-white via-white/95 sm:via-white/40 to-transparent pointer-events-none select-none z-[1]" />
                      <div className="absolute left-0 top-0 h-full w-[45%] bg-white pointer-events-none select-none z-[1] hidden sm:block" />
                      <div className="absolute left-[45%] top-0 h-full w-[25%] bg-gradient-to-r from-white to-white/0 pointer-events-none select-none z-[1] hidden sm:block" />

                      <div className="relative z-10 shrink-0 w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center overflow-hidden rounded-3xl border-4 border-slate-900 bg-white shadow-md">
                        <img 
                          src={schoolLogo} 
                          alt="Biftu Beri Secondary School Official Logo" 
                          className="w-full h-full object-cover scale-[1.38]" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full border-2 border-slate-900 animate-pulse z-10">
                          PORTAL
                        </div>
                      </div>
                      <div className="relative z-10 space-y-3 flex-1 select-none">
                        <h4 className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-black uppercase tracking-tight text-slate-900 leading-none drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)]">
                          Biftu Beri Secondary School
                        </h4>
                        <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-start">
                          <span className="text-xs sm:text-sm md:text-base font-black uppercase bg-blue-600 text-white px-2.5 py-1 rounded-lg tracking-wider shadow-sm border border-blue-700">
                            Official Examination Center
                          </span>
                          <span className="text-xs sm:text-sm md:text-base font-bold text-slate-800">•</span>
                          <span className="text-xs sm:text-sm md:text-base font-black uppercase bg-emerald-600 text-white px-2.5 py-1 rounded-lg tracking-wider shadow-sm border border-emerald-700">
                            Oduu fi Qormaata
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-100">
                      <Sparkles size={14} />
                      AI-Powered Examination Platform
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tighter uppercase text-slate-900">
                      {language === 'en' ? <span className="text-blue-600 font-black">Master Your Future.</span> : <span className="text-blue-600 font-black">BOORU KEE MO'ADHU.</span>}
                    </h1>

                    <p className="text-base sm:text-lg text-slate-900 font-bold leading-relaxed">
                      {language === 'en' ? (
                        "Biftu Beri premier EAES preparation platform. Sharpen your skills with national-level mock exams, AI-powered feedback, and real-time analytics."
                      ) : (
                        "Dhaabbata qophii EAES olaanaa Biftuu Barii. Qormaata mookii sadarkaa biyyaaleessaa, yaada-deebii humna namtolochee (AI) kanaan deeggaramee fi xiinxala yeroo-dhugaan dandeettii keessan qaraa."
                      )}
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch gap-6 w-full">
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Built & Developed By</p>
                        <div className="h-full px-6 py-3 bg-white rounded-2xl border border-slate-200 shadow-md flex items-center gap-3 hover:border-blue-400 transition-all hover:scale-[1.02]">
                          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-lg shadow-blue-500/20">JH</div>
                          <span className="text-sm sm:text-base font-black text-blue-600 uppercase tracking-tight">Jemal Fano Haji</span>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Interactive Blueprint</p>
                        <button
                          onClick={() => setIsAboutModalOpen(true)}
                          className="w-full h-full px-6 py-3 bg-slate-900 border-2 border-slate-900 hover:border-blue-600 text-white rounded-2xl shadow-md flex items-center justify-center gap-2.5 hover:bg-slate-800 transition-all hover:scale-[1.02] cursor-pointer text-xs sm:text-sm font-black uppercase tracking-wider"
                          id="trigger_about_blueprint_modal_btn"
                        >
                          <Info size={16} className="text-blue-400 shrink-0" />
                          <span>Explore System Flows</span>
                        </button>
                      </div>
                    </div>

                  <div className="w-full flex flex-col items-stretch gap-6 pt-4">
                    {!showLoginForm ? (
                      <div className="flex flex-col items-stretch gap-6 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                          <div className="flex flex-col items-stretch gap-1.5 w-full">
                            <button
                              onClick={() => setShowLoginForm(true)}
                              className="w-full h-20 inline-flex items-center justify-center gap-3 px-6 bg-green-600 text-white rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-green-200/40 hover:bg-green-700 hover:scale-105 active:scale-95 transition-all uppercase tracking-tight cursor-pointer"
                            >
                              Take Exam <LogIn size={18} />
                            </button>
                            <span className="text-[9px] font-black uppercase text-green-700 tracking-wider text-center animate-pulse">For Students & Teachers</span>
                          </div>
                          
                          <div className="flex flex-col items-stretch gap-1.5 w-full">
                            <button
                              onClick={() => {
                                setCredentials({ identifier: 'admin@bbschool.com', password: '' });
                                setShowLoginForm(true);
                              }}
                              className="w-full h-20 inline-flex items-center justify-center gap-2 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-2 border-blue-500/20 rounded-2xl font-black text-xs sm:text-sm hover:from-blue-700 hover:to-indigo-700 hover:scale-105 active:scale-95 transition-all duration-200 uppercase shadow-lg shadow-blue-500/10 cursor-pointer"
                            >
                              <ShieldCheck size={16} className="text-white shrink-0" />
                              <span>Admin Access</span>
                            </button>
                            <span className="text-[9px] font-black uppercase text-blue-700 tracking-wider text-center">☝️ Admins Only</span>
                          </div>

                          <div className="flex flex-col items-stretch gap-1.5 w-full">
                            <button
                              onClick={() => setIsRegModalOpen(true)}
                              className="w-full h-20 inline-flex items-center justify-center gap-2 px-6 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xs sm:text-sm hover:border-blue-600 hover:text-blue-605 hover:scale-105 active:scale-95 transition-all duration-200 uppercase shadow-lg shadow-slate-200/50 cursor-pointer"
                            >
                              <UserPlus size={16} className="text-blue-600 shrink-0" />
                              <span>Request ID</span>
                            </button>
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider text-center">Form Dialog</span>
                          </div>
                        </div>

                        {/* Beautiful Hint / Guideline Banner for Biftu Beri portal user credentials with image background */}
                        <div className="w-full rounded-[32px] border-4 border-slate-900 overflow-hidden relative shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] bg-white">
                          {/* Background image overlay */}
                          <div className="absolute inset-0 z-0">
                            <img 
                              src={biftuPortalPreview} 
                              alt="Portal Preview Background" 
                              className="w-full h-full object-cover select-none opacity-95 transition-opacity duration-300"
                              referrerPolicy="no-referrer"
                            />
                            {/* Glassmorphism subtle mask to ensure premium contrast for guide text */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/90 via-blue-50/80 to-blue-50/50 backdrop-blur-[1.5px]" />
                          </div>

                          <div className="relative z-10 p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-2.5 border-b border-blue-200/60 pb-3">
                              <span className="p-2 bg-blue-600 text-white rounded-xl block shadow-md">
                                <Info size={18} />
                              </span>
                              <div>
                                <span className="text-xs font-black text-blue-900 uppercase tracking-widest block leading-tight">
                                  Credentials & Access Portal Guide
                                </span>
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                                  Qajeelfama Galmee fi Seensa Sirna Qormaataa
                                </span>
                              </div>
                            </div>

                            <div className="space-y-4 text-xs leading-relaxed">
                              {/* Student / Teacher Segment */}
                              <div className="space-y-1.5 bg-white/60 hover:bg-white/80 transition-all duration-300 p-3.5 rounded-2xl border border-white/80 shadow-sm backdrop-blur-[2px]">
                                <div className="text-[10px] font-black text-green-700 uppercase tracking-wider">
                                  🎓 Users: Students & Teachers / Barattoota fi Barsiisota
                                </div>
                                <div className="space-y-1 pl-3 border-l-2 border-green-500">
                                  <p className="text-slate-800 font-medium">
                                    <strong>EN:</strong> Use your <strong className="font-extrabold text-slate-950">Full Name</strong> (exactly as registered) and your allocated <strong className="font-extrabold text-slate-950">Password</strong> (Staff or Student ID) to sign in.
                                  </p>
                                  <p className="text-slate-700 font-medium">
                                    <strong>OM:</strong> Yoo isin Barataa ykn Barsiisaa sirna qormaataa taatan, maqaa guutuu keessan (akkuma galmeeffametti) fi Password (ID Barataa/Staff) keessan fayyadamuun seenaa.
                                  </p>
                                </div>
                              </div>

                              {/* Admin Warning segment */}
                              <div className="space-y-1.5 bg-white/60 hover:bg-white/80 transition-all duration-300 p-3.5 rounded-2xl border border-white/80 shadow-sm backdrop-blur-[2px]">
                                <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                  ☝️ Administrator Warning: Admin Access / Qooda Bulchitootaa
                                </div>
                                <div className="space-y-1 pl-3 border-l-2 border-amber-500">
                                  <p className="text-slate-800 font-medium">
                                    <strong>EN:</strong> This button is strictly restricted to Biftu Beri portal administrators. Unauthorized login attempts are tracked.
                                  </p>
                                  <p className="text-slate-700 font-medium">
                                    <strong>OM:</strong> Yoo admin taate qofa asiin seeni. Qoodni kun dhuunfaan bulchitoota sirnichaa qofaani!
                                  </p>
                                </div>
                              </div>

                              {/* Request Account guide segment */}
                              <div className="space-y-1.5 bg-white/60 hover:bg-white/80 transition-all duration-300 p-3.5 rounded-2xl border border-white/80 shadow-sm backdrop-blur-[2px]">
                                <div className="text-[10px] font-black text-blue-700 uppercase tracking-wider">
                                  📝 Request Account Guide / Akkaataa Galmeessaa
                                </div>
                                <div className="space-y-1 pl-3 border-l-2 border-blue-500">
                                  <p className="text-slate-800 font-medium">
                                    <strong>EN:</strong> To get registered, click <strong className="text-blue-700">"Request Account"</strong> to open a pop-up window. Fill out your details in the form, and submit it directly to our administration for portal enrollment.
                                  </p>
                                  <p className="text-slate-700 font-medium">
                                    <strong>OM:</strong> Sisteemicha irratti akka si galmeessinuuf, akkaawuntii argachuu yoo barbaadde as cuqaasuun window siif banamu irratti foormii guutuun nuuf ergi.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md bg-white p-8 rounded-[40px] border-2 border-slate-200 shadow-xl text-left"
                      >
                        <form onSubmit={handleCredentialLogin} className="w-full space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                              {['admin', 'admin@bbschool.com'].includes(credentials.identifier.trim().toLowerCase()) ? 'Admin Email / Imeelii' : 'Student Full Name / Maqaa Guutuu'}
                            </label>
                            <input 
                              required
                              type="text"
                              value={credentials.identifier}
                              onChange={(e) => setCredentials(prev => ({ ...prev, identifier: e.target.value }))}
                              placeholder={['admin', 'admin@bbschool.com'].includes(credentials.identifier.trim().toLowerCase()) ? 'admin@bbschool.com' : 'e.g. Jemal Fano Haji'}
                              className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-blue-600 outline-none font-bold text-slate-900 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                              {['admin', 'admin@bbschool.com'].includes(credentials.identifier.trim().toLowerCase()) ? 'Admin Password / Jecha Icciitii' : 'Password (e.g. STD00001 or STF000001)'}
                            </label>
                            <input 
                              required
                              type="password"
                              value={credentials.password}
                              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                              placeholder={['admin', 'admin@bbschool.com'].includes(credentials.identifier.trim().toLowerCase()) ? 'Enter Password' : 'Your Student/Staff ID'}
                              className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-blue-600 text-slate-900 outline-none font-bold transition-all"
                            />
                          </div>
                          <div className="flex gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setShowLoginForm(false);
                                setCredentials({ identifier: '', password: '' });
                              }}
                              className="flex-1 px-4 py-4 border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={signingIn}
                              className="flex-[2] px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/30 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
                            >
                              {signingIn ? 'Checking...' : 'Sign In'}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </div>
      
                  {/* Latest News Ticker */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-[32px] shadow-md max-w-md w-full cursor-pointer hover:bg-white transition-all group"
                    onClick={() => setActiveTab('news')}
                  >
                    <div className="w-10 h-10 bg-orange-100 text-orange-655 rounded-2xl flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform">
                       <Bell size={18} />
                    </div>
                    <div className="flex-1 overflow-hidden text-left text-slate-800">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Latest Update</p>
                       <p className="text-sm font-bold text-slate-900 truncate uppercase tracking-tight">
                         {latestNews.length > 0 ? latestNews[0].title : 'Grade 12 Mock Portal Now Open!'}
                       </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-450 group-hover:text-blue-600 transition-colors" />
                  </motion.div>
 
                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-red-50 border-2 border-red-100 text-red-700 rounded-[32px] text-sm font-bold space-y-3 max-w-md w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={20} className="text-red-500" />
                        <span>Authentication Notice</span>
                      </div>
                      <p className="text-xs font-medium text-red-600 leading-relaxed">
                        {authError}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Right Column: Animated Student Dashboard Illustration */}
                <div className="w-full flex justify-center lg:justify-end">
                  <motion.div 
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative w-full max-w-[540px] lg:max-w-full lg:aspect-[16/12] aspect-[16/11] rounded-[44px] bg-white border-4 border-slate-900 p-5 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] overflow-hidden group hover:-translate-y-1 hover:shadow-[16px_16px_0px_0px_rgba(15,23,42,1)] transition-all duration-300"
                  >
                    {/* Glowing light-blue radial wash for premium dashboard feel */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />
                    
                    {/* Corner branding stamp */}
                    <div className="absolute top-4 left-4 z-20 inline-flex items-center gap-2.5 px-3 py-1.5 bg-white border-2 border-slate-900 rounded-2xl shadow-sm">
                      <img 
                        src={schoolLogo} 
                        alt="Biftu Beri Stamp" 
                        className="w-6 h-6 object-contain rounded-lg border border-slate-100" 
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">Biftu Beri SS</span>
                    </div>

                    {/* Image visual containing students / school layout */}
                    <div className="relative w-full h-full rounded-[32px] overflow-hidden border-2 border-slate-100 flex items-center justify-center bg-slate-50">
                      <motion.img 
                        src={studentsIllustration} 
                        alt="Biftu Beri Students Illustration" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1200ms] ease-out-expo"
                        referrerPolicy="no-referrer"
                        animate={{
                          y: [0, -4, 0]
                        }}
                        transition={{
                          duration: 6,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />

                      {/* Overlap subtle card indicator: Exam Simulator live widget */}
                      <div className="absolute bottom-4 inset-x-4 bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-white/20 text-left flex items-center justify-between shadow-lg">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widening text-blue-400 mb-0.5">Live Mock Portal</p>
                          <h4 className="text-xs font-black text-white uppercase tracking-tight">Interactive Dashboard</h4>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                          <span>Active</span>
                        </div>
                      </div>
                    </div>

                    {/* Floating Dashboard Widget 1: Top Students/Score */}
                    <motion.div 
                      animate={{ 
                        y: [0, -8, 0],
                        rotate: [2, 0, 2]
                      }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      className="absolute top-20 right-6 z-20 bg-white border-2 border-slate-900 rounded-2xl p-3 shadow-md flex items-center gap-2 w-[160px] text-left hover:scale-105 hover:rotate-0 transition-transform"
                    >
                      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <GraduationCap size={16} className="text-orange-600" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Top Result</p>
                        <p className="text-[11px] font-extrabold text-slate-800 leading-none">600+ EAES Score</p>
                      </div>
                    </motion.div>

                    {/* Floating Dashboard Widget 2: Preparation stats */}
                    <motion.div 
                      animate={{ 
                        y: [0, 8, 0],
                        rotate: [-2, 0, -2]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute bottom-20 left-6 z-10 bg-white border-2 border-slate-900 rounded-2xl p-3 shadow-md flex items-center gap-2 w-[170px] text-left hover:scale-105 hover:rotate-0 transition-transform"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Target size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Preparation</p>
                        <p className="text-[11px] font-extrabold text-slate-800 leading-none">100% Syllabus Prep</p>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
              </div>

              {/* Visually engaging Biftu Beri Secondary School Mission & Achievements Hero Section */}
              <div className="w-full mt-12 mb-8 space-y-8">
                {/* Section Title Header */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                    <Trophy size={12} className="text-amber-650 animate-bounce" />
                    <span>School Legacy & Pride / Dhaala Oolmaa</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight">
                    {language === 'en' ? 'Our Mission & Achievements' : 'Ergamaa fi Milkaa\'ina Keenya'}
                  </h2>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-wider max-w-xl mx-auto">
                    {language === 'en' 
                      ? 'Guiding brilliant minds to regional and national academic excellence'
                      : 'Barattoota gara badhaadhina dandeettii fi dacha beekumsaatti qajeelchuu'}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: Mission & Vision Card (Bilingual style) */}
                  <div className="bg-white border-4 border-slate-900 rounded-[32px] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between space-y-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-full blur-2xl pointer-events-none" />
                    <div className="space-y-6">
                      {/* Mission Segment */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 bg-blue-50 text-blue-600 rounded-xl block">
                            <Compass size={18} className="text-blue-600 shrink-0" />
                          </span>
                          <div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest block leading-tight">
                              Our Sacred Mission
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Ergama Keenya
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-3 border-l-2 border-blue-500 text-xs">
                          <p className="text-slate-800 font-semibold leading-relaxed">
                            <strong>EN:</strong> To cultivate high-caliber intellectual potential, promote self-reliance, and provide a transformative learning environment that prepares students of Biftu Beri for university and community leadership.
                          </p>
                          <p className="text-slate-600 font-medium leading-relaxed italic">
                            <strong>OM:</strong> Dandeettii qorannoo fi qomaa olaanaa gabbisuu, of-danda’uu guddisuu, fi naannoo barumsaa jijjiirama fidu uumuun barattoota qorannoo yuunibarsiitii fi gaggeessummaa hawaasaatiif qopheessuu.
                          </p>
                        </div>
                      </div>

                      {/* Vision Segment */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl block">
                            <Target size={18} className="text-emerald-600 shrink-0" />
                          </span>
                          <div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest block leading-tight">
                              Our Future Vision
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Mul'ata Keenya
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500 text-xs text-left">
                          <p className="text-slate-800 font-semibold leading-relaxed">
                            <strong>EN:</strong> To become the premier hub of scientific and academic excellence in the region, bridging the legacy of Hararghe history with high-tech futuristic achievements.
                          </p>
                          <p className="text-slate-600 font-medium leading-relaxed italic">
                            <strong>OM:</strong> Giddu-gala beekumsaa fi saayinsii olaanaa naannichaa ta’uun, seenaa fi dandeettii dhaloota haaraa gara dacha beekumsa fuulduraatti ceesisuu.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* School Motto Tagged footer */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        School Motto / Druu Keenya
                      </div>
                      <div className="text-[10px] font-black text-emerald-650 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-lg">
                        Knowledge is Light / Beekumsi Ifaadha
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Key Student Achievements Board Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Achievement 1: Exam Pass rate */}
                    <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:scale-103 transition-all text-left">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Trophy size={18} />
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-md text-[8px] font-black tracking-widest uppercase">
                          Record
                        </span>
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-3xl font-black text-slate-900">92%</p>
                        <p className="text-xs font-black text-slate-850 uppercase tracking-tight">EAES National Pass Rate</p>
                        <p className="text-[10.5px] font-semibold text-slate-500 leading-tight">
                          Leading regionally with top-tier scorers achieving outstanding national results.
                        </p>
                      </div>
                    </div>

                    {/* Achievement 2: University Admits */}
                    <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:scale-103 transition-all text-left">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                          <GraduationCap size={18} />
                        </div>
                        <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[8px] font-black tracking-widest uppercase">
                          University
                        </span>
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-3xl font-black text-slate-900">480+</p>
                        <p className="text-xs font-black text-slate-850 uppercase tracking-tight">Students Placed</p>
                        <p className="text-[10.5px] font-semibold text-slate-500 leading-tight">
                          Over 480 brilliant minds placed in premier governmental research colleges.
                        </p>
                      </div>
                    </div>

                    {/* Achievement 3: Regional STEM Awards */}
                    <div className="bg-gradient-to-br from-purple-50 to-white border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:scale-103 transition-all text-left">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                          <Award size={18} />
                        </div>
                        <span className="px-2 py-0.5 bg-purple-600 text-white rounded-md text-[8px] font-black tracking-widest uppercase">
                          STEM
                        </span>
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-3xl font-black text-slate-900">Region #1</p>
                        <p className="text-xs font-black text-slate-850 uppercase tracking-tight">Science Champions</p>
                        <p className="text-[10.5px] font-semibold text-slate-500 leading-tight">
                          Recognized as the leading institution in local Mathematics & Tech tournaments.
                        </p>
                      </div>
                    </div>

                    {/* Achievement 4: Total Alums */}
                    <div className="bg-gradient-to-br from-amber-50 to-white border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:scale-103 transition-all text-left">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                          <Users size={18} />
                        </div>
                        <span className="px-2 py-0.5 bg-amber-600 text-white rounded-md text-[8px] font-black tracking-widest uppercase">
                          Community
                        </span>
                      </div>
                      <div className="mt-4 space-y-1">
                        <p className="text-3xl font-black text-slate-900">15,000+</p>
                        <p className="text-xs font-black text-slate-850 uppercase tracking-tight">Graduated Alumni</p>
                        <p className="text-[10.5px] font-semibold text-slate-500 leading-tight">
                          Building strong societal leadership across global and local communities alike.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
      
                {/* Immersive Center Mock Banner Feature */}
                <div className="relative w-full mt-6 col-span-1 lg:col-span-2">
                  <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[48px] overflow-hidden shadow-2xl group border-4 border-white shadow-indigo-900/10 p-8 sm:p-12 text-left">
                    <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_50%_50%,#3B82F6_0%,transparent_70%)]" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="space-y-4 max-w-xl">
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                            Active Session
                          </div>
                          <span className="text-indigo-200 text-xs font-black uppercase tracking-widest">Biftu Beri Premium Assessment</span>
                        </div>
                        <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase">National Prep Mock Examination</h3>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">
                          Standardized assessment modeled exactly after the EAES template. Try unlimited attempts to master your potential.
                        </p>
                      </div>

                      <div className="flex flex-row md:flex-col gap-4 w-full md:w-auto shrink-0">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex-1 md:flex-none md:w-44">
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Time Limit</p>
                          <p className="text-xl font-black text-white">120 MIN</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex-1 md:flex-none md:w-44">
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Pass Rate</p>
                          <p className="text-xl font-black text-white">88%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floaties */}
                  <motion.div 
                    animate={{ y: [0, -15, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                    className="absolute -top-10 -right-4 p-6 bg-white rounded-3xl shadow-xl border border-slate-100 hidden lg:block"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                        <GraduationCap size={24} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-slate-400 uppercase">New Material</p>
                        <p className="font-black text-slate-900 leading-none">CHEMISTRY G12</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === 'about' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-12"
              >
                <About />
              </motion.div>
            )}

            {activeTab === 'news' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-12"
              >
                <News />
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'hero' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-32 space-y-16"
            >
              {/* Featured News Section */}
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Latest Announcements / Beeksisa</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Stay updated with Biftu Beri school news</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('news')}
                    className="text-xs font-black text-blue-600 uppercase tracking-widest hover:translate-x-1 transition-transform flex items-center gap-1"
                  >
                    View All News <ChevronRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {latestNews.length === 0 ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="h-48 bg-white rounded-[40px] animate-pulse border border-slate-100 shadow-sm" />
                    ))
                  ) : (
                    latestNews.map((news) => (
                      <motion.button
                        key={news.id}
                        whileHover={{ y: -5 }}
                        onClick={() => setActiveTab('news')}
                        className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden text-left group"
                      >
                        <div className="aspect-video bg-slate-100 relative overflow-hidden">
                           {news.imageUrl ? (
                             <img src={news.imageUrl} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center">
                               <Bell size={24} className="text-blue-200" />
                             </div>
                           )}
                           <div className="absolute top-4 left-4">
                              <span className="text-[8px] font-black text-white bg-blue-600/80 backdrop-blur-md px-2 py-1 rounded-lg uppercase tracking-widest">
                                {news.category}
                              </span>
                           </div>
                        </div>
                        <div className="p-6 space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{news.dateFormatted}</p>
                          <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {news.title}
                          </h4>
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>

              {/* Exams Section */}
              <div className="space-y-10 pt-16 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Mock Examinations</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Access the latest National Prep materials</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Now</span>
                  </div>
                </div>

                {loadingExams ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-40 bg-white rounded-3xl animate-pulse border border-slate-100 shadow-sm" />
                    ))}
                  </div>
                ) : activeExams.length === 0 ? (
                  <div className="p-16 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto">
                      <Target size={32} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No public exams available at the moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {activeExams.map((exam) => (
                      <motion.button
                        key={exam.id}
                        whileHover={{ y: -5, borderColor: '#10B981' }}
                        onClick={() => setShowLoginForm(true)}
                        className="p-8 bg-white rounded-[40px] border border-slate-200 shadow-sm transition-all text-left group"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <BookOpen size={24} />
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">G{exam.grade}</span>
                        </div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm mb-2 group-hover:text-green-600 transition-colors line-clamp-1">{exam.title}</h4>
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{exam.subject}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">•</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{exam.durationMinutes} Min</span>
                        </div>
                        <div className="pt-4 mt-2">
                          <div className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 transition-all cursor-pointer">
                            Take Exam / Qorumsa Seeni <LogIn size={14} />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'hero' && (
            <motion.section 
               initial={{ opacity: 0 }}
               whileInView={{ opacity: 1 }}
               viewport={{ once: true }}
               className="mt-40 pt-40 border-t border-slate-200"
            >
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                  <div className="space-y-8">
                     <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                        Our Vision for <br/><span className="text-blue-600">Biftu Beri.</span>
                     </h2>
                     <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg">
                        We are transforming how students prepare for their future by integrating advanced technology with the standard Ethiopian curriculum.
                     </p>
                     <button 
                       onClick={() => setActiveTab('about')}
                       className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                     >
                        Learn More About Us
                     </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-4">
                        <div className="aspect-[4/5] bg-blue-600 rounded-[32px] shadow-2xl relative overflow-hidden flex items-center justify-center p-8 text-center text-white">
                           <Target size={48} className="absolute top-10 right-10 opacity-20" />
                           <p className="font-black text-2xl uppercase tracking-tighter relative z-10">Academic Focus</p>
                        </div>
                        <div className="aspect-square bg-white border border-slate-200 rounded-[32px] p-8 flex flex-col justify-end">
                           <p className="text-4xl font-black text-blue-600 uppercase">92%</p>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Success Rate</p>
                        </div>
                     </div>
                     <div className="space-y-4 pt-12">
                        <div className="aspect-square bg-gradient-to-br from-[#e6f0fa] to-[#d0e5fc] border border-blue-200 rounded-[32px] p-8 flex flex-col justify-end">
                           <p className="text-4xl font-black text-blue-700 uppercase">24/7</p>
                           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Always Live</p>
                        </div>
                        <div className="aspect-[4/5] bg-[#F5F5F4] border-2 border-dashed border-slate-200 rounded-[32px] flex items-center justify-center">
                           <BookOpen size={48} className="text-slate-200" />
                        </div>
                     </div>
                  </div>
               </div>
            </motion.section>
          )}
        </div>

        {activeTab === 'hero' && (
          <>
            <section className="max-w-6xl mx-auto px-6 mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<ShieldCheck className="text-blue-600" />}
                title="Integrity First"
                description="Built-in focus monitoring ensures academic honesty during preparation sessions."
              />
              <FeatureCard 
                icon={<Binary className="text-emerald-600" />}
                title="Natural Science"
                description="Dedicated stream for Biology, Physics, and Chemistry specialists."
              />
              <FeatureCard 
                icon={<GraduationCap className="text-purple-600" />}
                title="Social Science"
                description="Targeted prep for Geography, History and Economics students."
              />
            </section>

            {/* Simulated Mock details and 88% overall completeness display */}
            <section className="max-w-6xl mx-auto px-6 mt-32">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-[#0A0A0A] rounded-[48px] text-white p-12 lg:p-20 relative overflow-hidden border border-slate-800 shadow-2xl"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.15),transparent_60%)] pointer-events-none" />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                    <span className="inline-flex px-4 py-1.5 bg-blue-500/10 text-blue-400 rounded-full text-xs font-black uppercase tracking-widest border border-blue-500/20">
                      National Prep EAES Simulated Mock
                    </span>
                    <h3 className="text-4xl lg:text-6xl font-black uppercase tracking-tight leading-none leading-tight">
                      Master the <span className="text-blue-500">120 Minutes</span> Standard
                    </h3>
                    <p className="text-lg text-slate-400 leading-relaxed font-medium">
                      The Ethiopian Educational Assessment and Examinations Service (EAES) mock simulates full exam conditions. Get comprehensive question sets, absolute time pressure, and dynamic correction sheets.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-4">
                      <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-500 uppercase">National Target</p>
                        <p className="text-xl font-black text-white">88% Passing Core</p>
                      </div>
                      <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Interactive Feedback</p>
                        <p className="text-xl font-black text-blue-400">GenAI Correction</p>
                      </div>
                      <div className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Time limit</p>
                        <p className="text-xl font-black text-emerald-400">120 Mins</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/15 backdrop-blur-sm p-8 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase">Subject Domain</p>
                        <p className="text-lg font-black text-white">All Syllabus Coverage</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-[9px] font-black uppercase tracking-widest">Grades 9-12</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Grade 9 & 10 Core (General Biology, Chem, Physics)</span>
                        <span className="text-sm text-emerald-400 font-bold font-mono">100% Core</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Grade 11 & 12 Natural Science Stream</span>
                        <span className="text-sm text-blue-400 font-bold font-mono">100% Core</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Grade 11 & 12 Social Science Stream</span>
                        <span className="text-sm text-indigo-400 font-bold font-mono">100% Core</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 text-xs text-slate-400 leading-relaxed italic">
                      Platform utilizes persistent localized Oromo & English configurations to preserve clarity for candidates. Study analytics auto-sync to Parent portal dashboards for active, real-time guidance.
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* System Architecture Blueprint Card */}
            <section className="max-w-6xl mx-auto px-6 mt-32">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white border-4 border-slate-900 rounded-[48px] p-8 lg:p-12 shadow-[16px_16px_0px_0px_rgba(15,23,42,1)]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-5 space-y-6">
                    <span className="inline-flex px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-widest border border-blue-200">
                      System Overview
                    </span>
                    <h3 className="text-3xl lg:text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">
                      Integrated Exam Platform
                    </h3>
                    <p className="text-slate-600 leading-relaxed font-medium text-sm">
                      Biftu Beri Exam System offers a unified experience across multiple user roles. Learn how administrators, teachers, and students collaborate seamlessly within our computer-based testing architecture.
                    </p>
                    <div className="space-y-4 pt-2">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">1</span>
                        <p className="text-xs font-semibold text-slate-700">Administrators manage users, courses, and monitor the live portal with full integrity audits.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">2</span>
                        <p className="text-xs font-semibold text-slate-700">Teachers import question sets, customize standard formats, grade essay outputs, and view dynamic class statistics.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">3</span>
                        <p className="text-xs font-semibold text-slate-700">Students take real-time mock tests, track syllabus domain mastery, and access detailed feedback.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold">4</span>
                        <p className="text-xs font-semibold text-slate-700">Parents monitor progress through dedicated analytics dashboards to support student growth and domain mastery.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-7">
                    <div className="border-4 border-slate-900 rounded-[36px] overflow-hidden bg-slate-50 p-2.5 shadow-md">
                      <img 
                        src={biftuExamBlueprint} 
                        alt="Biftu Beri Exam System Architecture & Roles Blueprint"
                        className="w-full h-auto object-cover rounded-[26px] select-none pointer-events-none hover:scale-[1.01] transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>
            
            <FAQ />
          </>
        )}
      </main>

      <footer className="mt-32 pt-16 pb-24 bg-blue-950 border-t-8 border-slate-950 relative overflow-hidden">
        {/* Background Accent Graphics */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-6">
          {/* Main 4-Column Responsive Grid with Blue theme and Solid Black Borders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            
            {/* CARD 1: BRANDING & SCHOOL LOGO */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-blue-900 border-4 border-slate-950 rounded-[28px] p-6 lg:p-8 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform text-white"
            >
              <div className="space-y-6">
                <div className="inline-flex bg-white border-2 border-slate-950 p-2.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <img 
                    src={schoolLogo} 
                    alt="School Logo" 
                    className="w-12 h-12 object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <span>Biftu Beri</span>
                  <span className="text-blue-400 font-mono text-xs font-medium">Secondary</span>
                </h3>
                <p className="text-xs font-semibold leading-relaxed text-blue-100">
                  Biftu Beri premier EAES preparation platform. 
                  Sharpen your skills with national-level mock exams, AI-powered feedback, and real-time analytics.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-6 border-t border-blue-850">
                <a href="#" className="p-2.5 bg-slate-950 hover:bg-blue-600 text-white rounded-xl border-2 border-slate-950 transition-colors shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)]">
                  <Globe size={14} />
                </a>
                <a href="mailto:info@biftuberi.edu.et" className="p-2.5 bg-slate-950 hover:bg-blue-600 text-white rounded-xl border-2 border-slate-950 transition-colors shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)]">
                  <Mail size={14} />
                </a>
              </div>
            </motion.div>

            {/* CARD 2: QUICK NAVIGATION */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-blue-850 border-4 border-slate-950 rounded-[28px] p-6 lg:p-8 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform text-white"
            >
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-blue-300 border-b-2 border-slate-950 pb-2">
                  Quick Navigation
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Home', action: () => setActiveTab('hero') },
                    { label: 'About School', action: () => setActiveTab('about') },
                    { label: 'User Manual / PDF', action: () => setIsManualOpen(true) },
                    { label: 'Latest News', action: () => setActiveTab('news') },
                    { label: 'Student Login', action: () => setShowLoginForm(true) },
                  ].map((nav, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={nav.action}
                      className="w-full text-left py-2.5 px-4 bg-slate-950 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer block"
                    >
                      {nav.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] font-bold text-blue-200 mt-4 leading-none">
                Interactive candidate system
              </p>
            </motion.div>

            {/* CARD 3: SCHOOL CONTACT */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-blue-800 border-4 border-slate-950 rounded-[28px] p-6 lg:p-8 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform text-white"
            >
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-blue-300 border-b-2 border-slate-950 pb-2">
                  School Contact
                </h4>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 border-2 border-slate-950 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-400">
                      <MapPin size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Location</span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      Biftu Beri, Oromia, Ethiopia
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950 border-2 border-slate-950 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Mail size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Official Email</span>
                    </div>
                    <a href="mailto:info@biftuberi.edu.et" className="text-xs font-bold text-white block hover:underline">
                      info@biftuberi.edu.et
                    </a>
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-blue-200 mt-4 leading-none">
                Direct Administrative Reach
              </span>
            </motion.div>

            {/* CARD 4: APP SUPPORT & FEEDBACK */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-[#F59E0B] border-4 border-slate-950 rounded-[28px] p-6 lg:p-8 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform text-slate-950"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 border-b-2 border-slate-950/20 pb-2 flex-1">
                    App Support & Feedback / Deeggarsaa fi Yaada
                  </h4>
                </div>
                <p className="text-xs font-black leading-relaxed text-slate-900">
                  {language === 'en' 
                    ? 'For comments, support questions, or system issues, click contact us:' 
                    : 'Karaa ittiin nu qunnamanii yaada, gaafii, fi deeggarsa kkf erguuf imeelii gadii kanaan nu qunnamaa:'
                  }
                </p>
                <div className="space-y-3">
                  {/* CRITICAL FEATURE: LIVE CHAT TRIGGER BUTTON */}
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-900 text-[#F59E0B] font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare size={14} className="text-[#F59E0B]" />
                    <span>💬 click contact us:</span>
                  </button>

                  <a 
                    href="mailto:jemalfano030@gmail.com?subject=Biftu%20Beri%2520Support%2520Request"
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 transition-all text-center"
                    title="Send support email / Imeelii ergi"
                  >
                    <Mail size={12} />
                    <span>jemalfano030@gmail.com</span>
                  </a>
                </div>
              </div>
              <span className="text-[9px] font-black text-slate-905 uppercase tracking-widest block mt-4">
                ⭐ Premium Support Active
              </span>
            </motion.div>

          </div>

          {/* Bottom Copyright & Infrastructure Information */}
          <div className="mt-16 pt-8 border-t-4 border-slate-950 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="p-3.5 bg-slate-950 border-4 border-slate-950 rounded-2xl shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] flex items-center gap-3">
              <span className="text-base">🥇</span>
              <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-amber-400">
                © {new Date().getFullYear()} Biftu Beri. All Rights Reserved.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="p-3.5 bg-slate-950 border-4 border-slate-950 rounded-2xl shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] flex items-center gap-2.5">
                <span className="text-sm">🏆</span>
                <p className="text-[10px] md:text-xs font-black text-amber-300 uppercase tracking-[0.15em] flex items-center gap-1.5">
                  <User size={13} className="text-amber-400 shrink-0" /> Developer: Jemal Fano Haji
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 border-4 border-slate-950 rounded-2xl shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] flex items-center gap-2.5">
                <p className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.15em] flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-400 shrink-0" /> Secure Cloud Infrastructure
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* SUPPORT LIVE CHAT OVERLAY COMPONENT */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="fixed bottom-6 right-6 z-[95] w-[340px] sm:w-[400px] h-[500px] bg-white border-4 border-slate-950 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col justify-between"
          >
            {/* Header */}
            <div className="bg-blue-600 border-b-4 border-slate-950 p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-950 text-blue-400 rounded-xl border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <MessageSquare size={16} />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-black uppercase tracking-wider leading-none">Biftu Beri Live Chat</h4>
                  <span className="text-[8px] font-bold text-blue-100 uppercase tracking-widest block mt-0.5">Real-time Support Channel</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 bg-slate-950 text-white hover:text-red-400 rounded-lg border-2 border-slate-950 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Conversation Log / Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-blue-50/20 max-h-[350px]">
              {!chatInitDone && !user ? (
                /* Guest Setup State */
                <form onSubmit={handleStartGuestChat} className="h-full flex flex-col justify-center items-center text-center space-y-4">
                  <div className="w-12 h-12 bg-blue-100 border-2 border-slate-950 rounded-2xl flex items-center justify-center text-blue-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <User size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-850">Start Live Support Chat</p>
                    <p className="text-[10px] text-slate-500 font-medium">Barsiisaa ykn Bulchiinsa bilisaan qunnami.</p>
                  </div>
                  <div className="w-full space-y-3 px-3">
                    <div className="text-left">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">Maqaa Guutuu / Full Name</label>
                      <input 
                        required
                        type="text"
                        placeholder="E.g., Aster Omod"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl font-bold text-xs text-slate-950 outline-none focus:bg-white"
                      />
                    </div>
                    <div className="text-left">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1">Imeelii / Email (Optional)</label>
                      <input 
                        type="email"
                        placeholder="E.g., aster@gmail.com"
                        value={visitorEmail}
                        onChange={(e) => setVisitorEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl font-bold text-xs text-slate-950 outline-none focus:bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={chatSending}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white border-2 border-slate-950 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                    >
                      {chatSending ? 'Setting up session...' : 'Begin Communication / Jalqabi'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Chat Messages List */
                <div className="space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="py-12 flex flex-col justify-center items-center text-center text-slate-400">
                      <div className="w-10 h-10 border-2 border-slate-950 rounded-xl flex items-center justify-center bg-blue-50 mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <MessageSquare size={16} className="text-blue-600" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-705 mb-0.5">No Messages Yet / Ergaan hin jiru</p>
                      <p className="text-[9px] text-slate-400 select-none">Send a message and the admin team will reply back here in real-time!</p>
                    </div>
                  ) : (
                    chatMessages.map((m) => {
                      const isOwner = m.senderId === (user?.uid || auth.currentUser?.uid);
                      return (
                        <div key={m.id} className={`flex flex-col ${isOwner ? 'items-end' : 'items-start'}`}>
                          <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            {isOwner ? 'You / Si' : m.senderName}
                          </span>
                          <div className={`p-3 max-w-[85%] border-2 border-slate-950 rounded-2xl text-[11px] font-extrabold leading-relaxed ${
                            isOwner 
                              ? 'bg-blue-600 text-white rounded-tr-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                              : 'bg-white text-slate-900 rounded-tl-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Message Input Control form */}
            {(chatInitDone || user) && (
              <form onSubmit={handleSendLandingChat} className="p-3 bg-white border-t-4 border-slate-950 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={language === 'om' ? 'Kallattiin ergaa barreessi...' : 'Type feedback or support request...'}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl outline-none focus:border-blue-500 font-bold text-[11px] text-slate-950"
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white uppercase text-[9px] font-black rounded-xl border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Send size={10} />
                  Send
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Biftu Beri Systems Blueprint & EAES Preparation Flows Modal */}
      <AboutBiftuSystemModal 
        isOpen={isAboutModalOpen} 
        onClose={() => setIsAboutModalOpen(false)} 
        language={language} 
      />
      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        language={language}
      />
      {isRegModalOpen && (
        <RegistrationRequestForm onClose={() => setIsRegModalOpen(false)} />
      )}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-10 rounded-[32px] border border-slate-200 hover:border-blue-200 hover:shadow-2xl transition-all group">
      <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-2xl mb-8 group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 32 })}
      </div>
      <h3 className="text-xl font-black text-slate-900 mb-4 uppercase tracking-tight">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed">{description}</p>
    </div>
  );
}
