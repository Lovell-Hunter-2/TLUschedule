import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Award, BookOpen, ChevronDown, ChevronUp, AlertCircle, BarChart3, TrendingUp, Medal } from 'lucide-react';

interface GradesViewProps {
  userId: string;
  workspaceId: string;
}

export function GradesView({ userId, workspaceId }: GradesViewProps) {
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
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Đang tải điểm số...</p>
      </div>
    );
  }

  if (gpaSummary.length === 0 && detailedMarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Chưa có dữ liệu điểm</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Vui lòng bấm Đồng bộ ở màn hình chọn Tài khoản để hệ thống lấy bảng điểm từ TLU.
        </p>
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

  const filteredMarks = selectedSemester === 'all'
    ? (detailedMarks || []).filter(Boolean)
    : (detailedMarks || []).filter(Boolean).filter(m => m?.semester?.id?.toString() === selectedSemester);
  
  const getScore = (markObj: any) => {
    let processMark = markObj.processMark ?? markObj.mark?.processMark ?? '-';
    let examMark = markObj.examMark ?? markObj.mark?.examMark ?? '-';
    let summaryMark = markObj.summaryMark ?? markObj.summaryMark10 ?? markObj.mark?.summaryMark ?? '-';
    let charMark = markObj.charMark ?? markObj.charMark1 ?? markObj.mark?.charMark ?? '-';
    let mark4 = markObj.mark4 ?? markObj.summaryMark4 ?? markObj.mark?.mark4 ?? '-';

    if (Array.isArray(markObj.details)) {
       const processDetail = markObj.details.find((d:any) => d.markDetail?.name?.toLowerCase().includes('quá trình') || d.markDetail?.code?.includes('QT'));
       if (processDetail && processDetail.mark !== undefined && processMark === '-') processMark = processDetail.mark;

       const examDetail = markObj.details.find((d:any) => d.markDetail?.name?.toLowerCase().includes('thi') || d.markDetail?.code?.includes('THI'));
       if (examDetail && examDetail.mark !== undefined && examMark === '-') examMark = examDetail.mark;
    }
    
    return { processMark, examMark, summaryMark, charMark, mark4 };
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
                      <span className={`text-lg font-bold ${
                        ['A', 'B+', 'B'].includes(score.charMark) ? 'text-green-500' :
                        ['C+', 'C', 'D+', 'D'].includes(score.charMark) ? 'text-orange-500' :
                        'text-red-500'
                      }`}>
                        {score.charMark || '-'}
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
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.processMark || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Điểm thi</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.examMark || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Tổng kết (Hệ 10)</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.summaryMark || '-'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Tổng kết (Hệ 4)</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{score.mark4 || '-'}</span>
                        </div>
                      </div>
                      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                        <details>
                          <summary className="text-xs text-gray-400 cursor-pointer">Debug Data (Nhấn để xem)</summary>
                          <pre className="text-[10px] text-gray-500 mt-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(mark, null, 2)}</pre>
                        </details>
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
