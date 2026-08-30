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
  const [activeTab, setActiveTab] = useState<'details' | 'gpa'>('details');

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

  // Lấy danh sách kỳ học duy nhất để filter
  const semesters = [...(gpaSummary || [])].filter(s => s?.semester?.id).sort((a, b) => {
    const codeA = a?.semester?.semesterCode || '';
    const codeB = b?.semester?.semesterCode || '';
    return codeB.localeCompare(codeA);
  });
  
  const currentSummary = selectedSemester === 'all' 
    ? null 
    : (gpaSummary || []).find(s => s?.semester?.id?.toString() === selectedSemester);

  const allMarks = [...(detailedMarks || [])];

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
    if (char === 'ĐẠT' || char === 'DAT' || char === 'M' || char === 'P') return 'text-green-600 dark:text-green-400';
    if (char === 'KHÔNG ĐẠT' || char === 'KHONG DAT') return 'text-red-600 dark:text-red-400';
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

      const nameObj = o.markDetail || o.markComponent || o.component || o.type || o.markType || o.examType || o.subjectExam || o;
      const nameStr = String(nameObj?.name || nameObj?.description || o?.name || '').toLowerCase();
      const codeStr = String(nameObj?.code || nameObj?.id || o?.code || '').toUpperCase();
      
      const val = o.mark !== undefined ? o.mark : (o.value !== undefined ? o.value : (o.score !== undefined ? o.score : (o.diem !== undefined ? o.diem : undefined)));

      if (val !== undefined && val !== null) {
        if (nameStr.includes('quá trình') || nameStr.includes('qua trinh') || codeStr.includes('QT') || codeStr === 'QUATRINH' || nameStr.includes('chuyên cần') || nameStr.includes('thường xuyên') || nameStr.includes('giữa kỳ') || nameStr.includes('điểm thành phần') || nameStr === 'đánh giá quá trình') processMark = val;
        if (nameStr.includes('thi') || codeStr.includes('THI') || nameStr.includes('kết thúc học phần') || nameStr.includes('cuối kỳ') || nameStr.includes('đánh giá cuối kỳ')) examMark = val;
        if (nameStr.includes('tổng kết') || nameStr.includes('tkhp') || codeStr.includes('TKHP')) summaryMark = val;
      }

      Object.keys(o).forEach(k => {
        const kl = k.toLowerCase();
        const v = o[k];
        if (v === null || v === undefined) return;

        if (typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))) {
          if (['processmark', 'markqt', 'diemquatrinh', 'diemqt', 'diem_qt', 'qt', 'quatrinh'].includes(kl) || kl.includes('quatrinh')) processMark = v;
          if (['exammark', 'markthi', 'diemthi', 'thi', 'diem_thi'].includes(kl) || (kl.includes('thi') && !kl.includes('thiet'))) examMark = v;
          if (['summarymark', 'marktk', 'mark10', 'tkhp', 'tongket', 'diemtk', 'diemtongket', 'diem10', 'diem_tk', 'totalmark'].includes(kl)) summaryMark = v;
          if (['mark4', 'summarymark4', 'diem4', 'diemhe4', 'gpa4'].includes(kl)) mark4 = v;
          
          if (kl === 'mark1' && processMark === '-') processMark = v;
          if (kl === 'mark2' && examMark === '-') examMark = v;
        }

        if (typeof v === 'string' && v.trim().length > 0) {
          const char = v.trim().toUpperCase();
          if (['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ĐẠT', 'DAT', 'M', 'P', 'KHÔNG ĐẠT', 'KHONG DAT'].includes(char)) {
             if (kl.includes('char') || kl.includes('chu') || kl.includes('diemchu') || kl.includes('mark') || kl === 'rank' || kl === 'grade' || kl === 'status' || kl === 'danhgia') charMark = char;
          }
        }
        if (typeof v === 'object') traverse(v);
      });
    };

    traverse(markObj);
    
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
      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl max-w-sm">
        <button 
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === 'details' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Điểm chi tiết
        </button>
        <button 
          onClick={() => setActiveTab('gpa')}
          className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${activeTab === 'gpa' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          GPA Tổng hợp
        </button>
      </div>

      {activeTab === 'gpa' ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Điểm trung bình học tập năm học, học kỳ, toàn khóa
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th rowSpan={2} className="p-3 border-r border-gray-200 dark:border-gray-700">Năm học</th>
                  <th rowSpan={2} className="p-3 border-r border-gray-200 dark:border-gray-700">Học kỳ</th>
                  <th colSpan={2} className="p-2 border-r border-b border-gray-200 dark:border-gray-700">TBTL Hệ 10</th>
                  <th colSpan={2} className="p-2 border-r border-b border-gray-200 dark:border-gray-700">TBTL Hệ 4</th>
                  <th colSpan={2} className="p-2 border-r border-b border-gray-200 dark:border-gray-700">Số TCTL</th>
                  <th colSpan={2} className="p-2 border-r border-b border-gray-200 dark:border-gray-700">TBC Hệ 10</th>
                  <th colSpan={2} className="p-2 border-r border-b border-gray-200 dark:border-gray-700">TBC Hệ 4</th>
                  <th colSpan={2} className="p-2 border-b border-gray-200 dark:border-gray-700">Số TC</th>
                </tr>
                <tr className="text-xs">
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N1</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N2</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N1</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N2</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N1</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N2</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N1</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N2</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N1</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N2</th>
                  <th className="p-2 border-r border-gray-200 dark:border-gray-700">N1</th>
                  <th className="p-2">N2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {gpaSummary.map((sem, i) => {
                  const m = sem.summaryMark || {};
                  // Try to extract school year if not present
                  let schoolYear = sem.semester?.schoolYear || '//';
                  if (typeof schoolYear === 'object') {
                      schoolYear = schoolYear.name || schoolYear.code || '//';
                  }
                  let semName = sem.semester?.semesterName || 'Toàn khóa';
                  
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100">{schoolYear}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{semName}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800">{m.mark10Accumulate ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 text-gray-400">{m.mark10AccumulateN2 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800">{m.mark4Accumulate ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 text-gray-400">{m.mark4AccumulateN2 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800">{m.numberOfCreditAccumulate ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 text-gray-400">{m.numberOfCreditAccumulateN2 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800">{m.mark10 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 text-gray-400">{m.mark10N2 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800">{m.mark4 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800 text-gray-400">{m.mark4N2 ?? ''}</td>
                      <td className="p-3 border-r border-gray-100 dark:border-gray-800">{m.numberOfCredit ?? ''}</td>
                      <td className="p-3 text-gray-400">{m.numberOfCreditN2 ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
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
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">
                          {mark.subject?.subjectName || mark.subjectName}
                          {mark.isCounted === false && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              Không tính GPA
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                          {mark.subject?.subjectCode || mark.subjectCode || ''} • {mark.subject?.numberOfCredit || mark.numberOfCredit || 0} tín chỉ
                          {mark.studyTime ? ` • Lần học: ${mark.studyTime}` : ''}
                        </p>
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
      )}
    </div>
  );
}
