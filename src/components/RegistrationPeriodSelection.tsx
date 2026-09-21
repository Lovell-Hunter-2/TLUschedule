import React, { useState, useMemo } from 'react';
import { Subject, PERIODS } from '../types';
import { Button } from './Button';
import { 
  X, 
  Search, 
  BookOpen, 
  Clock, 
  MapPin, 
  Users, 
  AlertTriangle, 
  Check, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  Info,
  CalendarCheck,
  RotateCcw,
  Plus
} from 'lucide-react';
import { cn, getSubjectColor } from '../lib/utils';
import { 
  TLU_SIMULATION_COURSES, 
  SimulationSubject, 
  SimulationClassSection 
} from '../data/simulationCoursesData';

interface RegistrationSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubjects: Subject[];
  onApplyToTimetable?: (subjectsToAdd: Subject[]) => void;
}

const DAYS_OF_WEEK = [
  { day: 1, label: 'Thứ 2', short: 'T2' },
  { day: 2, label: 'Thứ 3', short: 'T3' },
  { day: 3, label: 'Thứ 4', short: 'T4' },
  { day: 4, label: 'Thứ 5', short: 'T5' },
  { day: 5, label: 'Thứ 6', short: 'T6' },
  { day: 6, label: 'Thứ 7', short: 'T7' },
  { day: 0, label: 'Chủ Nhật', short: 'CN' },
];

