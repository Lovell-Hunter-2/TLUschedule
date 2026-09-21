import { useState, useMemo } from 'react';
import { Subject } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { 
  Search, 
  BookOpen, 
  Users, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Filter, 
  Calendar, 
  ChevronRight, 
  CalendarOff, 
  CalendarClock,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RegistrationPeriodSelection } from './RegistrationPeriodSelection';
import { RegistrationSimulationModal } from './RegistrationSimulationModal';
import { 
  SemesterRegisterPeriod, 
  SCHOOL_YEAR_REGISTRATIONS, 
  getRegistrationPeriodStatus,
  PeriodStatus 
} from '../data/registrationData';

export interface OpenClassSection {
  id: string;
  classCode: string; // e.g. "CSE281_01"
  subjectCode: string;
  subjectName: string;
  credits: number;
  lecturer: string;
  dayOfWeek: number; // 0 for CN, 1 for T2, ..., 6 for T7
  periods: number[]; // e.g. [1, 2, 3]
  room: string;
  enrolled: number;
  maxCapacity: number;
  department: string;
  startDate: string;
  endDate: string;
  semesterCode?: string;
  category?: string;
}

interface CourseRegistrationViewProps {
  currentSubjects: Subject[];
  onAddSubject: (newSubject: Subject) => void;
}

