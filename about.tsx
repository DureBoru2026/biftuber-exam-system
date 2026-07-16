import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Sparkles, User, BookOpen, ShieldCheck, Award, Zap, Users, 
  GraduationCap, Clock, Phone, Mail, MapPin, Presentation, FileText, 
  Printer, ChevronLeft, ChevronRight, Check, Download, Plus, Trash2, 
  ArrowUp, ArrowDown, Palette, Settings2, Code, RotateCcw, Lock } from 'lucide-react';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { createAuditLog } from '@/src/lib/firebase';
import biftuExamBlueprint from '@/src/assets/images/biftu_exam_blueprint_1783272362738.jpg';

const initialSlides = [
  {
    title: "Biftu Beri Secondary School Examination and Grading Portal",
    subtitle: "Modern Cloud-Native & AI-Powered Web Platform / Portalii Qorumsaa Ammayyaa AI",
    bullets: [
      "Interactive testing environment matching high-fidelity regulatory standards.",
      "Dynamic grading frameworks (Mid 30 / Final 70) for Grades 9 - 12.",
      "Engineered securely by Jemal Fano Haji | IT Coordinator Team.",
      "Cloud-native Firebase authentication with robust Firestore syncing logs."
    ],
    script: "Dearest academic board, teachers, and honored members of the education bureau, welcome. Today, I am incredibly proud to present the formal presentation of our newly deployed Biftu Beri Examination & Grading Portal. We have engineered this cloud-native system to bridge the digital gap in student assessment, providing high-fidelity national exam mocks and error-free automated report cards directly tailored for Grades 9 to 12. Let's see how this transforms our academic workflow."
  },
  {
    title: "The Core Educational Bottlenecks",
    subtitle: "Why We Built this Digital Infrastructure",
    bullets: [
      "Inadequate offline practice materials for national standard general assessments.",
      "Manual calculations take teachers several anxiety-ridden days at semester's end.",
      "High margin of human error during transcription of mid/final totals for 3,000+ students.",
      "Inconsistent feedback cycles prevent students from targeting their weaker subjects."
    ],
    script: "Before our portal, Biftu Beri Secondary School relied heavily on manual paper-based testing. Teachers spent dozens of unpaid hours drafting assessments, printing costs were immense, and calculating final percentages at the end of Term 2 took days of high stress. Furthermore, a student would only discover their academic weaknesses weeks after the test, missing critical windows for improvement."
  },
  {
    title: "The Modern Decoupled Architecture",
    subtitle: "System Architecture Design",
    bullets: [
      "React 18 & Vite: Fluid, zero-lag single-page user flow layouts.",
      "Cloud Firestore: Fast, schema-validated student records.",
      "Express Server Proxy: Secure, server-side environment shielding for Gemini APIs.",
      "Gemini AI Forge: Automated academic question banks."
    ],
    script: "The solution we built rests on four modern pillars. First, an interactive client view that trains students to complete national mocks in real 120-minute timelines. Second, a classroom assessment module conforming to Oromia guidelines: 30 marks for Mid evaluations, and 70 marks for Finals. Third, an AI Forge powered by Gemini that helps teachers write test items in seconds. And fourth, a fully automated database compiled into printable report cards."
  },
  {
    title: "The 30/70 Scholastic Schema",
    subtitle: "Double-Semester Automated Formula specs",
    bullets: [
      "Semester Score = Mid assessment (Max 30 Marks) + Final Exam (Max 70 Marks).",
      "Dual-semester academic performance balances and averages compiled seamlessly.",
      "Promotion Rule: Annual Cumulative Average >= 50% and >= half subjects passed.",
      "Academic standing is labeled 'PROMOTED / DARBE' or 'RETAINED / KUFE' with absolute transparency."
    ],
    script: "This slide outlines our scholastic algorithm. Unlike legacy spreadsheets where algebraic formulas can be corrupted by manual mistakes, our database handles raw student scores securely. It sums mid and final examinations for Term 1 and Term 2 respectively, combines them into an overall yearly average, and generates letter achievements automatically."
  },
  {
    title: "Functional Roles Matrix & Live Demo",
    subtitle: "Streamlined Digital Classrooms",
    bullets: [
      "Admin Portal: Mass-register students, seed AI chemistry/math, register scores.",
      "Student Workspace: Play timed assessments, check results, view keys.",
      "Parent Dashboard: Direct printing of certified official report cards with stamp.",
      "Document Center: Instant CSV file exports of complete classroom statistics."
    ],
    script: "Our user interface is optimized for high readability. Administrators can mass-register hundreds of students using standard CSV templates. When entering grades, scores exceeding limits of 30 or 70 are dynamically flagged to prevent human error. On the other side, parents can view and instantly print validated annual report cards formatted for standard A4 portrait paper."
  },
  {
    title: "Technical Excellence & Deployment Gain",
    subtitle: "Scalable Infrastructure Overview",
    bullets: [
      "85%+ reduction in administrative teacher calculation work.",
      "Bank-grade security: Complete separation of core credentials.",
      "Responsive sizing: Perfect optimization from layout grids to mobile phones.",
      "Localized Afaan Oromoo / English bilingual dashboard switches."
    ],
    script: "As we prepare for final deployment, Biftu Beri Secondary School is setting a premium standard for digital education in Oromia. We estimate this system will save teachers over 85% of their manual calculation hours, allowing them to focus purely on instruction. We have localized the interfaces into Afaan Oromoo and English alike, guaranteeing that no student or parent is left behind. Thank you."
  }
];

