import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Award, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  BarChart3, 
  TrendingUp, 
  Medal,
  CheckCircle2,
  Sparkles,
  Calculator,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

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

  // Lấy danh sách kỳ học duy nhất để filter
  const semesters = [...(gpaSummary || [])].filter(s => s?.semester?.id).sort((a, b) => {
    const codeA = a?.semester?.semesterCode || '';
    const codeB = b?.semester?.semesterCode || '';
    return codeB.localeCompare(codeA);
  });
  
  const currentSummary = selectedSemester === 'all' 
    ? null 
    : (gpaSummary || []).find(s => s?.semester?.id?.toString() === selectedSemester);

  const selectedSemesterObj = (gpaSummary || []).find(s => s?.semester?.id?.toString() === selectedSemester);
  const selectedSemesterName = selectedSemester === 'all'
    ? 'Toàn khóa'
    : (selectedSemesterObj?.semester?.semesterName || 'Học kỳ đã chọn');

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

  const getGradeBadgeStyle = (charMark: string, isPass?: boolean) => {
    const char = (charMark || '').toUpperCase().trim();
    if (char === 'A' || char === 'A+') {
      return 'border border-emerald-500/80 bg-emerald-50/70 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/80';
    }
    if (char === 'B' || char === 'B+') {
      return 'border border-blue-500/80 bg-blue-50/70 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-500/80';
    }
    if (char === 'C' || char === 'C+') {
      return 'border border-amber-500/80 bg-amber-50/70 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/80';
    }
    if (char === 'D' || char === 'D+') {
      return 'border border-orange-500/80 bg-orange-50/70 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-500/80';
    }
    if (char === 'F' || char.includes('KHÔNG ĐẠT') || char.includes('KHONG DAT')) {
      return 'border border-rose-500/80 bg-rose-50/70 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-500/80';
    }
    if (char === 'ĐẠT' || char === 'DAT' || char === 'M' || char === 'P' || isPass) {
      return 'border border-emerald-500/80 bg-emerald-50/70 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/80';
    }
    return 'border border-gray-300 bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600';
  };

  const isPhysicalOrDefense = (name: string, isCounted?: boolean) => {
    const n = (name || '').toLowerCase();
    return (
      isCounted === false ||
      n.includes('thể chất') ||
      n.includes('quần vợt') ||
      n.includes('bóng rổ') ||
      n.includes('bóng đá') ||
      n.includes('bóng chuyền') ||
      n.includes('cầu lông') ||
      n.includes('điền kinh') ||
      n.includes('bơi') ||
      n.includes('gdqp') ||
      n.includes('quốc phòng')
    );
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

  // Helper chuyển đổi số an toàn
  const parseNumeric = (val: any): number | null => {
    if (val === '-' || val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    return isNaN(num) ? null : num;
  };

  // Quy đổi điểm hệ 4 từ điểm hệ 4 trực tiếp, điểm chữ hoặc điểm hệ 10
  const getConvertedMark4 = (mark4Raw: any, charMarkRaw: any, summaryMarkRaw: any): number | null => {
    const direct4 = parseNumeric(mark4Raw);
    if (direct4 !== null && direct4 >= 0 && direct4 <= 4.0) return direct4;

    const char = String(charMarkRaw || '').toUpperCase().trim();
    if (char === 'A+' || char === 'A') return 4.0;
    if (char === 'B+') return 3.5;
    if (char === 'B') return 3.0;
    if (char === 'C+') return 2.5;
    if (char === 'C') return 2.0;
    if (char === 'D+') return 1.5;
    if (char === 'D') return 1.0;
    if (char === 'F' || char.includes('KHÔNG ĐẠT') || char.includes('KHONG DAT')) return 0.0;

    const num10 = parseNumeric(summaryMarkRaw);
    if (num10 !== null) {
      if (num10 >= 8.5) return 4.0;
      if (num10 >= 8.0) return 3.5;
      if (num10 >= 7.0) return 3.0;
      if (num10 >= 6.5) return 2.5;
      if (num10 >= 5.5) return 2.0;
      if (num10 >= 5.0) return 1.5;
      if (num10 >= 4.0) return 1.0;
      return 0.0;
    }

    return null;
  };

  // Quy đổi điểm hệ 10 từ tổng kết hoặc điểm chữ
  const getConvertedMark10 = (summaryMarkRaw: any, charMarkRaw: any): number | null => {
    const direct10 = parseNumeric(summaryMarkRaw);
    if (direct10 !== null && direct10 >= 0 && direct10 <= 10.0) return direct10;

    const char = String(charMarkRaw || '').toUpperCase().trim();
    if (char === 'A+' || char === 'A') return 9.0;
    if (char === 'B+') return 8.2;
    if (char === 'B') return 7.5;
    if (char === 'C+') return 6.7;
    if (char === 'C') return 6.0;
    if (char === 'D+') return 5.2;
    if (char === 'D') return 4.5;
    if (char === 'F') return 2.0;

    return null;
  };

  // Xếp loại học lực theo thang điểm 4 theo chuẩn đại học & yêu cầu người dùng
  const getRankInfo = (gpa4: number | null): { name: string; badgeClass: string } => {
    if (gpa4 === null || isNaN(gpa4)) {
      return {
        name: 'Chưa xếp loại',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
      };
    }
    if (gpa4 >= 3.5) {
      return {
        name: 'Xuất sắc',
        badgeClass: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 shadow-xs'
      };
    }
    if (gpa4 >= 3.2) {
      return {
        name: 'Giỏi',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shadow-xs'
      };
    }
    if (gpa4 >= 2.5) {
      return {
        name: 'Khá',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-xs'
      };
    }
    if (gpa4 >= 2.0) {
      return {
        name: 'Trung bình',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shadow-xs'
      };
    }
    if (gpa4 >= 1.0) {
      return {
        name: 'Yếu',
        badgeClass: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800 shadow-xs'
      };
    }
    return {
      name: 'Kém',
      badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-xs'
    };
  };

  // Tính toán thời gian thực các chỉ số GPA, tín chỉ, học phần đạt và xử lý học lại / học cải thiện
  const liveMetrics = useMemo(() => {
    const rawItems = filteredMarks.map(mark => {
      const score = getScore(mark);
      const subName = String(mark.subject?.subjectName || mark.subjectName || '').replace(/\uFFFD/g, 'ố').trim();
      const subCode = String(mark.subject?.subjectCode || mark.subjectCode || '').trim();
      const credits = Number(mark.subject?.numberOfCredit || mark.numberOfCredit || 0);
      const isUncounted = mark.isCounted === false || isPhysicalOrDefense(subName, mark.isCounted);
      
      const num10 = getConvertedMark10(score.summaryMark, score.charMark);
      const num4 = getConvertedMark4(score.mark4, score.charMark, score.summaryMark);
      
      const charUpper = String(score.charMark || '').toUpperCase().trim();
      const hasGrade = (num10 !== null) || (num4 !== null) || (charUpper !== '-' && charUpper !== '');
      
      const isExplicitFail = charUpper === 'F' || charUpper.includes('KHÔNG ĐẠT') || charUpper.includes('KHONG DAT') || (num10 !== null && num10 < 4.0) || (num4 !== null && num4 === 0 && charUpper !== 'ĐẠT' && charUpper !== 'DAT');
      const isPass = hasGrade && !isExplicitFail && (
        ['A', 'B', 'C', 'D', 'ĐẠT', 'DAT', 'M', 'P'].some(c => charUpper.includes(c)) ||
        (num10 !== null && num10 >= 4.0) ||
        (num4 !== null && num4 >= 1.0) ||
        (score.charMark !== '-' && score.charMark !== '')
      );
      const isFail = hasGrade && isExplicitFail;

      return {
        raw: mark,
        subName,
        subCode,
        credits: isNaN(credits) ? 0 : credits,
        isUncounted,
        score,
        numericMark10: num10,
        numericMark4: num4,
        hasGrade,
        isPass,
        isFail,
        studyTime: Number(mark.studyTime || 1),
        examTime: Number(mark.examTime || 1)
      };
    });

    // Gom nhóm theo mã học phần (hoặc tên chuẩn hóa nếu thiếu mã) để xử lý học cải thiện / học lại / thi lần 2
    const groups = new Map<string, typeof rawItems>();
    for (const item of rawItems) {
      const key = item.subCode.toUpperCase() || item.subName.toLowerCase().replace(/\s+/g, ' ');
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    let retakeCount = 0;
    const deduplicatedItems: typeof rawItems = [];

    for (const [, attempts] of groups.entries()) {
      if (attempts.length > 1) {
        retakeCount++;
        // Chọn lần có kết quả tốt nhất: đã có điểm > chưa điểm, đạt > trượt, điểm hệ 4 cao hơn, điểm hệ 10 cao hơn, lần học/thi mới nhất
        const best = attempts.reduce((prev, curr) => {
          if (curr.hasGrade && !prev.hasGrade) return curr;
          if (!curr.hasGrade && prev.hasGrade) return prev;
          if (curr.isPass && !prev.isPass) return curr;
          if (!curr.isPass && prev.isPass) return prev;
          
          const c4 = curr.numericMark4 ?? -1;
          const p4 = prev.numericMark4 ?? -1;
          if (c4 > p4) return curr;
          if (p4 > c4) return prev;

          const c10 = curr.numericMark10 ?? -1;
          const p10 = prev.numericMark10 ?? -1;
          if (c10 > p10) return curr;
          if (p10 > c10) return prev;

          if (curr.studyTime > prev.studyTime) return curr;
          if (curr.examTime > prev.examTime) return curr;
          return prev;
        });
        deduplicatedItems.push(best);
      } else {
        deduplicatedItems.push(attempts[0]);
      }
    }

    let passedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let accumulatedCredits = 0;
    let totalRegisteredCredits = 0;
    let uncountedPassedCredits = 0;

    let weightedMark4Sum = 0;
    let weightedMark10Sum = 0;
    let gpaWeightedCredits = 0;

    for (const item of deduplicatedItems) {
      totalRegisteredCredits += item.credits;
      if (!item.hasGrade) {
        pendingCount++;
      } else if (item.isPass) {
        passedCount++;
        accumulatedCredits += item.credits;
        if (item.isUncounted) {
          uncountedPassedCredits += item.credits;
        }
      } else if (item.isFail) {
        failedCount++;
      }

      // Chỉ tính GPA cho môn tính điểm, đã có điểm và số tín chỉ > 0
      if (!item.isUncounted && item.hasGrade && item.credits > 0) {
        if (item.numericMark4 !== null) {
          weightedMark4Sum += item.numericMark4 * item.credits;
        }
        if (item.numericMark10 !== null) {
          weightedMark10Sum += item.numericMark10 * item.credits;
        }
        if (item.numericMark4 !== null || item.numericMark10 !== null) {
          gpaWeightedCredits += item.credits;
        }
      }
    }

    const totalUnique = deduplicatedItems.length;
    const passRate = totalUnique > 0 ? Math.round((passedCount / totalUnique) * 100) : 0;
    const gpa4 = gpaWeightedCredits > 0 ? (weightedMark4Sum / gpaWeightedCredits) : null;
    const gpa10 = gpaWeightedCredits > 0 ? (weightedMark10Sum / gpaWeightedCredits) : null;
    const rank = getRankInfo(gpa4);

    return {
      passedCount,
      totalUnique,
      passRate,
      accumulatedCredits,
      totalRegisteredCredits,
      gpa4,
      gpa10,
      rank,
      retakeCount,
      uncountedPassedCredits,
      failedCount,
      pendingCount,
      gpaWeightedCredits
    };
  }, [filteredMarks]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
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
        <div className="space-y-4 sm:space-y-6">
          {/* Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base leading-tight">
                  {selectedSemesterName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedSemester === 'all' ? 'Tổng hợp tất cả các học kỳ' : 'Dữ liệu học tập theo kỳ'}
                </p>
              </div>
            </div>

            <div className="relative min-w-[160px] sm:min-w-[190px]">
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full appearance-none bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-sm py-2 pl-3 pr-9 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer transition-colors"
              >
                <option value="all">Toàn khóa</option>
                {semesters.map((sem: any, i: number) => (
                  <option key={sem?.semester?.id || i} value={sem?.semester?.id?.toString() || ""}>{sem?.semester?.semesterName}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Live GPA & Academic Performance Overview Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-gray-100 dark:border-gray-750">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                  Tổng quan kết quả học tập
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                  <Sparkles className="w-3 h-3" />
                  Tính thời gian thực
                </span>
              </div>
              {liveMetrics.pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/80 dark:border-amber-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Đang cập nhật {liveMetrics.pendingCount} môn
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Đầy đủ điểm
                </span>
              )}
            </div>

            {/* 4 Cards in Exact Requested Order: (1) Học phần đạt, (2) Tín tích lũy, (3) GPA Hệ 4 (kèm Xếp loại), (4) GPA Hệ 10 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Học phần đạt */}
              <div className="bg-gray-50/90 dark:bg-gray-750/50 rounded-2xl p-3.5 sm:p-4 border border-gray-100 dark:border-gray-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-medium">Học phần đạt</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2.5">
                  <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    {liveMetrics.passedCount}
                    <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">/{liveMetrics.totalUnique}</span>
                  </div>
                  <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {liveMetrics.passRate}% hoàn thành
                    {liveMetrics.failedCount > 0 && (
                      <span className="text-rose-500 font-semibold ml-1">• {liveMetrics.failedCount} trượt</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Tín tích lũy */}
              <div className="bg-gray-50/90 dark:bg-gray-750/50 rounded-2xl p-3.5 sm:p-4 border border-gray-100 dark:border-gray-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-medium">Tín tích lũy</span>
                  <BookOpen className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-2.5">
                  <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                    {liveMetrics.accumulatedCredits}
                  </div>
                  <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1">
                    /{liveMetrics.totalRegisteredCredits} tín đăng ký
                  </div>
                </div>
              </div>

              {/* 3. GPA Hệ 4 + Xếp loại bên dưới */}
              <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/40 dark:from-purple-950/25 dark:to-indigo-950/20 rounded-2xl p-3.5 sm:p-4 border border-purple-100 dark:border-purple-900/50 flex flex-col justify-between">
                <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
                  <span className="text-xs font-semibold">GPA Hệ 4</span>
                  <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="mt-2">
                  <div className="text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300 tracking-tight leading-none">
                    {liveMetrics.gpa4 !== null ? liveMetrics.gpa4.toFixed(2) : '--'}
                  </div>
                  {/* Hạng / Xếp loại bên dưới */}
                  <div className="mt-2">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border",
                      liveMetrics.rank.badgeClass
                    )}>
                      <Medal className="w-3.5 h-3.5 shrink-0" />
                      {liveMetrics.rank.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. GPA Hệ 10 */}
              <div className="bg-gray-50/90 dark:bg-gray-750/50 rounded-2xl p-3.5 sm:p-4 border border-gray-100 dark:border-gray-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                  <span className="text-xs font-medium">GPA Hệ 10</span>
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-2.5">
                  <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    {liveMetrics.gpa10 !== null ? liveMetrics.gpa10.toFixed(2) : '--'}
                  </div>
                  <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1">
                    Thang điểm 10
                  </div>
                </div>
              </div>
            </div>

            {/* Smart notes footer */}
            <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-750/80 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex flex-wrap items-center gap-2">
                {liveMetrics.retakeCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                    <Info className="w-3 h-3" />
                    Đã lấy điểm cao nhất của {liveMetrics.retakeCount} môn học lại / cải thiện
                  </span>
                )}
                {liveMetrics.uncountedPassedCredits > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                    Gồm {liveMetrics.uncountedPassedCredits} tín GDTC/GDQP
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto">
                Tự động tính theo môn hiện có
              </span>
            </div>
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
                  const subName = mark.subject?.subjectName || mark.subjectName || 'Môn học';
                  const subCode = mark.subject?.subjectCode || mark.subjectCode || '';
                  const credits = mark.subject?.numberOfCredit || mark.numberOfCredit || 0;
                  const isUncounted = mark.isCounted === false || isPhysicalOrDefense(subName, mark.isCounted);
                  
                  // Determine pass/fail
                  const numSummary = parseFloat(String(score.summaryMark));
                  const charUpper = String(score.charMark).toUpperCase();
                  const isFail = charUpper === 'F' || charUpper.includes('KHÔNG ĐẠT') || (!isNaN(numSummary) && numSummary < 4.0);
                  const isPass = !isFail && (['A', 'B', 'C', 'D', 'ĐẠT', 'DAT', 'M', 'P'].some(c => charUpper.includes(c)) || (!isNaN(numSummary) && numSummary >= 4.0) || score.charMark !== '-');

                  let badgeLabel = score.charMark;
                  if (badgeLabel === '-' || !badgeLabel) {
                    badgeLabel = isUncounted ? (isPass ? 'Đạt' : 'Chưa đạt') : (isPass ? 'Đạt' : 'F');
                  }

                  return (
                  <motion.div
                    key={mark?.id || i}
                    layout
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all hover:border-gray-200 dark:hover:border-gray-600"
                  >
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-750 transition-colors"
                      onClick={() => setExpandedSubject(expandedSubject === (mark?.id || i) ? null : (mark?.id || i))}
                    >
                      <div className="flex-1 pr-3">
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug">
                          {subName}
                        </h4>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                          {subCode ? `${subCode} • ` : ''}{credits} tín chỉ
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 italic">
                          Lần học: {mark.studyTime || 1} • Lần thi: {mark.examTime || 1} • {isUncounted ? 'Không tính điểm' : 'Tính điểm'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={cn(
                          "px-3 py-1 rounded-xl border text-center font-bold text-sm min-w-[42px] shadow-xs",
                          getGradeBadgeStyle(badgeLabel, isPass)
                        )}>
                          {badgeLabel}
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
                          className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50"
                        >
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">QT (Quá trình)</span>
                              <span className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{score.processMark}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Thi kết thúc</span>
                              <span className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{score.examMark}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tổng kết (Hệ 10)</span>
                              <span className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">{score.summaryMark}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Đánh giá</span>
                              <span className={cn(
                                "text-base font-bold mt-0.5",
                                isPass ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              )}>
                                {isPass ? "Đạt" : "Không đạt"}
                              </span>
                            </div>
                          </div>
                          {!isUncounted && score.mark4 !== '-' && (
                            <div className="px-4 pb-3 pt-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800/60 flex justify-between items-center">
                              <span>Quy đổi thang điểm 4:</span>
                              <span className="font-bold text-gray-800 dark:text-gray-200">{score.mark4}</span>
                            </div>
                          )}
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
