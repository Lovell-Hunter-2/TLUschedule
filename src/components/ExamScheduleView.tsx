import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Briefcase, 
  Layers, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

interface ExamScheduleViewProps {
  userId: string;
  workspaceId: string;
  subjects?: any[];
  isSyncing?: boolean;
  onForceSync?: () => void;
}

export function ExamScheduleView({ 
  userId, 
  workspaceId, 
  subjects = [], 
  isSyncing = false, 
  onForceSync 
}: ExamScheduleViewProps) {
  const [loading, setLoading] = useState(true);
  const [examList, setExamList] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');

  useEffect(() => {
    const docRef = doc(db, 'users', userId, 'workspaces', workspaceId, 'exams', 'data');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setExamList(data.list || []);
      } else {
        // Fallback: Extract exams from subjects if exams subcollection is not created yet
        const fromSubjects = subjects
          .filter((s: any) => s.name?.includes('(THI)') || s.lecturer?.includes('Lịch Thi') || s.color?.includes('red-500'))
          .map((s: any, idx: number) => {
            const cleanName = s.name.replace(/\s*\(THI\)\s*/i, '').trim();
            // Parse room and SBD from s.room (e.g. "302-C5 (SBD: 409)")
            const sbdMatch = (s.room || '').match(/SBD:\s*([^\)]+)/i);
            const roomMatch = (s.room || '').replace(/\s*\(SBD:[^\)]+\)/i, '').trim();
            
            return {
              id: s.id || `exam_${idx}`,
              subjectName: cleanName,
              subjectCode: s.code || '',
              examCode: sbdMatch ? sbdMatch[1].trim() : '',
              examDate: s.startDate,
              examTime: s.periods ? `Tiết ${s.periods.join(', ')}` : '',
              examShift: s.lecturer?.replace(/\s*•\s*Lịch Thi/i, '').trim() || '',
              roomName: roomMatch || s.room || '',
              semesterId: s.semesterId,
              semesterName: s.semesterName || 'Kỳ hiện tại',
              round: 1
            };
          });
        setExamList(fromSubjects);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, workspaceId, subjects]);

  // Danh sách các học kỳ có lịch thi
  const semesters = useMemo(() => {
    const map = new Map<string, string>();
    examList.forEach(e => {
      if (e.semesterName) {
        map.set(String(e.semesterName), String(e.semesterName));
      } else if (e.semesterId) {
        map.set(String(e.semesterId), `Học kỳ ${e.semesterId}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [examList]);

  // Lọc lịch thi
  const filteredExams = useMemo(() => {
    let list = [...examList];
    if (selectedSemester !== 'all') {
      list = list.filter(e => 
        String(e.semesterName) === selectedSemester || 
        String(e.semesterId) === selectedSemester
      );
    }
    if (selectedRound !== 'all') {
      list = list.filter(e => String(e.round) === selectedRound);
    }

    // Sắp xếp theo ngày thi tăng dần
    return list.sort((a, b) => {
      const dateA = a.examDate ? new Date(a.examDate).getTime() : 0;
      const dateB = b.examDate ? new Date(b.examDate).getTime() : 0;
      return dateA - dateB;
    });
  }, [examList, selectedSemester, selectedRound]);

  const getDaysDiff = (dateStr: string) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Chưa có ngày thi';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[d.getDay()];
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year} (${dayName})`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Đang tải lịch thi...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Lịch thi</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {filteredExams.length > 0 
                  ? `Có ${filteredExams.length} môn thi được đồng bộ từ cổng TLU` 
                  : 'Chưa có thông tin lịch thi'}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {semesters.length > 0 && (
            <div className="relative">
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Tất cả học kỳ</option>
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          <div className="relative">
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">Tất cả lần thi</option>
              <option value="1">Lần 1</option>
              <option value="2">Lần 2</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {onForceSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={onForceSync}
              disabled={isSyncing}
              className="rounded-xl text-xs flex items-center gap-1.5 h-9 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ lại'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredExams.length === 0 ? (
        <Card className="p-10 text-center flex flex-col items-center justify-center bg-white/70 dark:bg-gray-800/70 border-dashed border-2 border-gray-200 dark:border-gray-700 rounded-3xl">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-500 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Chưa có lịch thi cho bộ lọc này</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
            Nếu phòng đào tạo trường Thủy Lợi đã công bố lịch thi trên cổng sinh viên, hãy nhấn nút <strong>"Đồng bộ lại"</strong> ở góc trên để tải về ngay!
          </p>
          {onForceSync && (
            <Button
              onClick={onForceSync}
              disabled={isSyncing}
              className="mt-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-6 h-11 shadow-lg shadow-blue-500/20"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Đang kiểm tra lịch thi...' : 'Đồng bộ lịch thi ngay'}
            </Button>
          )}
        </Card>
      ) : (
        /* Exam Cards List */
        <div className="space-y-4">
          {filteredExams.map((exam, index) => {
            const daysDiff = getDaysDiff(exam.examDate);
            const isToday = daysDiff === 0;
            const isPast = daysDiff !== null && daysDiff < 0;

            return (
              <motion.div
                key={exam.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card className="p-5 sm:p-6 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/80 shadow-md shadow-gray-100/50 dark:shadow-none rounded-3xl hover:border-blue-200 dark:hover:border-blue-900 transition-all">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700/60 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 bg-blue-600 text-white text-xs font-black rounded-xl shadow-md shadow-blue-500/20 shrink-0">
                        STT {index + 1}
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                          {exam.subjectName}
                        </h3>
                        {exam.subjectCode && (
                          <span className="text-[11px] text-gray-400 font-mono">
                            Mã: {exam.subjectCode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Countdown Badge */}
                    {daysDiff !== null && (
                      <div className="shrink-0">
                        {isToday ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-md shadow-indigo-500/20">
                            <GraduationCap className="w-3.5 h-3.5 text-amber-300" /> Hôm nay thi
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã thi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
                            ⏳ Còn {daysDiff} ngày
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Detail Grid - Formatted similarly to mobile view */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Số báo danh */}
                    {exam.examCode && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-gray-400">Số báo danh</div>
                          <div className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {exam.examCode}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ngày thi */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-gray-400">Ngày thi</div>
                        <div className="text-sm font-black text-gray-900 dark:text-white truncate">
                          {formatDateDisplay(exam.examDate)}
                        </div>
                      </div>
                    </div>

                    {/* Ca thi */}
                    {exam.examShift && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-gray-400">Ca thi</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {exam.examShift}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Giờ thi */}
                    {exam.examTime && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-gray-400">Giờ thi</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {exam.examTime}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Phòng thi */}
                    {exam.roomName && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-gray-400">Phòng thi</div>
                          <div className="text-sm font-black text-blue-600 dark:text-blue-400 truncate">
                            {exam.roomName}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Số sinh viên dự kiến */}
                    {exam.numberExpectedStudent != null && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-gray-400">Số sinh viên dự kiến</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {exam.numberExpectedStudent} sinh viên
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
