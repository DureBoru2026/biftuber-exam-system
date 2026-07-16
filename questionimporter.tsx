import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileUp, Sparkles, Loader2, FileText, CheckCircle2, Download } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import * as XLSX from 'xlsx';
// @ts-ignore - Vite asset import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { extractQuestionsFromText, ExtractedQuestion } from '@/src/services/aiService';

// PDF.js worker setup using Vite asset URL
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface QuestionImporterProps {
  onImport: (questions: ExtractedQuestion[]) => void;
  onClose: () => void;
}

export default function QuestionImporter({ onImport, onClose }: QuestionImporterProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [previewQuestions, setPreviewQuestions] = useState<ExtractedQuestion[]>([]);

  const downloadEmptyTemplate = () => {
    const headers = [
      'Question Text', 
      'Option A', 
      'Option B', 
      'Option C', 
      'Option D', 
      'Correct Option (A, B, C, or D)', 
      'Points', 
      'Topic', 
      'Explanation'
    ];
    const sampleRow = [
      'What is the powerhouse of the cell?',
      'Nucleus',
      'Mitochondria',
      'Ribosome',
      'Golgi Apparatus',
      'B',
      '1',
      'Biology - Cell Organelles',
      'Mitochondria converts oxygen and nutrients into adenosine triphosphate (ATP).'
    ];
    const emptyRow1 = ['', '', '', '', '', '', '', '', ''];
    const emptyRow2 = ['', '', '', '', '', '', '', '', ''];
    
    const wsData = [headers, sampleRow, emptyRow1, emptyRow2];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!cols'] = [
      { wch: 45 }, // Question Text
      { wch: 15 }, // Option A
      { wch: 15 }, // Option B
      { wch: 15 }, // Option C
      { wch: 15 }, // Option D
      { wch: 28 }, // Correct Option
      { wch: 8 },  // Points
      { wch: 22 }, // Topic
      { wch: 32 }  // Explanation
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Questions Template');
    XLSX.writeFile(wb, 'Biftu_Beri_Exam_Questions_Template.xlsx');
  };

  const handleExcelImport = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (!jsonData || jsonData.length <= 1) {
        throw new Error("Excel template is empty or has no header row.");
      }
      
      const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
      
      const txtIdx = headers.findIndex(h => h.includes('question') || h.includes('text'));
      const aIdx = headers.findIndex(h => h.includes('option a') || (h === 'a' && !h.includes('explanation')));
      const bIdx = headers.findIndex(h => h.includes('option b') || h === 'b');
      const cIdx = headers.findIndex(h => h.includes('option c') || h === 'c');
      const dIdx = headers.findIndex(h => h.includes('option d') || h === 'd');
      const correctIdx = headers.findIndex(h => h.includes('correct') || h.includes('answer') || h.includes('key'));
      const ptsIdx = headers.findIndex(h => h.includes('points') || h.includes('weight'));
      const topicIdx = headers.findIndex(h => h.includes('topic') || h.includes('category'));
      const expIdx = headers.findIndex(h => h.includes('explanation') || h.includes('rationale'));

      const questionsParsed: ExtractedQuestion[] = [];
      
      for (let r = 1; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row || row.length === 0) continue;
        
        const textVal = txtIdx !== -1 ? String(row[txtIdx] || '').trim() : '';
        if (!textVal) continue;
        
        const optA = aIdx !== -1 ? String(row[aIdx] || '').trim() : '';
        const optB = bIdx !== -1 ? String(row[bIdx] || '').trim() : '';
        const optC = cIdx !== -1 ? String(row[cIdx] || '').trim() : '';
        const optD = dIdx !== -1 ? String(row[dIdx] || '').trim() : '';
        
        const options = [optA, optB, optC, optD].filter(Boolean);
        if (options.length < 2) continue;
        
        let corrVal = correctIdx !== -1 ? String(row[correctIdx] || '').trim().toUpperCase() : 'A';
        let correctOptionIndex = 0;
        if (corrVal === 'A' || corrVal === '0' || corrVal === '1' || corrVal.includes('OPTION A') || corrVal.includes('A')) {
          correctOptionIndex = 0;
        } else if (corrVal === 'B' || corrVal === '1' || corrVal === '2' || corrVal.includes('OPTION B') || corrVal.includes('B')) {
          correctOptionIndex = 1;
        } else if (corrVal === 'C' || corrVal === '2' || corrVal === '3' || corrVal.includes('OPTION C') || corrVal.includes('C')) {
          correctOptionIndex = 2;
        } else if (corrVal === 'D' || corrVal === '3' || corrVal === '4' || corrVal.includes('OPTION D') || corrVal.includes('D')) {
          correctOptionIndex = 3;
        } else {
          const parsedNum = parseInt(corrVal);
          if (!isNaN(parsedNum)) {
            if (parsedNum >= 1 && parsedNum <= 4) correctOptionIndex = parsedNum - 1;
            else if (parsedNum >= 0 && parsedNum <= 3) correctOptionIndex = parsedNum;
          }
        }
        
        const points = ptsIdx !== -1 ? Number(row[ptsIdx]) || 1 : 1;
        const topic = topicIdx !== -1 ? String(row[topicIdx] || '').trim() : '';
        const explanation = expIdx !== -1 ? String(row[expIdx] || '').trim() : '';
        
        questionsParsed.push({
          text: textVal,
          options,
          correctOptionIndex,
          points,
          topic,
          explanation
        });
      }
      
      if (questionsParsed.length === 0) {
        throw new Error("Could not find any valid questions in the spreadsheet. Verify column header names match Option A, Option B, Correct Option.");
      }
      
      setPreviewQuestions(questionsParsed);
    } catch (err: any) {
      console.error("Spreadsheet extraction error:", err);
      throw new Error(err.message || "Failed to parse spreadsheet file.");
    }
  };

  const handleTextExtraction = async (file: File) => {
    setLoading(true);
    setError(null);
    setPreviewQuestions([]);
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv');
      
      if (isExcel) {
        await handleExcelImport(file);
        return;
      }

      let text = '';
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isDocx) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } catch (docxErr: any) {
          console.warn("Mammoth text extraction failed, attempting low-level binary safe-text recovery...", docxErr);
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binaryText = '';
          for (let i = 0; i < uint8.length; i++) {
            const char = uint8[i];
            if ((char >= 32 && char <= 126) || char === 10 || char === 13) {
              binaryText += String.fromCharCode(char);
            }
          }
          binaryText = binaryText.replace(/\s+/g, ' ');
          if (binaryText.length > 100) {
            text = binaryText;
          } else {
            throw new Error(`Word Document Parsing Exception: ${docxErr?.message || docxErr}`);
          }
        }
      } else if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          
          // PDF.js Worker paths prioritizing local, then CDNs to conquer iframe WebWorker security blocks
          const workerUrls = [
            pdfWorker,
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.7.284/pdf.worker.min.mjs`,
            `https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs`
          ];
          
          let pdfLoaded = false;
          let pdfError = null;
          
          for (const wUrl of workerUrls) {
            try {
              pdfjs.GlobalWorkerOptions.workerSrc = wUrl;
              const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
              const pdf = await loadingTask.promise;
              let fullText = '';
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map((item: any) => (item as any).str || '').join(' ') + '\n';
              }
              text = fullText;
              pdfLoaded = true;
              break; // success
            } catch (err) {
              console.warn(`PDF worker ${wUrl} failed, trying alternative...`, err);
              pdfError = err;
            }
          }
          
          if (!pdfLoaded) {
            // Ultimate fallback: direct ASCII stream recovery
            console.warn("Could not load PDF.js WebWorker. Triggering direct ASCII/NLP text scanner fallback.");
            const uint8 = new Uint8Array(arrayBuffer);
            let binaryText = '';
            for (let i = 0; i < uint8.length; i++) {
              const char = uint8[i];
              if ((char >= 32 && char <= 126) || char === 10 || char === 13) {
                binaryText += String.fromCharCode(char);
              } else if (char === 0) {
                binaryText += ' ';
              }
            }
            binaryText = binaryText.replace(/\s+/g, ' ');
            if (binaryText.length > 200) {
              text = binaryText;
            } else {
              throw pdfError || new Error("Failed to parse PDF document pages.");
            }
          }
        } catch (pdfErr: any) {
          throw new Error(`PDF Parsing failed: ${pdfErr?.message || pdfErr}. Please verify document file integrity.`);
        }
      } else {
        text = await file.text();
      }

      if (!text.trim()) {
        throw new Error("The document appears to be empty or unreadable.");
      }

      const questions = await extractQuestionsFromText(text);
      if (questions.length === 0) {
        throw new Error("No questions were identified. Please ensure the document contains multiple choice questions with clear options.");
      }
      
      setPreviewQuestions(questions);
    } catch (err: any) {
      console.error("Extraction error:", err);
      setError(err.message || "Failed to process file. Try copying the text manually.");
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    onImport(previewQuestions);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleTextExtraction(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleTextExtraction(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">AI Question Importer</h2>
              <p className="text-sm text-slate-500">Upload Word, PDF, or Text documents</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <Loader2 size={64} className="text-blue-600 animate-spin" />
                <Sparkles size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Analyzing Document Patterns...</h3>
                <p className="text-slate-500 max-w-xs mx-auto text-sm">Identifying questions, options, and correct answers. This can take up to 30 seconds for large files.</p>
              </div>
            </div>
          ) : previewQuestions.length > 0 ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-100 p-6 rounded-3xl flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-100">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-green-900">Success! {previewQuestions.length} Questions Found</h3>
                  <p className="text-xs text-green-700 font-medium">Verify the content below before adding to your exam.</p>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4">
                {previewQuestions.map((q, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Question {i + 1}</p>
                    <p className="font-bold text-slate-900 text-sm line-clamp-2">{q.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setPreviewQuestions([])}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={confirmImport}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                >
                  Add to Exam
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div 
                className={`relative border-2 border-dashed rounded-[24px] p-12 transition-all flex flex-col items-center justify-center gap-4 ${
                  dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  accept=".docx,.pdf,.txt,.xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                  <FileUp size={32} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">Click or drag file here</p>
                  <p className="text-sm text-slate-500">Word, PDF, Excel (XLSX/CSV), or Plain Text (Max 5MB)</p>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-3">
                  <X size={18} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={downloadEmptyTemplate}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15"
                >
                  <Download size={16} />
                  Download Empty Template Format (.xlsx)
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="text-emerald-600" size={20} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Excel / CSV Ready</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="text-blue-600" size={20} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supports .DOCX</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="text-rose-500" size={20} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supports .PDF</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
