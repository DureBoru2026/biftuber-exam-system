import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, Sparkles, Clock, Compass, Shield, Users, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/src/contexts/LanguageContext';

interface FAQItem {
  id: string;
  icon: React.ReactNode;
  question: {
    en: string;
    om: string;
  };
  answer: {
    en: string;
    om: string;
  };
}

const faqs: FAQItem[] = [
  {
    id: 'intro',
    icon: <Compass className="text-blue-600" size={20} />,
    question: {
      en: "What is Biftu Beri premier EAES portal?",
      om: "Portalii olaanaa Biftu Beri EAES maali?"
    },
    answer: {
      en: "This portal is customized exclusively for Biftu Beri students preparing for the National Grade 12 Secondary Leaving Examinations (ESSLCE, administered by the EAES). It provides realistic practice mocks, high-fidelity layouts, and adaptive scoring models.",
      om: "Portalii kun addatti barattoota Biftu Beriitiif qormaata biyyaalessaa kutaa 12ffaaf (ESSLCE, kan EAES-iin kennamu) akka qophaa’an gargaaruuf kan qophaaye dha. Qormaata mookii, haala sirrii, fi xinxala qabxii of keessaa qaba."
    }
  },
  {
    id: 'timer',
    icon: <Clock className="text-indigo-650" size={20} />,
    question: {
      en: "How does the standard 120-minute simulation timer work?",
      om: "Sa'aatiin simuleeshinii daqiiqaa 120 akkamitti hojjeta?"
    },
    answer: {
      en: "To prepare you for real-world exam conditions, each assessment enforces a standard 120-minute (2 hours) limit. After launching, the timer monitors your session and automatically drafts/submits your input upon reaching 00:00 to simulate actual conditions.",
      om: "Haala qormaata dhugaa shaakalsiisuuf, qormaatni mookii hundi sa'aatii standardii biyyaalessaa (daqiiqaa 120 / sa'aatii 2) hordofa. Erga jalqabdee booda sa'aatiin ofumaan lakkaa'a, yeroon yoo xumurame ammoo ofumaan qormaata ergama."
    }
  },
  {
    id: 'ai-features',
    icon: <Sparkles className="text-purple-600" size={20} />,
    question: {
      en: "How do AI reviews and study improvement tips operate?",
      om: "Dagaaginni AI (GenAI) fi gorsi qo'annaa akkamitti hojjeta?"
    },
    answer: {
      en: "Once your exam is submitted, our GenAI module processes your strengths and pain points. It explains every questions' rationales in-depth, identifies syllabus focus areas (e.g., Organic Chemistry or Social Geography), and outputs custom guidelines to raise your score.",
      om: "Qormaata ergitanii booda, sirni AI keenya qabxii keessan xiinxala. Deebii gaaffilee gadi fageenyaan ibsa, gosa barumsa fooyya'uu qabu addaan baasa, fi gorsa qo'annaa dhuunfaa isinii kenna."
    }
  },
  {
    id: 'streams',
    icon: <Users className="text-emerald-600" size={20} />,
    question: {
      en: "Are both Natural Science and Social Science materials supported?",
      om: "Gosa barnootaa Saayinsii Uumamaa fi Hawaasummaa ni hammattaa?"
    },
    answer: {
      en: "Absolutely. The system splits assessments into dual custom profiles. Natural Science students receive custom mock materials in Biology, Chemistry, Physics, and Maths, while Social Science track pupils gain access to curated Economics, Geography, History, and Aptitude tests.",
      om: "Eeyyee, qormaatotni gosa barnootaa lamaaniifuu jiru. Karra Saayinsii Uumamaa (Physics, Chem, Bio, Maths) fi Saayinsii Hawaasummaa (Economics, Geo, History, Aptitude) hundaafuu qormaatni mookii sirrii qophaayeera."
    }
  },
  {
    id: 'recovery',
    icon: <RefreshCw className="text-orange-500" size={20} />,
    question: {
      en: "What happens if I experience an unexpected internet dropout?",
      om: "Yoo interneetiin na jalaa kute deebii koo nan dhabaa?"
    },
    answer: {
      en: "No need to worry. The application is built with native offline integrity safeguards. If your connection drops, your active selections are preserved locally. Once you reconnect and sign in, you can resume exactly where you were without losing your progress.",
      om: "Hasaahuun hin barbaachisu. Portalichi ofumaan deebii kee bakkatti oolcha. Interneetiin yoo cite, deebitanii yeroo seentan qormaataa fi deebii keessan akkuma jirutti argattu, bakkuma kuttanitti fufu dandeessu."
    }
  },
  {
    id: 'security',
    icon: <Shield className="text-rose-500" size={20} />,
    question: {
      en: "How are exam session guidelines and focus integrity enforced?",
      om: "Hordoffiin nageenyaa fi qulqullina qormaataa akkamitti ta'a?"
    },
    answer: {
      en: "To test your genuine capacity, the portal monitors session focus. Switching windows, exiting tabs, or opening unapproved applications prompts active warnings and records integrity indicators to simulate tight, cheating-resistant physical examination spaces.",
      om: "Nageenya fi qulqullina qormaataaf, portalichi focus kee ni hordofa. Yeroo qormaataa tab biraatti cehuun, ba'uun ykn fakkii biraa banuun akeekkachiisa fida, akkasumas qabxii kee irratti galmeeffama."
    }
  }
];