export function CourseRegistrationView({ currentSubjects, onAddSubject }: CourseRegistrationViewProps) {
  // Find default period: active period if any, else the newest main period
  const defaultPeriod = useMemo(() => {
    for (const group of SCHOOL_YEAR_REGISTRATIONS) {
      const active = group.periods.find(p => getRegistrationPeriodStatus(p) === 'active');
      if (active) return active;
    }
    const newestGroup = SCHOOL_YEAR_REGISTRATIONS[0];
    const mainPeriod = newestGroup?.periods.find(p => p.name === 'Học kỳ chính');
    return mainPeriod || newestGroup?.periods[0] || SCHOOL_YEAR_REGISTRATIONS[0].periods[0];
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState<SemesterRegisterPeriod>(() => {
    const savedId = localStorage.getItem('tlu_selected_reg_period_id');
    if (savedId) {
      for (const group of SCHOOL_YEAR_REGISTRATIONS) {
        const found = group.periods.find(p => p.id === savedId);
        if (found) return found;
      }
    }
    return defaultPeriod;
  });

  const [isSelectingPeriod, setIsSelectingPeriod] = useState(false);
  const [isSimulationOpen, setIsSimulationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'no_conflict'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [addedClassIds, setAddedClassIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  const handleSelectPeriod = (period: SemesterRegisterPeriod) => {
    setSelectedPeriod(period);
    localStorage.setItem('tlu_selected_reg_period_id', period.id);
    setIsSelectingPeriod(false);
    setSearchTerm('');
    setFilterMode('all');
    setSelectedDepartment('all');
  };

  // Real course list for selected period (no mock/simulated courses)
  const currentPeriodCourses: OpenClassSection[] = useMemo(() => {
    return [];
  }, [selectedPeriod]);

  // Current registration period status: 'active' | 'expired' | 'upcoming'
  const periodStatus: PeriodStatus = useMemo(() => {
    return getRegistrationPeriodStatus(selectedPeriod);
  }, [selectedPeriod]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    currentPeriodCourses.forEach(c => set.add(c.department));
    return Array.from(set);
  }, [currentPeriodCourses]);

  // Check if a section conflicts with student's current timetable
  const checkScheduleConflict = (section: OpenClassSection): { conflict: boolean; conflictingSubject?: Subject } => {
    for (const sub of currentSubjects) {
      if (sub.daysOfWeek.includes(section.dayOfWeek)) {
        const periodOverlap = section.periods.some(p => sub.periods.includes(p));
        if (periodOverlap) {
          return { conflict: true, conflictingSubject: sub };
        }
      }
    }
    return { conflict: false };
  };

  const filteredCourses = useMemo(() => {
    return currentPeriodCourses.filter(c => {
      const matchSearch = 
        c.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.classCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.lecturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.room.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (selectedDepartment !== 'all' && c.department !== selectedDepartment) {
        return false;
      }

      if (filterMode === 'available' && c.enrolled >= c.maxCapacity) {
        return false;
      }

      if (filterMode === 'no_conflict') {
        const { conflict } = checkScheduleConflict(c);
        if (conflict) return false;
      }

      return true;
    });
  }, [currentPeriodCourses, searchTerm, filterMode, selectedDepartment, currentSubjects]);

  const handleEnrollCourse = (section: OpenClassSection) => {
    const newSubject: Subject = {
      id: `reg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: section.subjectName,
      code: section.classCode,
      room: section.room,
      lecturer: section.lecturer,
      daysOfWeek: [section.dayOfWeek],
      periods: section.periods,
      startDate: section.startDate,
      endDate: section.endDate,
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-l-blue-500',
    };

    onAddSubject(newSubject);
    setAddedClassIds(prev => new Set(prev).add(section.id));
    setNotification(`Đã thêm lớp "${section.classCode} - ${section.subjectName}" vào Thời khóa biểu!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const getDayText = (d: number) => {
    if (d === 0) return 'Chủ Nhật';
    return `Thứ ${d + 1}`;
  };

  // If user is currently choosing a period, show RegistrationPeriodSelection view
  if (isSelectingPeriod) {
    return (
      <RegistrationPeriodSelection
        currentPeriodId={selectedPeriod.id}
        onSelectPeriod={handleSelectPeriod}
        onBack={() => setIsSelectingPeriod(false)}
        showBackButton={true}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header Info Banner with Selected Period Info */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-blue-50/60 dark:from-blue-950/30 dark:via-gray-800 dark:to-indigo-950/20 border-blue-200/70 dark:border-blue-800/60">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                Tra cứu Đăng ký môn học & Lớp học phần
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
              Tra cứu trạng thái mở đợt và danh sách lớp học phần đăng ký tín chỉ Đại học Thủy Lợi (TLU).
            </p>
          </div>

          {/* Current Period Card & Select Period Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
            <div className="p-2.5 px-3.5 bg-white/90 dark:bg-gray-800/90 rounded-xl border border-blue-200/80 dark:border-blue-700/80 shadow-xs flex flex-col gap-1 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-100">
                  {selectedPeriod.name}
                </span>
                {periodStatus === 'active' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Đang mở
                  </span>
                )}
                {periodStatus === 'expired' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    Đã kết thúc
                  </span>
                )}
                {periodStatus === 'upcoming' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                    Chưa mở đăng ký
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <span>Học kỳ: <strong className="font-mono text-gray-700 dark:text-gray-300">{selectedPeriod.semesterCode}</strong></span>
                <span>•</span>
                <span>Năm: {selectedPeriod.yearName}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSimulationOpen(true)}
              className="rounded-xl text-xs h-10 px-3.5 font-semibold shrink-0 gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Đăng ký mô phỏng</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSelectingPeriod(true)}
              className="rounded-xl text-xs h-10 px-3.5 font-semibold shrink-0 gap-1.5 shadow-xs w-full sm:w-auto"
            >
              <Calendar className="w-4 h-4" />
              <span>Chọn đợt đăng ký</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* When no courses are present (no mock data, status based) */}
      {currentPeriodCourses.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs">
          {periodStatus === 'expired' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center">
                <CalendarOff className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                  <span>Đã hết hạn đăng ký</span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                  Đợt đăng ký này đã kết thúc
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  Học kỳ <strong className="text-gray-700 dark:text-gray-200">{selectedPeriod.name} ({selectedPeriod.semesterCode})</strong> - Năm học {selectedPeriod.yearName} đã qua thời gian đăng ký tín chỉ. Hiện tại không có môn học nào mở đăng ký trên hệ thống.
                </p>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Thời gian: <strong>{selectedPeriod.timeText}</strong></span>
                </div>
              </div>
            </>
          ) : periodStatus === 'upcoming' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center">
                <CalendarClock className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-[11px] font-semibold">
                  <span>Chưa mở đăng ký</span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                  Chưa đến thời gian mở đăng ký
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  Học kỳ <strong className="text-gray-700 dark:text-gray-200">{selectedPeriod.name} ({selectedPeriod.semesterCode})</strong> - Năm học {selectedPeriod.yearName} hiện chưa mở cổng đăng ký tín chỉ hoặc chưa cập nhật thời gian chính thức.
                </p>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Lịch đăng ký: <strong>{selectedPeriod.timeText}</strong></span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                  <span>Đang mở</span>
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">
                  Không có môn học nào mở đăng ký
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  Hệ thống ghi nhận đợt <strong className="text-gray-700 dark:text-gray-200">{selectedPeriod.name} ({selectedPeriod.semesterCode})</strong> đang trong thời gian mở, tuy nhiên hiện tại không có lớp học phần nào mở để đăng ký.
                </p>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Thời gian: <strong>{selectedPeriod.timeText}</strong></span>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSimulationOpen(true)}
              className="rounded-xl text-xs font-semibold px-4 py-2 flex items-center gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Thử Đăng ký mô phỏng (Xếp TKB)</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSelectingPeriod(true)}
              className="rounded-xl text-xs font-semibold px-4 py-2 flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>Chọn đợt đăng ký khác</span>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm theo tên môn, mã môn, mã lớp (CSE...), giảng viên hoặc phòng học..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none text-sm transition-all shadow-xs text-gray-800 dark:text-gray-100"
              />
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  onClick={() => setFilterMode('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filterMode === 'all'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
                  )}
                >
                  Tất cả ({currentPeriodCourses.length})
                </button>
                <button
                  onClick={() => setFilterMode('available')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    filterMode === 'available'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
                  )}
                >
                  Chỉ lớp còn chỗ
                </button>
                <button
                  onClick={() => setFilterMode('no_conflict')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                    filterMode === 'no_conflict'
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Không trùng TKB hiện tại
                </button>
              </div>

              {departments.length > 0 && (
                <div className="ml-auto flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 text-gray-700 dark:text-gray-200"
                  >
                    <option value="all">Mọi Khoa / Bộ môn</option>
                    {departments.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Courses List */}
          <div className="flex flex-col gap-3">
            {filteredCourses.length === 0 ? (
              <Card className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-white dark:bg-gray-800 border-dashed">
                <Search className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Không tìm thấy lớp học phần phù hợp
                </p>
                <p className="text-xs text-gray-400">
                  Thử thay đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc
                </p>
              </Card>
            ) : (
              filteredCourses.map((course) => {
                const { conflict, conflictingSubject } = checkScheduleConflict(course);
                const isFull = course.enrolled >= course.maxCapacity;
                const isAlreadyAdded = addedClassIds.has(course.id) || currentSubjects.some(s => s.code === course.classCode);
                const fillPercentage = Math.round((course.enrolled / course.maxCapacity) * 100);

                return (
                  <Card
                    key={course.id}
                    className={cn(
                      "p-4 transition-all duration-200 border flex flex-col gap-3 bg-white dark:bg-gray-800",
                      conflict
                        ? "border-amber-200/80 dark:border-amber-900/50 bg-amber-50/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700/60 pb-3">
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0 mt-0.5">
                          {course.classCode}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                            {course.subjectName}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>{course.subjectCode}</span>
                            <span>•</span>
                            <span>{course.credits} tín chỉ</span>
                            <span>•</span>
                            <span>{course.department}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        {isFull ? (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            Đã hết chỗ (Đầy)
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Còn {course.maxCapacity - course.enrolled} chỗ
                          </span>
                        )}

                        {conflict && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Trùng TKB
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-750/50 p-2.5 rounded-xl">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                        <span><b>{getDayText(course.dayOfWeek)}</b>, Tiết {course.periods.join('-')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Phòng: <b>{course.room}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">GV: <b>{course.lecturer}</b></span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex-1 max-w-sm">
                        <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1">
                          <span>Sĩ số đăng ký: <b>{course.enrolled} / {course.maxCapacity}</b></span>
                          <span>{fillPercentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              isFull 
                                ? "bg-rose-500" 
                                : fillPercentage > 80 
                                ? "bg-amber-500" 
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, fillPercentage)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {conflict && conflictingSubject && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            Trùng với "{conflictingSubject.name}"
                          </span>
                        )}

                        <Button
                          size="sm"
                          variant={isAlreadyAdded ? "outline" : "primary"}
                          onClick={() => handleEnrollCourse(course)}
                          disabled={isAlreadyAdded}
                          className={cn(
                            "text-xs gap-1.5 h-8 px-3 rounded-xl",
                            isAlreadyAdded ? "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : ""
                          )}
                        >
                          {isAlreadyAdded ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Đã thêm
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Thêm vào TKB
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* 3-Layout Registration Simulation Modal */}
      <RegistrationSimulationModal
        isOpen={isSimulationOpen}
        onClose={() => setIsSimulationOpen(false)}
        currentSubjects={currentSubjects}
        onApplyToTimetable={(subjectsToAdd) => {
          subjectsToAdd.forEach(s => onAddSubject(s));
          setNotification(`Đã thêm ${subjectsToAdd.length} môn học từ mô phỏng vào Thời khóa biểu!`);
          setTimeout(() => setNotification(null), 4000);
        }}
      />
    </div>
  );
}
