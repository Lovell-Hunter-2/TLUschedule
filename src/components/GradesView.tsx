import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Award, BookOpen, ChevronDown, ChevronUp, AlertCircle, BarChart3, TrendingUp, Medal } from 'lucide-react';

interface GradesViewProps {
  userId: string;
  workspaceId: string;
  subjects?: any[];
}

export function GradesView({ userId, workspaceId, subjects = [] }: GradesViewProps) {
  const [loading, setLoading] = useState(true);
  const [gpaSummary, setGpaSummary] = useState<any[]>([]);
  const [detailedMarks, setDetailedMarks] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'users', userId, 'workspaces', workspaceId, 'grades', 'data');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGpaSummary(data.summary || []);
        setDetailedMarks(data.detailed || []);
      } else {
        setGpaSummary([]);
        setDetailedMarks([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, workspaceId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Get unique semesters from GPA summary
  const semesters = [...(gpaSummary || [])].filter(Boolean).sort((a, b) => {
    const codeA = a?.semester?.semesterCode || '';
    const codeB = b?.semester?.semesterCode || '';
    return codeB.localeCompare(codeA);
  });
  
  const currentSummary = selectedSemester === 'all' 
    ? null 
    : (gpaSummary || []).find(s => s?.semester?.id?.toString() === selectedSemester);

  // Merge missing subjects from schedules (subjects prop)
  const allMarks = [...(detailedMarks || [])];
  
  if (subjects && subjects.length > 0) {
    const existingNames = new Set(allMarks.map(m => String(m?.subject?.subjectName || m?.subjectName || '').toLowerCase().trim()).filter(Boolean));
    
    const uniqueSubjects = new Map();
    subjects.forEach(s => {
      const rawName = String(s.name || s.subjectName || '');
      // Exclude exam items
      if (rawName.toUpperCase().includes('(THI)') || s.id?.includes('exam_') || s.color === 'border-l-red-500') {
         return;
      }
      let name = rawName.replace(/\uFFFD/g, 'ố').toLowerCase().trim();
      if (name && !existingNames.has(name) && !uniqueSubjects.has(name)) {
         uniqueSubjects.set(name, s);
      }
    });
    
    uniqueSubjects.forEach((s) => {
       allMarks.push({
          id: 'synth_' + Math.random(),
          subject: { 
             subjectName: (s.name || s.subjectName || '').replace(/\uFFFD/g, 'ố'), 
             subjectCode: s.subjectCode || '' 
          },
          semester: { id: s.semesterId, semesterName: s.semesterName },
          isSynthesized: true,
          mark: '-',
          mark4: '-',
          charMark: '-'
       });
    });
  }

  const filteredMarks = selectedSemester === 'all'
    ? allMarks.filter(Boolean)
    : allMarks.filter(Boolean).filter(m => String(m?.semester?.id || '') === String(selectedSemester));
    
  // Sort alphabetically by subject name
  filteredMarks.sort((a, b) => {
     const nameA = String(a?.subject?.subjectName || a?.subjectName || '').replace(/\uFFFD/g, 'ố').trim();
     const nameB = String(b?.subject?.subjectName || b?.subjectName || '').replace(/\uFFFD/g, 'ố').trim();
     return nameA.localeCompare(nameB, 'vi');
  });

  const getGradeColor = (charMark: string) => {
    if (!charMark) return 'text-gray-500';
    const char = charMark.toUpperCase();
    if (char.includes('A')) return 'text-green-600 dark:text-green-400';
    if (char.includes('B')) return 'text-blue-600 dark:text-blue-400';
    if (char.includes('C')) return 'text-yellow-600 dark:text-yellow-400';
    if (char.includes('D')) return 'text-orange-600 dark:text-orange-400';
    if (char.includes('F')) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getScore = (markObj: any) => {
    let processMark: any = '-';
    let examMark: any = '-';
    let summaryMark: any = '-';
    let charMark: any = '-';
    let mark4: any = '-';

    const traverse = (o: any) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) {
        o.forEach(traverse);
        return;
      }

      // 1. Dò theo cấu trúc object (component mark)
      const nameObj = o.markDetail || o.markComponent || o.component || o.type || o.markType || o.examType || o;
      const nameStr = String(nameObj?.name || nameObj?.description || o?.name || '').toLowerCase();
      const codeStr = String(nameObj?.code || nameObj?.id || o?.code || '').toUpperCase();
      
      const val = o.mark !== undefined ? o.mark : (o.value !== undefined ? o.value : (o.score !== undefined ? o.score : (o.diem !== undefined ? o.diem : undefined)));

      if (val !== undefined && val !== null) {
        if (nameStr.includes('quá trình') || nameStr.includes('qua trinh') || codeStr.includes('QT') || codeStr === 'QUATRINH' || nameStr.includes('chuyên cần') || nameStr.includes('thường xuyên')) processMark = val;
        if (nameStr.includes('thi') || codeStr.includes('THI') || nameStr === 'kết thúc học phần') examMark = val;
        if (nameStr.includes('tổng kết') || nameStr.includes('tkhp') || codeStr.includes('TKHP')) summaryMark = val;
      }

      // 2. Dò theo key trực tiếp (flat properties)
      Object.keys(o).forEach(k => {
        const kl = k.toLowerCase();
        const v = o[k];
        if (v === null || v === undefined) return;

        // Bắt các con số
        if (typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))) {
          if (['processmark', 'markqt', 'diemquatrinh', 'diemqt', 'diem_qt', 'qt', 'quatrinh'].includes(kl) || kl.includes('quatrinh')) processMark = v;
          if (['exammark', 'markthi', 'diemthi', 'thi', 'diem_thi'].includes(kl) || (kl.includes('thi') && !kl.includes('thiet'))) examMark = v;
          if (['summarymark', 'marktk', 'mark10', 'tkhp', 'tongket', 'diemtk', 'diemtongket', 'diem10', 'diem_tk', 'totalmark'].includes(kl)) summaryMark = v;
          if (['mark4', 'summarymark4', 'diem4', 'diemhe4', 'gpa4'].includes(kl)) mark4 = v;
          
          // Bắt trường hợp Edusoft trả về mảng điểm trong các key index (vd: mark1, mark2...)
          // Đôi khi QT là mark1, Thi là mark2
          if (kl === 'mark1' && processMark === '-') processMark = v;
          if (kl === 'mark2' && examMark === '-') examMark = v;
        }

        // Bắt điểm chữ
        if (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 2) {
          const char = v.trim().toUpperCase();
          if (['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'].includes(char)) {
             if (kl.includes('char') || kl.includes('chu') || kl.includes('diemchu') || kl.includes('mark') || kl === 'rank' || kl === 'grade') charMark = char;
          }
        }

        // Đệ quy
        if (typeof v === 'object') traverse(v);
      });
    };

    traverse(markObj);
    
    // Final fallbacks from root if still missing
    if (summaryMark === '-' && markObj.mark !== undefined && typeof markObj.mark === 'number') summaryMark = markObj.mark;

    const safeDisplay = (val: any) => (val !== undefined && val !== null && val !== '') ? val : '-';

    return {
      processMark: safeDisplay(processMark),
      examMark: safeDisplay(examMark),
      summaryMark: safeDisplay(summaryMark),
      charMark: safeDisplay(charMark),
      mark4: safeDisplay(mark4)
    };
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex justify-end">
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2.5 pl-4 pr-10 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        >
          <option value="all">Toàn khóa</option>
          {semesters.map((sem: any, i: number) => (
            <option key={sem?.semester?.id || i} value={sem?.semester?.id?.toString() || ""}>{sem?.semester?.semesterName}</option>
          ))}
        </select>
      </div>

      {/* Summary Card */}
      {currentSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-500/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-8 h-8 text-yellow-300" />
            <h3 className="text-xl font-bold">Tổng kết học kỳ</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-sm font-medium mb-1">TBC Hệ 10</p>
              <p className="text-3xl font-bold">{currentSummary.summaryMark?.mark10 || '-'}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-sm font-medium mb-1">TBC Hệ 4</p>
              <p className="text-3xl font-bold">{currentSummary.summaryMark?.mark4 || '-'}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-sm font-medium mb-1">Số TC kỳ này</p>
              <p className="text-3xl font-bold">{currentSummary.summaryMark?.numberOfCredit || '-'}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-sm font-medium mb-1">Số TC tích lũy</p>
              <p className="text-3xl font-bold">{currentSummary.summaryMark?.numberOfCreditAccumulate || '-'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Marks List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          Bảng điểm chi tiết
        </h3>
        
        {filteredMarks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">Không có điểm trong học kỳ này.</p>
        ) : (
          <div className="grid gap-3">
            {filteredMarks.map((mark: any, i: number) => {
              const score = getScore(mark);
              return (
              <motion.div
                key={mark?.id || i}
                layout
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  onClick={() => setExpandedSubject(expandedSubject === (mark?.id || i) ? null : (mark?.id || i))}
                >
                  <div className="flex-1 pr-4">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{mark.subject?.subjectName}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{mark.subject?.subjectCode} • {mark.subject?.numberOfCredit} tín chỉ</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`text-xl font-black ${getGradeColor(String(score.charMark))}`}>
                        {score.charMark}
                      </span>
                    </div>
                    {expandedSubject === (mark?.id || i) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedSubject === (mark?.id || i) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                    >
                      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Điểm quá trình</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.processMark}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Điểm thi</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.examMark}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Tổng kết (Hệ 10)</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.summaryMark}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Tổng kết (Hệ 4)</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.mark4}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