export default function FAQ() {
  const { language } = useLanguage();
  const [openId, setOpenId] = useState<string | null>('intro');

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-16 px-4 sm:px-6">
      {/* FAQ Title Section */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-100">
          <HelpCircle size={14} />
          FAQ / Gaaffilee Baay'ee Gaafataman
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">
          {language === 'en' ? 'Have Questions? We Have Answers' : 'Gaaffii Qabduu? Deebii Qabna'}
        </h2>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto text-sm sm:text-base">
          {language === 'en' 
            ? 'Everything you need to know about the Biftu Beri examination standards, syllabus coverage, and performance tracking.'
            : 'Waa\'ee sadarkaa qormaata Biftu Beri, uwwisa silabasii, fi hordoffii qabxii irratti waan beekuun si barbaachisu hunda asitti argachuu dandeessu.'
          }
        </p>
      </div>

      {/* Accordion Layout */}
      <div className="space-y-4">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          const currentQuestion = language === 'en' ? faq.question.en : faq.question.om;
          const currentAnswer = language === 'en' ? faq.answer.en : faq.answer.om;

          return (
            <div 
              key={faq.id}
              className={`bg-white rounded-[24px] border transition-all duration-300 ${
                isOpen 
                  ? 'border-blue-300 shadow-lg shadow-blue-500/5' 
                  : 'border-slate-200 hover:border-slate-300 shadow-sm'
              } overflow-hidden`}
            >
              <button
                onClick={() => toggle(faq.id)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none cursor-pointer"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-4 pr-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isOpen ? 'bg-blue-100' : 'bg-slate-50'
                  }`}>
                    {faq.icon}
                  </div>
                  <span className="font-extrabold text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                    {currentQuestion}
                  </span>
                </div>
                <div className={`p-1 rounded-full transition-transform duration-300 ${
                  isOpen ? 'rotate-180 bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  <ChevronDown size={20} />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <div className="px-6 pb-6 pt-2 pl-14 sm:pl-20">
                      <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed max-w-3xl">
                        {currentAnswer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Support / Contact Us Card Section */}
      <div className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-105 rounded-[32px] text-left shadow-md flex flex-col md:flex-row items-center justify-between gap-6" id="faq-contact-card">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200">
            Contact Support & Feedback / Deeggarsaaf Nu Qunnamuu
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            {language === 'en' ? 'Have custom comments, questions or support issues?' : 'Yaada, gaaffii, yookaan deeggarsa dabalataa qabduu?'}
          </h3>
          <p className="text-sm font-semibold text-slate-600 leading-relaxed max-w-xl">
            {language === 'en' 
              ? 'Our developer is here to assist. Click below to reach out directly with any feedback, questions, or system issues.'
              : 'Karaa ittiin nu qunnamanii yaada, gaafii, fi deeggarsa kkf erguuf imeelii gadii kanaan nu qunnamaa.'
            }
          </p>
          <div className="font-mono text-xs text-slate-500 font-extrabold uppercase mt-2">
            Email / Imeelii: <span className="text-blue-600 select-all border-b border-dashed border-blue-400 pb-0.5">jemalfano030@gmail.com</span>
          </div>
        </div>
        <a 
          href="mailto:jemalfano030@gmail.com?subject=Biftu%20Beri%20Portal%20Support%20%26%20Feedback"
          className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/10 hover:scale-105 active:scale-95 transition-all text-center border-2 border-blue-500/20 shadow-md cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>Contact Us / Nu Qunnamaa</span>
        </a>
      </div>
    </div>
  );
}