export function RegistrationSimulationModal({
  isOpen,
  onClose,
  currentSubjects,
  onApplyToTimetable,
}: RegistrationSimulationModalProps) {
  const [searchSubject, setSearchSubject] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    TLU_SIMULATION_COURSES[0]?.id || ''
  );
  // Map of subjectId -> chosen section (chosen class)
  const [simulatedPlan, setSimulatedPlan] = useState<Record<string, { subject: SimulationSubject; section: SimulationClassSection }>>(() => {
    try {
      const saved = localStorage.getItem('tlu_simulation_plan');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return {};
  });

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Save to localStorage when plan changes
  const savePlan = (newPlan: Record<string, { subject: SimulationSubject; section: SimulationClassSection }>) => {
    setSimulatedPlan(newPlan);
    try {
      localStorage.setItem('tlu_simulation_plan', JSON.stringify(newPlan));
    } catch (e) {}
  };

  // Filtered subject list for left layout
  const filteredSubjects = useMemo(() => {
    if (!searchSubject.trim()) return TLU_SIMULATION_COURSES;
    const q = searchSubject.toLowerCase().trim();
    return TLU_SIMULATION_COURSES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [searchSubject]);

  const activeSubject = useMemo(() => {
    return TLU_SIMULATION_COURSES.find((s) => s.id === selectedSubjectId) || TLU_SIMULATION_COURSES[0];
  }, [selectedSubjectId]);

  // Check conflicts for a candidate section against:
  // 1. Current real subjects in timetable
  // 2. Already selected sections in simulated plan (except current subject's own section)
  const checkConflict = (subjectId: string, section: SimulationClassSection) => {
    // 1. Check against current real timetable
    for (const cur of currentSubjects) {
      if (cur.daysOfWeek.includes(section.dayOfWeek)) {
        const overlap = section.periods.some((p) => cur.periods.includes(p));
        if (overlap) {
          return {
            hasConflict: true,
            source: 'current_timetable',
            conflictName: `${cur.name} (TKB hiện tại)`,
          };
        }
      }
    }

    // 2. Check against other simulated sections
    for (const [sId, item] of Object.entries(simulatedPlan)) {
      if (sId !== subjectId) {
        if (item.section.dayOfWeek === section.dayOfWeek) {
          const overlap = section.periods.some((p) => item.section.periods.includes(p));
          if (overlap) {
            return {
              hasConflict: true,
              source: 'simulated_plan',
              conflictName: `${item.subject.name} (${item.section.classCode})`,
            };
          }
        }
      }
    }

    return { hasConflict: false };
  };

  // Toggle or select a section for current subject
  const handleToggleSection = (subject: SimulationSubject, section: SimulationClassSection) => {
    const isCurrentlySelected = simulatedPlan[subject.id]?.section.id === section.id;
    const nextPlan = { ...simulatedPlan };

    if (isCurrentlySelected) {
      delete nextPlan[subject.id];
      showToast(`Đã bỏ chọn môn ${subject.name}`);
    } else {
      nextPlan[subject.id] = { subject, section };
      showToast(`Đã chọn lớp ${section.classCode} (${subject.name}) vào mô phỏng!`);
    }

    savePlan(nextPlan);
  };

  const handleRemoveFromPlan = (subjectId: string) => {
    const nextPlan = { ...simulatedPlan };
    const name = nextPlan[subjectId]?.subject.name;
    delete nextPlan[subjectId];
    savePlan(nextPlan);
    if (name) showToast(`Đã xóa ${name} khỏi danh sách mô phỏng`);
  };

  const handleClearPlan = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ môn học trong lịch mô phỏng?')) {
      savePlan({});
      showToast('Đã làm mới lịch mô phỏng');
    }
  };

  // Copy individual class code
  const handleCopySingleCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Đã sao chép mã lớp: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Copy all planned class codes separated by space/comma for quick portal pasting
  const handleCopyAllCodes = () => {
    const codes = Object.values(simulatedPlan).map((item) => item.section.classCode);
    if (codes.length === 0) {
      showToast('Chưa có lớp nào được chọn trong mô phỏng');
      return;
    }
    const textToCopy = codes.join(' ');
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode('ALL');
    showToast(`Đã sao chép ${codes.length} mã lớp: ${textToCopy}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Apply simulated plan into actual schedule
  const handleApplyToTimetable = () => {
    const plannedItems = Object.values(simulatedPlan);
    if (plannedItems.length === 0) {
      alert('Vui lòng chọn ít nhất 1 lớp học phần trong kế hoạch mô phỏng.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const subjectsToAdd: Subject[] = plannedItems.map((item) => ({
      id: `sim-${Date.now()}-${item.section.id}`,
      name: item.subject.name,
      code: item.section.classCode,
      room: item.section.room,
      lecturer: item.section.lecturer,
      daysOfWeek: [item.section.dayOfWeek],
      periods: item.section.periods,
      startDate: todayStr,
      endDate: threeMonthsLater,
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-l-blue-500',
    }));

    if (onApplyToTimetable) {
      onApplyToTimetable(subjectsToAdd);
      showToast(`Đã thêm ${subjectsToAdd.length} môn vào Thời khóa biểu chính thức!`);
      setTimeout(() => {
        onClose();
      }, 800);
    }
  };

  // Total credits planned
  const totalPlannedCredits = useMemo(() => {
    return Object.values(simulatedPlan).reduce((acc, cur) => acc + cur.subject.credits, 0);
  }, [simulatedPlan]);

  // Timetable grid cell calculation for 3rd layout
  // periods: 1 to 12 (covers sáng + chiều)
  const displayPeriods = useMemo(() => PERIODS.filter((p) => p.id <= 12), []);

  const getDayText = (d: number) => {
    if (d === 0) return 'Chủ Nhật';
    return `Thứ ${d + 1}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-200">
      {/* Full Modal Box - gần kín màn hình */}
      <div className="w-full max-w-[98vw] xl:max-w-[95vw] 2xl:max-w-[1700px] h-[94vh] max-h-[960px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  Đăng ký môn học mô phỏng (Xếp lịch TKB)
                </h2>
                <span className="hidden md:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  Mô phỏng thử nghiệm
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Chọn môn và lớp học phần để xem trực tiếp lịch học xếp vào Thời khóa biểu tuần, kiểm tra trùng lịch và sao chép nhanh mã lớp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Copy All button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAllCodes}
              disabled={Object.keys(simulatedPlan).length === 0}
              className="rounded-xl text-xs font-semibold h-8.5 px-2.5 sm:px-3 gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
              title="Sao chép toàn bộ mã lớp đã chọn để dán nhanh vào web trường"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sao chép nhanh mã lớp</span>
              <span className="sm:hidden">Copy mã</span>
              {Object.keys(simulatedPlan).length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px]">
                  {Object.keys(simulatedPlan).length}
                </span>
              )}
            </Button>

            {/* Apply to real timetable button */}
            {onApplyToTimetable && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyToTimetable}
                disabled={Object.keys(simulatedPlan).length === 0}
                className="rounded-xl text-xs font-semibold h-8.5 px-2.5 sm:px-3.5 gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lưu vào TKB chính</span>
                <span className="sm:hidden">Lưu TKB</span>
              </Button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast alert notice */}
        {toastMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-in slide-in-from-top-1 duration-150 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">
              Đóng
            </button>
          </div>
        )}

        {/* 3 VERTICAL LAYOUTS CONTAINER */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-800 overflow-hidden">
          
          {/* ============================================================ */}
          {/* LAYOUT 1 (BÊN TRÁI): CHỌN MÔN HỌC (lg:col-span-3) */}
          {/* ============================================================ */}
          <div className="lg:col-span-3 flex flex-col h-full overflow-hidden bg-gray-50/40 dark:bg-gray-900/40">
            {/* Layout 1 Header & Search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850/80 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 inline-flex items-center justify-center text-[11px] font-black">
                    1
                  </span>
                  Chọn môn học
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {filteredSubjects.length} môn
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm tên môn, mã môn..."
                  value={searchSubject}
                  onChange={(e) => setSearchSubject(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Layout 1 Subjects List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar">
              {filteredSubjects.map((sub) => {
                const isSelected = sub.id === activeSubject.id;
                const plannedSection = simulatedPlan[sub.id]?.section;
                const isPlanned = !!plannedSection;

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubjectId(sub.id)}
                    className={cn(
                      "p-2.5 rounded-xl cursor-pointer transition-all border text-left flex flex-col gap-1 relative",
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs"
                        : "bg-white dark:bg-gray-800/80 border-gray-200/80 dark:border-gray-750 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shrink-0">
                        {sub.code}
                      </span>
                      {isPlanned && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3" />
                          Đã chọn
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                      {sub.name}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      <span>{sub.credits} tín chỉ</span>
                      <span className="text-[10px] text-gray-400">{sub.sections.length} lớp mở</span>
                    </div>

                    {/* Show chosen class badge if planned */}
                    {isPlanned && (
                      <div className="mt-1 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-300">
                        <span>Lớp: <b>{plannedSection.classCode}</b></span>
                        <span>{getDayText(plannedSection.dayOfWeek)} (T{plannedSection.periods.join('-')})</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Layout 1 Footer summary */}
            <div className="p-2.5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 shrink-0 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Đã xếp: <b>{Object.keys(simulatedPlan).length} môn</b></span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{totalPlannedCredits} tín chỉ</span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* LAYOUT 2 (Ở GIỮA): DANH SÁCH LỚP HỌC PHẦN (lg:col-span-3) */}
          {/* ============================================================ */}
          <div className="lg:col-span-3 flex flex-col h-full overflow-hidden bg-gray-50/20 dark:bg-gray-900/20">
            {/* Layout 2 Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850/80 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 inline-flex items-center justify-center text-[11px] font-black">
                    2
                  </span>
                  Lớp học phần (Ca học)
                </span>
                <span className="text-[11px] font-mono text-gray-500">
                  {activeSubject.sections.length} lớp
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Môn đang xem: <strong className="text-gray-800 dark:text-gray-200">{activeSubject.name}</strong>
              </p>
            </div>

            {/* Layout 2 Sections List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
              {activeSubject.sections.map((sec) => {
                const isSelected = simulatedPlan[activeSubject.id]?.section.id === sec.id;
                const conflictInfo = checkConflict(activeSubject.id, sec);
                const isFull = sec.enrolled >= sec.maxCapacity;

                return (
                  <div
                    key={sec.id}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex flex-col gap-2 relative",
                      isSelected
                        ? "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs ring-1 ring-indigo-400/50"
                        : conflictInfo.hasConflict
                        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
                        : "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-indigo-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-indigo-900 dark:text-indigo-200">
                            {sec.classCode}
                          </span>
                          <span className="text-[10px] text-gray-500">Nhóm {sec.groupNumber}</span>
                        </div>
                      </div>

                      {/* Quick Copy Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopySingleCode(sec.classCode);
                        }}
                        className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Sao chép mã lớp này"
                      >
                        {copiedCode === sec.classCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Schedule detail of this class */}
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-50/70 dark:bg-gray-750/50 p-2 rounded-lg">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-gray-900 dark:text-gray-100">
                          {getDayText(sec.dayOfWeek)}, Tiết {sec.periods.join('-')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>Phòng: <b>{sec.room}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">GV: {sec.lecturer}</span>
                      </div>
                    </div>

                    {/* Capacity & Conflict warning */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={cn(
                        "font-medium",
                        isFull ? "text-rose-600" : "text-gray-500"
                      )}>
                        Sĩ số: {sec.enrolled}/{sec.maxCapacity} {isFull ? '(Đầy)' : ''}
                      </span>

                      {conflictInfo.hasConflict && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Trùng lịch
                        </span>
                      )}
                    </div>

                    {conflictInfo.hasConflict && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        ⚠️ Trùng với: <b>{conflictInfo.conflictName}</b>
                      </p>
                    )}

                    {/* Select / Toggle button */}
                    <Button
                      size="sm"
                      variant={isSelected ? "primary" : "outline"}
                      onClick={() => handleToggleSection(activeSubject, sec)}
                      className={cn(
                        "w-full text-xs h-7.5 rounded-lg mt-0.5 font-semibold",
                        isSelected 
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                          : "border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Đã chọn (Bấm để hủy)
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Chọn ca này vào TKB
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Layout 2 Footer */}
            <div className="p-2.5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 shrink-0 text-[11px] text-gray-500 flex items-center justify-between">
              <span>Bấm vào lớp để thử nhảy vào TKB tuần</span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* LAYOUT 3 (BÊN PHẢI - TO NHẤT): THỜI KHÓA BIỂU TUẦN (lg:col-span-6) */}
          {/* ============================================================ */}
          <div className="lg:col-span-6 flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
            {/* Layout 3 Header & Controls */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4.5 h-4.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center text-[11px] font-black">
                    3
                  </span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Mô phỏng Thời khóa biểu (Week View)
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Lịch học màu xanh/tím là các lớp mô phỏng bạn vừa chọn. Lịch xám là TKB hiện tại.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {Object.keys(simulatedPlan).length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearPlan}
                    className="text-[11px] h-7 px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg gap-1"
                    title="Xóa toàn bộ môn mô phỏng"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Làm mới
                  </Button>
                )}
              </div>
            </div>

            {/* Layout 3 Weekly Timetable Grid Table - Highly optimized for compact height */}
            <div className="flex-1 overflow-auto p-2 no-scrollbar">
              <div className="min-w-[550px] border border-gray-200 dark:border-gray-750 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-gray-850">
                {/* Day of week column headers */}
                <div className="grid grid-cols-[45px_repeat(7,1fr)] bg-gray-100/80 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-750 text-center">
                  <div className="p-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center justify-center">
                    Tiết
                  </div>
                  {DAYS_OF_WEEK.map((d) => (
                    <div
                      key={d.day}
                      className={cn(
                        "p-1.5 border-l border-gray-200 dark:border-gray-750 text-center font-bold text-[11px]",
                        d.day === 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      <span>{d.label}</span>
                    </div>
                  ))}
                </div>

                {/* Period rows 1 to 12 */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {displayPeriods.map((period) => {
                    const isMidDayBreak = period.id === 6;

                    return (
                      <React.Fragment key={period.id}>
                        <div className="grid grid-cols-[45px_repeat(7,1fr)] h-9 sm:h-10 relative">
                          {/* Period identifier column */}
                          <div className="bg-gray-50/70 dark:bg-gray-800/50 flex flex-col items-center justify-center p-0.5 border-r border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 leading-none">
                              {period.id}
                            </span>
                            <span className="text-[8px] text-gray-400 leading-none mt-0.5 hidden sm:inline font-mono">
                              {period.startTime}
                            </span>
                          </div>

                          {/* 7 Days columns for this period */}
                          {DAYS_OF_WEEK.map((d) => {
                            // Find real current timetable subjects in this slot
                            const realSubs = currentSubjects.filter(
                              (s) => s.daysOfWeek.includes(d.day) && s.periods.includes(period.id)
                            );

                            // Find simulated section in this slot
                            const simMatches = Object.values(simulatedPlan).filter(
                              (item) => item.section.dayOfWeek === d.day && item.section.periods.includes(period.id)
                            );

                            const hasBoth = realSubs.length > 0 && simMatches.length > 0;
                            const isFirstPeriodOfSim = simMatches.some((item) => item.section.periods[0] === period.id);

                            return (
                              <div
                                key={d.day}
                                className={cn(
                                  "border-l border-gray-100 dark:border-gray-800 relative p-0.5 flex flex-col justify-center",
                                  hasBoth
                                    ? "bg-rose-100/60 dark:bg-rose-950/40 ring-1 ring-rose-400 inset-0"
                                    : ""
                                )}
                              >
                                {/* 1. Render Real Subjects (grayed out background context) */}
                                {realSubs.map((rs) => (
                                  <div
                                    key={rs.id}
                                    className="text-[8.5px] leading-tight px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 truncate mb-0.5 border border-gray-300 dark:border-gray-600"
                                    title={`[TKB hiện tại] ${rs.name} (${rs.code || ''})`}
                                  >
                                    <span className="font-semibold">{rs.name}</span>
                                  </div>
                                ))}

                                {/* 2. Render Simulated Classes (prominent colorful badges) */}
                                {simMatches.map((simItem) => {
                                  const colorClass = getSubjectColor(simItem.subject.name);

                                  return (
                                    <div
                                      key={simItem.section.id}
                                      onClick={() => setSelectedSubjectId(simItem.subject.id)}
                                      className={cn(
                                        "rounded px-1 py-0.5 text-[8.5px] font-bold leading-tight cursor-pointer shadow-2xs border transition-all truncate",
                                        colorClass,
                                        "ring-1 ring-blue-400/60 dark:ring-blue-500/60"
                                      )}
                                      title={`[Mô phỏng] ${simItem.subject.name} - Lớp: ${simItem.section.classCode} (Phòng ${simItem.section.room})`}
                                    >
                                      <div className="truncate">
                                        <b>{simItem.section.classCode}</b>
                                      </div>
                                      {isFirstPeriodOfSim && (
                                        <div className="text-[7.5px] font-normal truncate opacity-90 hidden sm:block">
                                          P.{simItem.section.room}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        {/* Visual divider after Period 6 (Noon separator) */}
                        {isMidDayBreak && (
                          <div className="bg-gray-200/70 dark:bg-gray-700/60 h-1.5 border-y border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <span className="text-[7px] text-gray-400 uppercase tracking-widest font-semibold">
                              Nghỉ trưa
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Quick Copy List in Layout 3 */}
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/70 rounded-xl border border-gray-200 dark:border-gray-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                    Danh sách mã lớp đã xếp ({Object.keys(simulatedPlan).length} môn - {totalPlannedCredits} tín chỉ)
                  </span>
                  {Object.keys(simulatedPlan).length > 0 && (
                    <button
                      onClick={handleCopyAllCodes}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Sao chép tất cả mã lớp
                    </button>
                  )}
                </div>

                {Object.keys(simulatedPlan).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    Chưa có môn nào được chọn. Hãy bấm chọn môn ở Layout 1 và ca học ở Layout 2 để xếp lịch!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(simulatedPlan).map((item) => (
                      <div
                        key={item.section.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-850 rounded-lg border border-gray-200 dark:border-gray-700 text-xs shadow-2xs group"
                      >
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.section.classCode}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 text-[11px] truncate max-w-[120px]">
                          ({item.subject.name})
                        </span>
                        <button
                          onClick={() => handleCopySingleCode(item.section.classCode)}
                          className="text-gray-400 hover:text-blue-600 p-0.5 rounded ml-0.5"
                          title="Sao chép mã lớp"
                        >
                          {copiedCode === item.section.classCode ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveFromPlan(item.subject.id)}
                          className="text-gray-400 hover:text-rose-600 p-0.5 rounded ml-0.5"
                          title="Xóa môn này khỏi mô phỏng"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Layout 3 Footer info & shortcuts */}
            <div className="p-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-850 shrink-0 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Mẹo: Khi cổng trường mở đăng ký, bấm <b>"Sao chép nhanh mã lớp"</b> rồi dán thẳng vào ô tìm kiếm để đăng ký nhanh nhất!</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onClose}
                  className="text-xs h-7.5 px-3 rounded-lg"
                >
                  Đóng
                </Button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
