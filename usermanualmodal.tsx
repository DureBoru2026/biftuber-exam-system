import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  ShieldCheck, 
  Users, 
  Settings, 
  Download, 
  ArrowRight, 
  Info,
  CheckCircle2,
  AlertTriangle,
  Github,
  Globe,
  Database,
  Cloud,
  FileText,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'om';
}

type Section = 'overview' | 'student' | 'teacher' | 'admin' | 'transfer';

export default function UserManualModal({ isOpen, onClose, language }: UserManualModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    { id: 'overview', label: language === 'en' ? 'System Overview' : 'Haala Waliigalaa', icon: <Info size={16} /> },
    { id: 'student', label: language === 'en' ? 'Student Guide' : 'Qajeelfama Barataa', icon: <Users size={16} /> },
    { id: 'teacher', label: language === 'en' ? 'Teacher Guide' : 'Qajeelfama Barsiisaa', icon: <BookOpen size={16} /> },
    { id: 'admin', label: language === 'en' ? 'Admin Guide' : 'Qajeelfama Bulchiinsaa', icon: <ShieldCheck size={16} /> },
    { id: 'transfer', label: language === 'en' ? 'Transfer & Sales' : 'Dabarsuu fi Gurgurtaa', icon: <ArrowRight size={16} /> },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 print:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden"
        />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-[40px] border-4 border-slate-950 shadow-[16px_16px_0px_0px_rgba(15,23,42,1)] flex flex-col overflow-hidden print:shadow-none print:border-none print:max-h-none print:overflow-visible print:w-full"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b-4 border-slate-950 flex items-center justify-between bg-blue-50/50 shrink-0 print:border-b-2 print:py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] print:shadow-none">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                  {language === 'en' ? 'Biftu Beri User & Admin Manual' : 'Qajeelfama Fayyadamaa fi Bulchiinsaa'}
                </h2>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                  Official Portal Documentation • V2.0.0
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-950 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                <Printer size={14} />
                {language === 'en' ? 'Print / Save PDF' : 'Waraabi / PDF Kaayi'}
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-slate-950 text-white rounded-xl hover:bg-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
            {/* Sidebar Navigation */}
            <div className="w-64 border-r-4 border-slate-950 bg-slate-50 p-6 flex flex-col gap-2 shrink-0 print:hidden">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id as Section)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all text-left ${
                    activeSection === s.id
                      ? 'bg-blue-600 text-white border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900 border-2 border-transparent'
                  }`}
                >
                  <span className={activeSection === s.id ? 'text-white' : 'text-blue-500'}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
              
              <div className="mt-auto pt-6 border-t border-slate-200">
                <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={14} />
                    <span className="text-[9px] font-black uppercase tracking-wider">Quick Help</span>
                  </div>
                  <p className="text-[9px] text-amber-800 font-bold leading-relaxed">
                    Need technical support? Contact the IT administrator via the Live Chat.
                  </p>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 bg-white print:p-0 print:overflow-visible">
              
              {/* SECTION: OVERVIEW */}
              {activeSection === 'overview' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                      {language === 'en' ? 'Welcome to the Biftu Beri Portal' : 'Gara Sirna Biftu Beritti Nagaan Dhufte'}
                    </h3>
                    <p className="text-sm text-slate-600 leading-loose font-medium">
                      {language === 'en' 
                        ? 'The Biftu Beri Secondary School Official Examination Center is an AI-powered platform designed to streamline national mock exams, student performance tracking, and academic reporting. This system bridges the gap between traditional testing and modern data analytics.'
                        : 'Giddu-galeessi Qormaataa Mana Barumsaa Sad. 2ffaa Biftu Beri sirna ammayyaa AI fayyadamuun qormaata yaalii, hordoffii hojii barattootaa fi gabaasa barnootaa salphisuuf kan qophaayeera.'
                      }
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={14} /> {language === 'en' ? 'Core Capabilities' : 'Dandeettiiwwan Ijoo'}
                      </h4>
                      <ul className="space-y-2">
                        {(language === 'en' 
                          ? ['Real-time Mock Examinations', 'Automated Grading & Feedback', 'Parent Monitoring Dashboard', 'Student Performance Analytics']
                          : ['Qormaata Yaalii Yeroo Real-time', 'Qabxii fi Yaada Ofumaan Kennu', 'Dashboard Hordoffii Warraa', 'Xiinxala Hojii Barattootaa']
                        ).map((item, idx) => (
                          <li key={idx} className="flex items-center gap-3 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <Globe size={14} /> {language === 'en' ? 'Bilingual Support' : 'Deeggarsa Afaan Lamaa'}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        {language === 'en'
                          ? 'The entire system supports Afaan Oromoo and English. This ensures that students, parents, and teachers can navigate the platform in their preferred language for maximum clarity.'
                          : 'Sirni kun guutummaatti Afaan Oromoo fi Ingiliffaan hojjata. Kunis barattoonni, warraafi barsiisonni afaan itti salphatuun akka tajaajilaman godha.'
                        }
                      </p>
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl">
                        <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">{language === 'en' ? 'Language Toggle' : 'Afaan Jijjiiruuf'}</p>
                        <p className="text-[10px] text-emerald-700 font-bold mt-1">
                          {language === 'en' 
                            ? 'Found in the top-right corner of the landing page and dashboard.' 
                            : 'Landing page fi Dashboard irratti gara gubbaa mirgaatiin argama.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: STUDENT GUIDE */}
              {activeSection === 'student' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[9px] font-black uppercase tracking-widest">User Roles</span>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                      {language === 'en' ? 'Student Manual' : 'Qajeelfama Barataa'}
                    </h3>
                  </div>

                  <div className="space-y-8">
                    <div className="flex gap-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] font-black text-xl">1</div>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {language === 'en' ? 'Sign-in & Identification' : 'Seeninsa fi Adda Baafannaa'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {language === 'en' 
                            ? <>Log in using your <strong>Full Name</strong> and your <strong>Student ID</strong> as the password. Ensure your name matches exactly with the school registration record.</>
                            : <><strong>Maqaa Guutuu</strong> fi <strong>ID Barataa</strong> kee akka furtuutti fayyadamii seeni. Maqaan kee galmee mana barumsaa waliin tokko ta'uu isaa mirkaneessi.</>
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] font-black text-xl">2</div>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {language === 'en' ? 'Taking Mock Exams' : 'Qormaata Yaalii fudhachuu'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {language === 'en'
                            ? <>Navigate to the 'Exams' tab. Click 'Start Test' on active exams. Do not close your browser tab during the exam. Your progress is saved automatically every 30 seconds.</>
                            : <>Gara qabxii 'Exams' deemi. Qormaata hojjatamaa jiru irratti 'Start Test' cuqaasi. Qormaata irratti yeroo jirtu 'tab' biraatti hin deemin. Hojiin kee sekondii 30 hundaaf ofumaan 'save' ta'a.</>
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] font-black text-xl">3</div>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {language === 'en' ? 'Reviewing Performance' : 'Haala Hojii Kee Ilaaluu'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {language === 'en'
                            ? <>Check the 'Results' section immediately after exam completion. View detailed domain analysis to see which syllabus topics you need to improve.</>
                            : <>Qormaata fixanii daqiiqaa muraasa keessatti qabxii kee iddoo 'Results' jedhutti ilaali. Barnoota kam irratti akka ati dandeettii dabalataa barbaaddu xiinxala keenya irraa barachuu dandeessa.</>
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: TEACHER GUIDE */}
              {activeSection === 'teacher' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase tracking-widest">Faculty Resources</span>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                      {language === 'en' ? 'Teacher Manual' : 'Qajeelfama Barsiisaa'}
                    </h3>
                  </div>

                  <div className="space-y-8">
                    <div className="flex gap-6">
                      <div className="w-12 h-12 bg-white border-2 border-slate-950 rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-black text-xl">1</div>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {language === 'en' ? 'Exam Preparation' : 'Qormaata Qopheessuu'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {language === 'en'
                            ? <>Use the 'Slide Builder' and 'Exam Admin' tools to curate question banks. You can import questions from CSV files or use the AI Generator to suggest domain-specific problems.</>
                            : <>Meeshaalee 'Slide Builder' fi 'Exam Admin' fayyadamuun gaaffilee qopheessi. Gaaffilee 'CSV' irraa galchuun ykn 'AI Generator' fayyadamuun gaaffilee dandeettii addaa qaban qopheessuun ni danda'ama.</>
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div className="w-12 h-12 bg-white border-2 border-slate-950 rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-black text-xl">2</div>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {language === 'en' ? 'Monitoring Progress' : 'Hojii Hordofuu'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {language === 'en'
                            ? <>Access the 'Class Analytics' dashboard to see real-time participation rates during mock tests. Identify students who are struggling with specific syllabus domains.</>
                            : <>Dashboard 'Class Analytics' fayyadamuun yeroo qormaata yaalii hirmaannaa barattootaa hordofi. Barattoota barnoota kam irratti akka rakkoo qaban adda baasii ilaali.</>
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div className="w-12 h-12 bg-white border-2 border-slate-950 rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-black text-xl">3</div>
                      <div className="space-y-2 pt-1">
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {language === 'en' ? 'Reporting & Feedback' : 'Gabaasa fi Yaada'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {language === 'en'
                            ? <>Generate PDF transcripts for your sections. Leave constructive comments on student results that will be visible to both students and their parents.</>
                            : <>Gabaasa 'PDF' barattoota keetiif qopheessi. Qabxii barataa irratti yaada ijaaraa barreessi, kunis barataa fi warra barataatiif ni mul'ata.</>
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: ADMIN GUIDE */}
              {activeSection === 'admin' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2 text-left">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase tracking-widest">{language === 'en' ? 'Management' : 'Bulchiinsa'}</span>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                      {language === 'en' ? 'Administrator Manual' : 'Qajeelfama Bulchiinsaa'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white border-2 border-slate-950 rounded-3xl space-y-4">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center border-2 border-slate-950">
                        <Settings size={20} />
                      </div>
                      <h5 className="font-black text-xs uppercase tracking-tight text-slate-900">
                        {language === 'en' ? 'User Management' : 'Bulchiinsa Fayyadamaa'}
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        {language === 'en'
                          ? 'Admins can approve registration requests, assign student/teacher roles, and reset passwords via the \'Users\' tab in the Admin Dashboard.'
                          : 'Bulchiinsi gaaffii galmeessaa mirkaneessuu, qooda barataa/barsiisaa kennuu fi furtuu sirreessuu tab \'Users\' jedhu irratti hojjachuu danda\'u.'
                        }
                      </p>
                    </div>

                    <div className="p-6 bg-white border-2 border-slate-950 rounded-3xl space-y-4">
                      <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center border-2 border-slate-950">
                        <Database size={20} />
                      </div>
                      <h5 className="font-black text-xs uppercase tracking-tight text-slate-900">
                        {language === 'en' ? 'Exam Deployment' : 'Qormaata Gadi Lakkisuu'}
                      </h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        {language === 'en'
                          ? 'Use the \'Exam Builder\' to upload question banks, set timers, and publish exams to specific grade levels or subject tracks.'
                          : 'Gaaffilee fe\'uu, yeroo murteessuu fi qormaata kutaa barumsaa adda addaatiif lakkisuuf \'Exam Builder\' fayyadamaa.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-950 rounded-[32px] text-white space-y-4 border-b-8 border-blue-600">
                    <h5 className="text-xs font-black uppercase tracking-widest text-blue-400">
                      {language === 'en' ? 'Security & Integrity' : 'Nageenya fi Amanamummaa'}
                    </h5>
                    <p className="text-xs leading-relaxed font-medium text-slate-300">
                      {language === 'en'
                        ? 'Unauthorized access attempts are logged with IP tracking. Admins should regularly audit \'System Logs\' to ensure exam integrity and monitor for suspicious behavioral patterns during high-stakes mock tests.'
                        : 'Yaaliin seeninsaa hayyama hin qabne \'IP\' hordofuun ni galmeeffama. Bulchiinsi qulqullummaa qormaataa mirkaneessuuf \'System Logs\' hordofuu qabu.'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION: TRANSFER & SALES (DEVELOPER GUIDE) */}
              {activeSection === 'transfer' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest">Business & Ownership</span>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                      {language === 'en' ? 'Transfer & Handover Guide' : 'Qajeelfama Dabarsuu fi Gurgurtaa'}
                    </h3>
                  </div>

                  <div className="p-8 bg-blue-50/50 border-4 border-blue-200 border-dashed rounded-[40px] space-y-8">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">
                      {language === 'en'
                        ? 'To transfer or sell the Biftu Beri portal to another organization, follow these critical technical and administrative steps:'
                        : 'Sirna Biftu Beri kana dhaabbata biraatti dabarsuuf ykn gurguruuf wantoota armaan gadiitu barbaachisa:'
                      }
                    </p>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-950 text-white rounded-xl">
                            <Github size={16} />
                          </div>
                          <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                            {language === 'en' ? '1. Source Code Handover' : '1. Dabarsa Koodii (Source Code)'}
                          </h6>
                        </div>
                        <p className="text-[11px] text-slate-600 pl-11 font-medium leading-relaxed">
                          {language === 'en'
                            ? <>Provide the buyer with access to the <strong>GitHub Repository</strong>. Transfer ownership of the repository via GitHub settings. Ensure all commit history is preserved for future maintenance.</>
                            : <>Koodii appii kanaa (GitHub Repository) abbaa haaraatti dabarsuu. 'Ownership' koodichaa 'settings' GitHub fayyadamuun jijjiiri.</>
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-950 text-white rounded-xl">
                            <Cloud size={16} />
                          </div>
                          <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                            {language === 'en' ? '2. Hosting & Infrastructure Transfer' : '2. Dabarsa Hosting fi Meeshaalee'}
                          </h6>
                        </div>
                        <p className="text-[11px] text-slate-600 pl-11 font-medium leading-relaxed">
                          {language === 'en'
                            ? <>The app is hosted on <strong>Netlify</strong> or <strong>Google Cloud Run</strong>. You must invite the new owner as an Administrator on the hosting platform and then demote yourself.</>
                            : <>Appichi Netlify ykn Cloud Run irratti fe\'ameera. Abbaa haaraa akka 'Administrator'-tti affeeruun 'Ownership' dabarsi.</>
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-950 text-white rounded-xl">
                            <Database size={16} />
                          </div>
                          <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                            {language === 'en' ? '3. Database Ownership (Firebase)' : '3. Dabarsa Database (Firebase)'}
                          </h6>
                        </div>
                        <p className="text-[11px] text-slate-600 pl-11 font-medium leading-relaxed">
                          {language === 'en'
                            ? <>In the <strong>Firebase Console</strong>, add the buyer's email as an 'Owner' in the 'IAM & Admin' settings. This transfers all user data, exam results, and security rules.</>
                            : <>Firebase Console keessatti 'IAM & Admin' jalatti email abbaa haaraa akka 'Owner'-tti galchi. Kunis ragaalee fayyadamtootaa hunda dabarsa.</>
                          }
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-950 text-white rounded-xl">
                            <Settings size={16} />
                          </div>
                          <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                            {language === 'en' ? '4. Environment Variable Update' : '4. Haaromsa API Keys'}
                          </h6>
                        </div>
                        <p className="text-[11px] text-slate-600 pl-11 font-medium leading-relaxed">
                          {language === 'en'
                            ? <>Remind the new owner to update <code>API_KEYS</code> and <code>SEC_CONFIG</code> in the hosting environment settings to their own keys (Gemini API, Firebase Config).</>
                            : <>Abbaan haaraa 'API_KEYS' fi 'Firebase Config' mataa isaanii akka haaromsan gorfami.</>
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100 flex items-start gap-4">
                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-red-900 uppercase tracking-wider underline decoration-2">
                        {language === 'en' ? 'Legal Warning' : 'Akeekkachiisa Seeraa'}
                      </p>
                      <p className="text-[10px] text-red-800 leading-relaxed font-bold">
                        {language === 'en'
                          ? 'Upon transfer, ensure all previous administrative access is revoked. The seller is responsible for purging any sensitive personal developer keys from the repository secrets before handover.'
                          : 'Dabarsa booda hayyamni ati kanaan dura qabdu akka haqamu mirkaneessi. Koodii keessatti kumni furtuu (keys) dhunfaa keetii akka hin hafne of-eggannoo gochuu qabda.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer Info */}
          <div className="px-8 py-4 bg-slate-50 border-t-4 border-slate-950 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex justify-between items-center shrink-0 print:border-t-2 print:bg-white">
            <span>© 2026 Biftu Beri Secondary School • Official Documentation System</span>
            <div className="flex items-center gap-4 print:hidden">
              <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" /> System: Stable</span>
              <span className="flex items-center gap-1"><Info size={10} className="text-blue-500" /> Compiled: July 2026</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