const generateMarpMarkdown = (slidesList: any[], theme: string) => {
  let md = `---
marp: true
theme: ${theme === 'light' ? 'default' : 'gaia'}
size: 16:9
_class: lead
paginate: true
backgroundColor: ${theme === 'light' ? '#f8fafc' : '#0b0f19'}
color: ${theme === 'light' ? '#0f172a' : '#ffffff'}
---

# Biftu Beri Systems Presentation
## Automated Documentation Slide Deck
Coordinator: Jemal Fano Haji | IT Director
Date: June 2026 G.C / 2018 E.C

---
`;

  slidesList.forEach((slide, idx) => {
    md += `\n<!-- Slide ${idx + 1} -->\n`;
    md += `<!-- _class: ${theme === 'light' ? 'default' : 'invert'} -->\n`;
    md += `\n# **${slide.title}**\n`;
    if (slide.subtitle) {
      md += `### *${slide.subtitle}*\n\n`;
    }
    slide.bullets.forEach((bullet: string) => {
      if (bullet.trim()) {
        md += `- ${bullet}\n`;
      }
    });
    if (slide.script) {
      md += `\n<!-- Speaker Notes: \n${slide.script}\n-->\n`;
    }
    md += `\n---\n`;
  });

  return md;
};

const generateHTMLPresentation = (slidesList: any[], theme: string) => {
  const slidesJSON = JSON.stringify(slidesList, null, 2);
  const isDark = theme === 'dark';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biftu Beri - Slide Deck Presentation</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: ${isDark ? '#0b0f19' : '#f8fafc'};
      --text: ${isDark ? '#f1f5f9' : '#0f172a'};
      --card-bg: ${isDark ? '#111827' : '#ffffff'};
      --border: ${isDark ? '#374151' : '#e5e7eb'};
      --accent: #4f46e5;
      --accent-hover: #4338ca;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      transition: background-color 0.3s, color 0.3s;
    }
    
    header {
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: var(--card-bg);
    }
    
    header h1 {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      text-transform: uppercase;
    }
    
    .logo-badge {
      background: #000;
      color: #eab308;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 950;
      font-size: 1.2rem;
      margin-right: 10px;
    }
    
    .presentation-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      position: relative;
    }
    
    .slide-viewer {
      width: 100%;
      max-width: 1000px;
      aspect-ratio: 16/10;
      background: var(--card-bg);
      border: 3px solid var(--border);
      border-radius: 24px;
      padding: 40px 60px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
    }
    
    .slide-subtitle {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent);
      margin-top: 8px;
    }
    
    .slide-content {
      margin: 40px 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .bullet-item {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      font-size: 1.15rem;
      line-height: 1.6;
      font-weight: 500;
    }
    
    .bullet-icon {
      color: var(--accent);
      font-weight: 800;
    }
    
    footer {
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border);
      background: var(--card-bg);
    }
    
    .speaker-notes-toggle {
      background: var(--card-bg);
      border: 1.5px solid var(--border);
      color: var(--text);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.15s;
    }
    
    .speaker-notes-toggle:active {
      transform: scale(0.95);
    }
    
    .speaker-notes-drawer {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 800px;
      background: var(--card-bg);
      border: 2px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.1);
      display: none;
      z-index: 100;
    }
    
    .speaker-notes-title {
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 8px;
      color: var(--accent);
    }
    
    .speaker-notes-text {
      font-style: italic;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    
    .nav-btn {
      background: var(--accent);
      color: white;
      border: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.2rem;
      transition: background-color 0.2s, transform 0.1s;
    }
    
    .nav-btn:hover {
      background: var(--accent-hover);
    }
    
    .nav-btn:active {
      transform: scale(0.9);
    }
    
    .slide-index {
      font-weight: 700;
      font-size: 0.85rem;
    }
    
    .keyboard-hint {
      position: absolute;
      top: 25px;
      right: 40px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <header>
    <div style="display: flex; align-items: center;">
      <div class="logo-badge">B</div>
      <div>
        <h1>Biftu Beri</h1>
        <p style="font-size: 0.65rem; font-weight: 750; opacity: 0.7; letter-spacing: 0.05em; text-transform: uppercase;">Examination & Grading Presentation</p>
      </div>
    </div>
    <div class="keyboard-hint">Keyboards: ← Left / → Right / Space</div>
  </header>
  
  <main class="presentation-container">
    <div class="slide-viewer" id="slide-viewer">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.65rem; font-weight: 800; letter-spacing: 0.2em; border: 1.5px solid var(--border); padding: 4px 8px; border-radius: 6px; text-transform: uppercase;">Slide Unit</span>
          <span style="font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; opacity: 0.5;">2026 G.C / 2018 E.C</span>
        </div>
        <h2 id="slide-title" style="font-size: 2.2rem; font-weight: 850; letter-spacing: -0.03em; margin-top: 20px; line-height: 1.15; border-left: 5px solid var(--accent); padding-left: 15px;"></h2>
        <p id="slide-subtitle" class="slide-subtitle"></p>
      </div>
      
      <div id="slide-content" class="slide-content"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px;">
        <span style="font-size: 0.65rem; font-weight: 800; opacity: 0.6; letter-spacing: 0.05em; text-transform: uppercase;">JEMAL FANO HAJI | Coordinator</span>
        <span id="slide-number-label" style="font-size: 0.75rem; font-weight: 700;"></span>
      </div>
    </div>
  </main>
  
  <div class="speaker-notes-drawer" id="notes-drawer">
    <div class="speaker-notes-title">Speaker Script & Notes</div>
    <div class="speaker-notes-text" id="notes-text"></div>
  </div>
  
  <footer>
    <button class="speaker-notes-toggle" id="toggle-notes">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      Speaker Notes
    </button>
    <div style="display: flex; align-items: center; gap: 15px;">
      <button class="nav-btn" id="prev-btn">←</button>
      <span class="slide-index" id="current-slide-idx"></span>
      <button class="nav-btn" id="next-btn">→</button>
    </div>
  </footer>

  <script>
    const slides = ${slidesJSON};
    let currentIdx = 0;
    
    const titleEl = document.getElementById('slide-title');
    const subtitleEl = document.getElementById('slide-subtitle');
    const contentEl = document.getElementById('slide-content');
    const indexEl = document.getElementById('current-slide-idx');
    const numLabelEl = document.getElementById('slide-number-label');
    const notesEl = document.getElementById('notes-text');
    const drawerEl = document.getElementById('notes-drawer');
    const viewerEl = document.getElementById('slide-viewer');
    
    function renderSlide() {
      const slide = slides[currentIdx];
      
      viewerEl.style.opacity = '0';
      viewerEl.style.transform = 'scale(0.98)';
      
      setTimeout(() => {
        titleEl.textContent = slide.title;
        subtitleEl.textContent = slide.subtitle || '';
        
        contentEl.innerHTML = '';
        slide.bullets.forEach(bullet => {
          if (bullet.trim()) {
            const div = document.createElement('div');
            div.className = 'bullet-item';
            div.innerHTML = '<span class="bullet-icon">&#10004;</span><span>' + bullet + '</span>';
            contentEl.appendChild(div);
          }
        });
        
        indexEl.textContent = (currentIdx + 1) + ' / ' + slides.length;
        numLabelEl.textContent = 'PAGE ' + (currentIdx + 1);
        notesEl.textContent = slide.script || 'No script defined for this slide.';
        
        viewerEl.style.opacity = '1';
        viewerEl.style.transform = 'scale(1)';
      }, 200);
    }
    
    document.getElementById('prev-btn').addEventListener('click', () => {
      currentIdx = (currentIdx - 1 + slides.length) % slides.length;
      renderSlide();
    });
    
    document.getElementById('next-btn').addEventListener('click', () => {
      currentIdx = (currentIdx + 1) % slides.length;
      renderSlide();
    });
    
    document.getElementById('toggle-notes').addEventListener('click', () => {
      if(drawerEl.style.display === 'block') {
        drawerEl.style.display = 'none';
      } else {
        drawerEl.style.display = 'block';
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        currentIdx = (currentIdx + 1) % slides.length;
        renderSlide();
      } else if (e.key === 'ArrowLeft') {
        currentIdx = (currentIdx - 1 + slides.length) % slides.length;
        renderSlide();
      }
    });
    
    renderSlide();
  </script>
</body>
</html>`;
};

export default function About() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [subTab, setSubTab] = useState<'overview' | 'report'>('overview');
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Slide Deck Generator States
  const [slideDeck, setSlideDeck] = useState(initialSlides);
  const [slideTheme, setSlideTheme] = useState<'dark' | 'light'>('dark');

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slideDeck.length);
  };

  const handlePrevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + slideDeck.length) % slideDeck.length);
  };

  const handleUpdateSlideField = (index: number, field: string, value: any) => {
    setSlideDeck(prev => prev.map((slide, i) => {
      if (i === index) {
        return { ...slide, [field]: value };
      }
      return slide;
    }));
  };

  const handleAddSlide = () => {
    const newSlide = {
      title: "New Academic Slide Topic",
      subtitle: "Biftu Beri Subtitle",
      bullets: [
        "First primary academic benchmark line entry.",
        "Second custom indicator or evaluation metric."
      ],
      script: "Speaker guide notes for presenting this newly generated custom slide to your academic partners or school administration."
    };
    setSlideDeck([...slideDeck, newSlide]);
    setActiveSlide(slideDeck.length);
  };

  const handleDeleteSlide = (index: number) => {
    if (slideDeck.length <= 1) return;
    const nextDeck = slideDeck.filter((_, i) => i !== index);
    setSlideDeck(nextDeck);
    setActiveSlide(Math.max(0, index - 1));
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slideDeck.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const nextDeck = [...slideDeck];
    const temp = nextDeck[index];
    nextDeck[index] = nextDeck[targetIdx];
    nextDeck[targetIdx] = temp;
    
    setSlideDeck(nextDeck);
    setActiveSlide(targetIdx);
  };

  const handleDownloadMarp = () => {
    const markdownContent = generateMarpMarkdown(slideDeck, slideTheme);
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biftu_beri_presentation_slides.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHTML = () => {
    const htmlContent = generateHTMLPresentation(slideDeck, slideTheme);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biftu_beri_presentation_interactive.html';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintSlides = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      
      {/* RENDER IN VISIBLE PRINT SCREEN ONLY DECK */}
      <div className="printable-slide-deck hidden print:block">
        {slideDeck.map((slide, idx) => (
          <div 
            key={idx} 
            className={slideTheme === 'light' ? 'printable-single-slide-light' : 'printable-single-slide'}
          >
            <div>
              <div className="flex justify-between items-center border-b border-gray-150/15 pb-4">
                <span className="text-[10px] font-black tracking-widest uppercase">Slide {idx + 1} of {slideDeck.length}</span>
                <span className="text-xs font-mono font-black">Biftu Beri Systems Presentation</span>
              </div>
              <h2 className="text-3xl font-black uppercase mt-10 pl-5 border-l-4 border-indigo-600 tracking-tight leading-tight">
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="text-xs font-black uppercase tracking-widest text-indigo-500 pl-6 mt-3">
                  {slide.subtitle}
                </p>
              )}
              <div className="mt-8 space-y-5 pl-6">
                {slide.bullets.map((b, bIdx) => (
                  b.trim() && (
                    <div key={bIdx} className="flex items-start gap-4">
                      <span className="text-indigo-600 font-extrabold text-lg leading-none">&#10004;</span>
                      <span className="text-base font-bold leading-relaxed">{b}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t border-gray-150/15 pt-5">
              <span className="text-[9px] font-black uppercase tracking-wider">JEMAL FANO HAJI | IT Coordinator</span>
              <span className="text-[9px] font-black uppercase">Slide Page {idx + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Premium Segment Control for Sub Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200/80 max-w-2xl mx-auto print:hidden">
        <button
          onClick={() => setSubTab('overview')}
          className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${subTab === 'overview' ? 'bg-white text-slate-950 shadow-md border border-slate-200/40 font-black' : 'text-slate-500 hover:text-slate-950'}`}
        >
          <Award size={14} className="text-blue-600" />
          <span>School portal</span>
        </button>

        <button
          onClick={() => setSubTab('report')}
          className={`flex-1 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${subTab === 'report' ? 'bg-white text-slate-950 shadow-md border border-slate-200/40 font-black' : 'text-slate-500 hover:text-slate-950'}`}
        >
          <FileText size={14} className="text-emerald-600" />
          <span>Academic Report</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {subTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-16 print:hidden"
          >
            {/* Overview Intro Banner */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full font-black tracking-widest uppercase border border-indigo-100">
                Biftu Beri Secondary School
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight uppercase leading-tight">
                Academic & Student Evaluation Platform
              </h2>
              <p className="text-sm md:text-base text-slate-550 font-medium leading-relaxed">
                Empowering Oromia high school classrooms with structured offline exam preparation, automated 30/70 grade compilation records, and beautifully optimized printable A4 performance cards.
              </p>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div id="metric_students" className="bg-white p-8 rounded-[32px] border border-slate-150 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Active Learners</h4>
                  <div className="text-3xl font-black text-slate-900 mt-1">1,250+</div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Grades 9 - 12 classrooms</p>
                </div>
              </div>

              <div id="metric_formula" className="bg-white p-8 rounded-[32px] border border-slate-150 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Target size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Evaluation Schema</h4>
                  <div className="text-3xl font-black text-slate-900 mt-1">30 / 70</div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Mid and Final Exam aggregation</p>
                </div>
              </div>

              <div id="metric_time" className="bg-white p-8 rounded-[32px] border border-slate-150 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Clock size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Speed Benchmark</h4>
                  <div className="text-3xl font-black text-slate-900 mt-1">120 Min</div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Simulated national assessment time</p>
                </div>
              </div>

              <div id="metric_bilingual" className="bg-white p-8 rounded-[32px] border border-slate-150 shadow-sm hover:shadow-md transition-all space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Bilingualism</h4>
                  <div className="text-3xl font-black text-slate-900 mt-1">Bilingual</div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Afaan Oromoo & English switch</p>
                </div>
              </div>
            </div>

            {/* Structured School Vision Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Digital Vision & Excellence</span>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                    Fostering Academic Growth Through Intelligent Assessments
                  </h3>
                </div>
                <p className="text-sm text-slate-650 leading-relaxed font-medium">
                  At Biftu Beri Secondary School, we recognize the critical challenge of high-stakes national testing. Our application serves to completely prepare students through mock trials that mimic physical examination timelines and grading structures. 
                </p>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 bg-indigo-50 rounded-md flex items-center justify-center text-indigo-600 shrink-0 mt-0.5 border border-indigo-100">
                      <Check size={12} className="stroke-[3]" />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Structured Performance Recording</h5>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">A central database that eliminates calculation errors, compiling dual semesters with accurate averages and immediate scholastic standing codes.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-5 h-5 bg-indigo-50 rounded-md flex items-center justify-center text-indigo-600 shrink-0 mt-0.5 border border-indigo-100">
                      <Check size={12} className="stroke-[3]" />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">AI Forge Question Seeder</h5>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">Instantly construct examination materials, math challenges, and organic chemistry quizzes using our secure Google Gemini server-side environment.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Biftu Beri Exam System Architecture Diagram / Blueprint */}
              <div className="relative group overflow-hidden rounded-[44px] border-4 border-slate-900 bg-white p-2.5 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] hover:shadow-[16px_16px_0px_0px_rgba(15,23,42,1)] hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-5 left-5 z-10 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md">
                  System Architecture Blueprint
                </div>
                <img 
                  src={biftuExamBlueprint} 
                  alt="Biftu Beri Exam System Architecture & Roles Blueprint"
                  className="w-full h-full object-cover rounded-[34px] aspect-[3/2] select-none pointer-events-none transition-transform duration-500 group-hover:scale-[1.02]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </motion.div>
        )}

        {(subTab as string) === 'presentation' && (
          <motion.div
            key="presentation"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden"
          >
            {/* Slide Presentation Generator Side Control Tool Panel */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-205 shadow-sm p-6 space-y-6">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Settings2 size={12} className="text-indigo-600" />
                    Generator Workspace
                  </h4>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Slide Deck Builder</h3>
                </div>

                {/* Theme Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
                    <span>Presentation Theme</span>
                    <Palette size={12} className="text-indigo-505" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSlideTheme('dark')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${slideTheme === 'dark' ? 'bg-slate-900 text-white font-black border border-slate-900' : 'bg-slate-50 text-slate-600 border border-slate-150 hover:bg-slate-100'}`}
                    >
                      Dark Cosmic
                    </button>
                    <button
                      onClick={() => setSlideTheme('light')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${slideTheme === 'light' ? 'bg-indigo-600 text-white font-black border border-indigo-600' : 'bg-slate-50 text-slate-600 border border-slate-150 hover:bg-slate-100'}`}
                    >
                      Light Academic
                    </button>
                  </div>
                </div>

                {/* Slides Directory with Actions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Slides Registry ({slideDeck.length})
                    </label>
                    <button 
                      onClick={handleAddSlide}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg flex items-center gap-1 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                      title="Add Custom Slide"
                    >
                      <Plus size={11} />
                      <span>Add</span>
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-slate-50">
                    {slideDeck.map((slide, sIdx) => (
                      <div 
                        key={sIdx} 
                        onClick={() => setActiveSlide(sIdx)}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all ${activeSlide === sIdx ? 'bg-white shadow-sm border border-slate-200' : 'hover:bg-white/60'}`}
                      >
                        <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0">#{sIdx + 1}</span>
                        <span className="text-[11px] font-bold truncate text-slate-800 grow text-left">{slide.title}</span>
                        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button 
                            disabled={sIdx === 0}
                            onClick={() => handleMoveSlide(sIdx, 'up')}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button 
                            disabled={sIdx === slideDeck.length - 1}
                            onClick={() => handleMoveSlide(sIdx, 'down')}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button 
                            disabled={slideDeck.length <= 1}
                            onClick={() => handleDeleteSlide(sIdx)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interactive Current Slide Editor */}
                <div className="border-t border-slate-150 pt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-600 tracking-widest block">Slide Title</label>
                    <input 
                      type="text" 
                      value={slideDeck[activeSlide]?.title || ''} 
                      onChange={e => handleUpdateSlideField(activeSlide, 'title', e.target.value)}
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white transition-all outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-600 tracking-widest block">Slide Subtitle</label>
                    <input 
                      type="text" 
                      value={slideDeck[activeSlide]?.subtitle || ''} 
                      onChange={e => handleUpdateSlideField(activeSlide, 'subtitle', e.target.value)}
                      className="w-full p-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white transition-all outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase text-indigo-600 tracking-widest">
                      <span>Slide Bullets</span>
                      <span className="text-[8px] text-slate-400 italic">Separate by line</span>
                    </div>
                    <textarea 
                      rows={3}
                      value={slideDeck[activeSlide]?.bullets.join('\n') || ''} 
                      onChange={e => handleUpdateSlideField(activeSlide, 'bullets', e.target.value.split('\n'))}
                      className="w-full p-2 text-xs font-mono font-bold border border-slate-205 rounded-lg bg-slate-50 focus:bg-white transition-all outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 leading-normal"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-600 tracking-widest block">Speaker script / note</label>
                    <textarea 
                      rows={3}
                      value={slideDeck[activeSlide]?.script || ''} 
                      onChange={e => handleUpdateSlideField(activeSlide, 'script', e.target.value)}
                      className="w-full p-2 text-xs font-semibold border border-slate-205 rounded-lg bg-slate-50 focus:bg-white transition-all outline-none focus:ring-1 focus:ring-indigo-500 leading-normal text-slate-700"
                    />
                  </div>
                </div>

              </div>

              {/* Export Panel Options */}
              <div className="bg-white rounded-3xl border border-slate-205 shadow-sm p-6 space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Export Live Presentation File</span>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={handleDownloadMarp}
                    className="w-full p-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Code size={13} className="text-yellow-405" />
                    <span>Marp Slide Pitch (.md)</span>
                  </button>
                  <button 
                    onClick={handleDownloadHTML}
                    className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm shadow-indigo-500/10"
                  >
                    <Presentation size={13} />
                    <span>Interactive HTML Deck (.html)</span>
                  </button>
                  <button 
                    onClick={handlePrintSlides}
                    className="w-full p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Printer size={13} />
                    <span>Print Slide Landscape PDF</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Interactive Professional Presentation Pitch Deck Viewer */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-indigo-50 border border-indigo-150 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5 leading-none">
                    <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                    Biftu Beri Live Presentation Pitch
                  </h4>
                  <p className="text-[10px] text-indigo-750 font-bold uppercase tracking-wide leading-normal">
                    Interactive generator screen. Keyboard navigation: Space/Arrows are active in HTML exports!
                  </p>
                </div>
                <div className="px-4 py-2 bg-indigo-650 text-white rounded-xl text-[10px] font-mono font-black select-none">
                  SLIDE {activeSlide + 1} / {slideDeck.length}
                </div>
              </div>

              {/* High Fidelity Presentation Screen Canvas */}
              <div className={`rounded-[36px] shadow-xl p-8 md:p-14 aspect-[16/10] flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${slideTheme === 'light' ? 'bg-slate-50 border-4 border-slate-200 text-slate-900 border-indigo-100' : 'bg-slate-950 border-8 border-slate-900 text-white'}`}>
                
                {/* Background sliding watermark */}
                <div className={`absolute right-[-10%] bottom-[-10%] font-black uppercase text-8xl tracking-tight select-none pointer-events-none font-sans ${slideTheme === 'light' ? 'text-slate-200/40' : 'text-white/5'}`}>
                  SLIDE_{activeSlide + 1}
                </div>

                {/* Slide Title */}
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${slideTheme === 'light' ? 'bg-slate-200/50 text-slate-600 border border-slate-300/40' : 'bg-white/10 text-slate-300 border border-white/5'}`}>
                      Biftu Beri Assessment Portal
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">2026 G.C / 2018 E.C</span>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className={`text-xl md:text-3.5xl font-sans font-black uppercase tracking-tight leading-tight border-l-4 pl-4 ${slideTheme === 'light' ? 'border-indigo-600 text-slate-900' : 'border-indigo-500 text-white'}`}>
                      {slideDeck[activeSlide]?.title || 'Custom Slide Title'}
                    </h3>
                    {slideDeck[activeSlide]?.subtitle && (
                      <p className="text-[11px] md:text-xs text-indigo-500 font-extrabold uppercase tracking-widest leading-none pl-5">
                        {slideDeck[activeSlide]?.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Slide Bullets */}
                <div className="space-y-4 pl-5 relative z-10 py-6">
                  {slideDeck[activeSlide]?.bullets.map((bullet, idx) => (
                    bullet.trim() && (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${slideTheme === 'light' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-indigo-950/45 text-indigo-400 border-indigo-700/30'}`}>
                          <Check size={12} className="stroke-[3]" />
                        </div>
                        <span className={`text-xs md:text-base font-bold leading-relaxed ${slideTheme === 'light' ? 'text-slate-755' : 'text-slate-300'}`}>{bullet}</span>
                      </div>
                    )
                  ))}
                </div>

                {/* Navigation and Authoring indicator footer */}
                <div className={`flex items-center justify-between border-t pt-5 relative z-10 ${slideTheme === 'light' ? 'border-slate-200' : 'border-slate-850'}`}>
                  <span className={`text-[9px] font-black tracking-widest uppercase ${slideTheme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>JEMAL FANO HAJI | Coordinator</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevSlide}
                      className={`p-2 rounded-xl transition-all cursor-pointer active:scale-90 border text-xs ${slideTheme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700' : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'}`}
                      title="Previous Slide"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={handleNextSlide}
                      className="p-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl transition-all cursor-pointer active:scale-95 shadow-md shadow-indigo-500/10"
                      title="Next Slide"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

              </div>

              {/* Speaker Notes */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3 shadow-none text-left">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                  <User size={12} />
                  Biftu Beri Speaker Notes
                </span>
                <p className="text-xs text-slate-705 font-semibold leading-relaxed italic pr-4 border-l-2 border-indigo-500 pl-4 py-2 bg-white/40 rounded-lg">
                  "{slideDeck[activeSlide]?.script || 'No speaker script entered for this slide.'}"
                </p>
              </div>

            </div>
          </motion.div>
        )}

        {subTab === 'report' && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Controls banner for PDF render */}
            {isAdmin ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 print:hidden max-w-4xl mx-auto animate-fade-in">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-2">
                    <FileText className="text-emerald-600" size={18} />
                    Print Grade Report Document (PDF Export Area)
                  </h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
                    Click the print button below to layout this research-grade academic project implementation report directly to A4 portrait sheet or save as standard PDF file.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (isAdmin) {
                      createAuditLog('print_report', 'About', undefined, 'Project Academic Implementation Report');
                    }
                    window.print();
                  }}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Print Academic Report</span>
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 print:hidden max-w-4xl mx-auto animate-fade-in">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-2">
                    <Lock className="text-amber-600" size={18} />
                    Unprivileged Access • Publication Read-Only Mode
                  </h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
                    You are viewing the operational documentation under a restricted read-only role. Text copying, signature views, detailed database structures, configuration keys, and printing are locked.
                  </p>
                </div>
                <span className="px-4 py-2 bg-amber-100 border border-amber-200 text-amber-800 rounded-xl font-black text-[10px] uppercase tracking-widest leading-none flex items-center gap-1.5 shadow-sm">
                  <Lock size={12} />
                  READ ONLY
                </span>
              </div>
            )}

            {/* The report card template page formatted for printing centerized A4 portrait sheets */}
            <div 
              onCopy={(e) => {
                if (!isAdmin) {
                  e.preventDefault();
                }
              }}
              className={`printable-report-card bg-white rounded-[40px] border-8 border-slate-900 shadow-2xl p-10 md:p-16 max-w-4xl mx-auto space-y-12 relative overflow-hidden print:border-none print:shadow-none print:p-0 ${!isAdmin ? 'select-none print:hidden' : ''}`}
            >
              
              {/* Report Header Logo */}
              <div className="border-b-4 border-slate-900 pb-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 bg-slate-950 text-yellow-400 rounded-[24px] border-4 border-slate-800 flex items-center justify-center text-4xl font-extrabold shadow-lg select-none">
                    B
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tight">
                      Biftu Beri Secondary School
                    </h2>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">
                      Academic Assessment Portal Deployment Project Report
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mt-1">
                      Operational Documentation & System Implementation Guide
                    </p>
                  </div>
                </div>
                <div className="text-center sm:text-right border-2 border-slate-900 p-3 rounded-2xl bg-slate-50 font-sans">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PUBLICATION ID</span>
                  <strong className="block text-xs text-blue-850 font-black">BB-RPT-2026-05</strong>
                  <span className="text-[8px] font-black text-slate-400 mt-0.5 uppercase tracking-wider">Academics: Grade 9 - 12</span>
                </div>
              </div>

              {/* Page Section 1: Executive Summary */}
              <div className="space-y-4 text-left">
                <span className="text-[10px] bg-slate-950 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">SECTION 1</span>
                <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Executive Narrative</h3>
                <div className="space-y-4 text-sm text-slate-700 leading-relaxed text-justify font-medium">
                  <p>
                    The Biftu Beri Examination & Grading Portal System is an offline-capable, cloud-native full-stack software application engineered to revolutionize preparation for the Ethiopian National Examination (EAES) and automate secondary school classroom grading workflows for Grades 9 through 12. 
                    The system delivers a highly responsive, customized testing environment, an administrative grade record portal aligning with the standardized 30 Marks (Mid-Exam) + 70 Marks (Final Exam) evaluation schema, and compiles double-semester academic performances into beautiful, printable, security-stamped digital Report Cards.
                  </p>
                  <p>
                    Engineered through a collaborative technical partnership between <strong>Jemal Fano Haji (IT Coordinator & Lead Author)</strong> and Google AI Studio's advanced agent intelligence, the program provides high-fidelity simulated assessment spaces. It guarantees educational continuity and modernizes academic transcript compilation throughout Oromia's high schools.
                  </p>
                </div>
              </div>

              {/* Page Section 2: Platform Provisions & Core Capabilities */}
              <div className="space-y-4 text-left">
                <span className="text-[10px] bg-slate-950 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">SECTION 2</span>
                <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight text-left">Core Platform Provisions & Functions</h3>
                <p className="text-sm text-slate-700 leading-relaxed text-justify font-medium">
                  The architecture provides a multi-role workspace custom-tailored for secondary school administrators, subject teachers, students, and parent advisors. The platform delivers four key primary pillars:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="relative border-2 border-slate-900 p-5 rounded-3xl bg-slate-50 space-y-2">
                    <span className="absolute -top-3 left-4 bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Assessment</span>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mt-1">High-Fidelity Simulated Exams Room</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Features a rigorous testing dashboard with an exact <strong>120-minute countdown simulator</strong>. Includes an integrated anti-cheat defense tracking user page blurs, real-time question progress maps, automated question shuffling arrays, and beautiful review panels containing instant rationales.
                    </p>
                  </div>

                  <div className="relative border-2 border-slate-900 p-5 rounded-3xl bg-slate-50 space-y-2">
                    <span className="absolute -top-3 left-4 bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Bilingual</span>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mt-1">Double-Language Localized Controls</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      To promote inclusivity, the app features a robust dual-language toggle between <strong>English</strong> and <strong>Afaan Oromoo</strong>. All primary assessment labels, marks records headers, certificates titles, navigation prompts, and report headers adjust dynamically on-the-fly.
                    </p>
                  </div>

                  <div className="relative border-2 border-slate-900 p-5 rounded-3xl bg-slate-50 space-y-2">
                    <span className="absolute -top-3 left-4 bg-amber-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Dynamic Sync</span>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mt-1">Live Online Attempts Compilation</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The system features a dynamic integration sync engine. Instead of forcing manual transcription of online exams, the compiler automatically retrieves students' finished attempts, normalizes subject names, scales percentages (e.g., matching Mid-term to 30%, Finals to 70%, and Model mocks to 100%), identifies semesters based on metadata keywords, and generates real-time report cards.
                    </p>
                  </div>

                  <div className="relative border-2 border-slate-900 p-5 rounded-3xl bg-slate-50 space-y-2">
                    <span className="absolute -top-3 left-4 bg-rose-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Generative Agent</span>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mt-1">Google Gemini AI Question Forge</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Enables administrators to generate complete, high-fidelity national test forms in seconds. Operating securely over our server-side Express routes to protect administrative credentials, teachers can input custom subjects, grades, streams, and special topics to create structured multiple-choice exams directly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Page Section 3: Relational Schema DB Model & Visual Blueprint */}
              <div className="space-y-4 text-left">
                <span className="text-[10px] bg-slate-950 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">SECTION 3</span>
                <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">System Data Architecture & Applied Schema Image</h3>
                <p className="text-sm text-slate-700 leading-relaxed text-justify font-medium">
                  The infrastructure minimizes network dependencies. System collections, user metadata structures, and test-taking telemetry flows are mapped dynamically through Firestore documents. The interactive diagram below illustrates the schematic structure of database collections, their type attributes, and how the compilation sync engine aggregates online attempts into students' academic report cards:
                </p>

                {/* VISUAL BLUEPRINT GRAPHIC (DIRECT REACTION TIGHT GRID DIAGRAM) */}
                <div id="system_architecture_map" className="border-2 border-slate-900 rounded-[28px] p-6 md:p-8 bg-slate-955 text-slate-900 space-y-8 select-none font-sans overflow-x-auto">
                  <div className="text-center space-y-1">
                    <span className="text-[9px] font-mono tracking-widest uppercase bg-slate-200 px-3 py-1 rounded-md border border-slate-300 font-extrabold text-slate-700">Data Architecture Flowchart</span>
                    <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">Biftu Beri Systems Integration Schema</h4>
                  </div>

                  {/* Flow Layout Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch min-w-[650px] relative">
                    
                    {/* Column 1: Static Input Models */}
                    <div className="border border-slate-300 p-4 rounded-2xl bg-white space-y-4 flex flex-col justify-between relative overflow-hidden">
                      {!isAdmin && (
                        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[4px] rounded-2xl flex flex-col items-center justify-center p-3 text-center z-10 select-none">
                          <Lock size={20} className="text-slate-800 animate-pulse mb-1" />
                          <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest bg-white border border-slate-350 px-2 py-0.5 rounded shadow-sm">
                            Restricted Attributes
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider">COLLECTION 1: profiles</div>
                        <h5 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight mt-1">/users</h5>
                        <ul className={`text-[10px] font-mono mt-3 space-y-1.5 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 ${!isAdmin ? 'blur-[2px]' : ''}`}>
                          <li><strong>uid:</strong> String (Auth Ref)</li>
                          <li><strong>fullName:</strong> String</li>
                          <li><strong>sid:</strong> "STDT_XXXXXX"</li>
                          <li><strong>grade:</strong> "9" | "10" | "11" | "12"</li>
                          <li><strong>stream:</strong> "natural" | "social"</li>
                        </ul>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">User profile container loaded during session authentication.</p>
                    </div>

                    {/* Column 2: Interactive Assessment Tracks */}
                    <div className="border border-slate-300 p-4 rounded-2xl bg-white space-y-4 flex flex-col justify-between relative overflow-hidden">
                      {/* Connection arrows indicating flow */}
                      <div className="hidden md:block absolute right-[-15px] top-1/2 -translate-y-1/2 bg-white border border-slate-300 text-slate-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-sm z-10">
                        &rarr;
                      </div>
                      <div className="hidden md:block absolute left-[-15px] top-1/2 -translate-y-1/2 bg-white border border-slate-300 text-slate-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-sm z-10">
                        &larr;
                      </div>
                      {!isAdmin && (
                        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[4px] rounded-2xl flex flex-col items-center justify-center p-3 text-center z-10 select-none">
                          <Lock size={20} className="text-slate-800 animate-pulse mb-1" />
                          <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest bg-white border border-slate-350 px-2 py-0.5 rounded shadow-sm">
                            Telemetry Restricted
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider">COLL 2: live telemetry tracking</div>
                        <h5 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight mt-1">/exams + /attempts</h5>
                        <ul className={`text-[10px] font-mono mt-3 space-y-1.5 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 ${!isAdmin ? 'blur-[2px]' : ''}`}>
                          <li><strong>examId:</strong> String (Document Ref)</li>
                          <li><strong>studentId:</strong> String (FUID Ref)</li>
                          <li><strong>score:</strong> Scaled score decimal</li>
                          <li><strong>totalPoints:</strong> Match question count</li>
                          <li><strong>type:</strong> "mid" | "final" | "model"</li>
                        </ul>
                      </div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Dynamic Synchronized on-the-fly compilation.</p>
                    </div>

                    {/* Column 3: Consolidated Reports compilation */}
                    <div className="border border-slate-300 p-4 rounded-2xl bg-white space-y-4 flex flex-col justify-between relative overflow-hidden">
                      {!isAdmin && (
                        <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[4px] rounded-2xl flex flex-col items-center justify-center p-3 text-center z-10 select-none">
                          <Lock size={20} className="text-slate-800 animate-pulse mb-1" />
                          <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest bg-white border border-slate-350 px-2 py-0.5 rounded shadow-sm">
                            Archives Restricted
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] font-extrabold text-amber-600 uppercase tracking-wider">COLL 3: grade archives</div>
                        <h5 className="font-extrabold text-xs text-slate-900 uppercase tracking-tight mt-1">/marks (Class Records)</h5>
                        <ul className={`text-[10px] font-mono mt-3 space-y-1.5 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 ${!isAdmin ? 'blur-[2px]' : ''}`}>
                          <li><strong>studentId:</strong> String</li>
                          <li><strong>subject:</strong> Normalized name</li>
                          <li><strong>term:</strong> "term_1" | "term_2"</li>
                          <li><strong>assessmentType:</strong> "mid" | "final"</li>
                          <li><strong>score:</strong> 0-30 mid-term / 0-70 final</li>
                        </ul>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">Static teacher records entered by CSV or manual grids.</p>
                    </div>

                  </div>

                  {/* Schema compiler aggregation notes */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 text-xs text-slate-700 leading-relaxed text-left flex items-start gap-3">
                    <span className="text-amber-500 font-black text-lg">&#9888;</span>
                    <div>
                      <strong>The Report compiler logic:</strong> Prioritizes teacher-entered manual or CSV uploaded records inside <code>/marks</code>. If no recording file row is present for a specific subject, term, and evaluation slot, the compiler performs safe real-time lookups inside student mock documents, scales the score with high algebra precision, and displays it transparently in reports!
                    </div>
                  </div>
                </div>
              </div>

              {/* Page Section 4: Academic Promotion Specs */}
              <div className="space-y-4 text-left">
                <span className="text-[10px] bg-slate-950 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">SECTION 4</span>
                <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Mathematical Promotion Formula Outline</h3>
                <p className="text-sm text-slate-700 leading-relaxed text-justify font-medium">
                  {"The cumulative scores per term R are processed as raw summation sequences: R_Term = S_Mid (30) + S_Final (70). For any student with registered subjects, the annual cumulative score is determined dynamically. A student is flagged as passed if the compiled scholastic achievement exceeds 50% and they have passed a majority of subjects:"}
                </p>
                <div className="bg-slate-900 text-white rounded-3xl p-6 font-mono text-xs md:text-sm text-center leading-relaxed">
                  <p>{"Cumulative Average % = (Sem1_Total_Marks + Sem2_Total_Marks) / Active_Semesters_Count"}</p>
                  <p className="mt-2 text-[11px] text-indigo-300">{"Promotion Code Status: (Overall_Avg >= 50% && Passed_Count >= Total_Count / 2) ? PROMOTED : RETAINED"}</p>
                </div>
              </div>

              {/* Operational Guide details & Setup */}
              <div className="space-y-4 text-left relative">
                <span className="text-[10px] bg-slate-950 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">SECTION 5</span>
                <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">IT Maintenance & Seeding Instructions</h3>
                {isAdmin ? (
                  <p className="text-sm text-slate-700 leading-relaxed text-justify font-medium">
                    1. Deploy to Docker / Google Cloud Run container. Bind runtime port to 3000.  <br/>
                    2. Ensure environment secrets (`GEMINI_API_KEY`) are declared safely server-side to bypass client browsers exposure risks. <br/>
                    3. In the "Reports & Marks" dashboard, admins can mass import student layouts using Standard CSV downloads during high-stress exam months. Use the custom Excel templates provided inside the Marks section for classroom updates.
                  </p>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50 flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Administrative Information Redacted</h4>
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed mt-2">
                        Deployment containers metadata, environment variables, authentication protocols, and CSV database seed guides are protected. Authenticated administrator account required.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Signature stamp footers */}
              <div className="print-signature-area grid grid-cols-3 gap-8 pt-12 border-t-2 border-dashed border-slate-400 text-center text-[10px] font-black uppercase text-slate-500 print:pt-4 relative">
                {!isAdmin && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl select-none">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                      <Lock size={12} className="text-slate-500 animate-pulse" />
                      Signatures Protected
                    </span>
                  </div>
                )}
                <div className={`space-y-8 ${!isAdmin ? 'blur-[2px] select-none pointer-events-none' : ''}`}>
                  <p className="border-b-2 border-slate-400 pb-1.5 h-8 font-serif italic text-xs text-slate-800">Jemal Fano Haji</p>
                  <p>IT Coordinator & Lead Author</p>
                </div>
                <div className={`space-y-8 ${!isAdmin ? 'blur-[2px] select-none pointer-events-none' : ''}`}>
                  <p className="border-b-2 border-slate-400 pb-1.5 h-8 font-sans font-bold text-xs text-slate-805">Mr. Biftu Beri Principal</p>
                  <p>School Dean Approver</p>
                </div>
                 <div className={`space-y-8 ${!isAdmin ? 'blur-[2px] select-none pointer-events-none' : ''}`}>
                  <p className="border-b-2 border-slate-400 pb-1.5 h-8 select-none font-mono text-[9px] text-slate-400">★ BIFTU BERI SEAL ★</p>
                  <p>Academic Office Stamp</p>
                </div>
              </div>

            </div>

            {/* Print-only security warning page for non-administrators trying to trigger print */}
            {!isAdmin && (
              <div className="hidden print:flex flex-col items-center justify-center min-h-[600px] text-center p-12 text-slate-950 bg-white font-sans mt-32">
                <div className="border-8 border-slate-950 p-12 rounded-[40px] max-w-xl space-y-6 mx-auto">
                  <div className="w-16 h-16 bg-slate-950 text-yellow-400 rounded-3xl flex items-center justify-center mx-auto shadow-md">
                    <Lock size={32} />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Security Restriction</h2>
                  <p className="text-sm font-extrabold uppercase tracking-wide text-slate-700 leading-relaxed">
                    CONFIDENTIAL DOCUMENT DISCLOSURE LIMIT
                  </p>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                    THIS ACADEMIC REPORT CONTAINS INTERNAL SCHEMAS AND TECHNICAL MAINTENANCE GUIDES. PRINTING OR EXPORT ACTION FOR NON-ADMINISTRATIVE ROLES IS STRICTLY FORBIDDEN BY DEPLOYED SECURITY POLICIES.
                  </p>
                  <div className="pt-6 border-t-4 border-double border-slate-950 text-[10px] font-black text-slate-450 uppercase tracking-widest">
                    Biftu Beri Secondary School • Administrative Office Seal
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
