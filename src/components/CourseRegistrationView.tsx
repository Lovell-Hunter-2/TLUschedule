import { useState, useMemo } from 'react';
import { Subject } from '../types';
import { Card } from './Card';
import { Button } from './Button';
import { Search, BookOpen, Users, Clock, MapPin, AlertTriangle, CheckCircle2, Plus, Filter, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
}

// Sample representative course registration catalog for TLU (Semester 2, 2025-2026)
const MOCK_TLU_OPEN_COURSES: OpenClassSection[] = [
  {
    id: 'reg-1',
    classCode: 'CSE281_01',
    subjectCode: 'CSE281',
    subjectName: 'Lập trình nâng cao (C++/Java)',
    credits: 3,
    lecturer: 'TS. Nguyễn Văn Nam',
    dayOfWeek: 2, // Thứ 3
    periods: [1, 2, 3],
    room: '302-A4',
    enrolled: 54,
    maxCapacity: 60,
    department: 'Công nghệ thông tin',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-2',
    classCode: 'CSE281_02',
    subjectCode: 'CSE281',
    subjectName: 'Lập trình nâng cao (C++/Java)',
    credits: 3,
    lecturer: 'ThS. Trần Thị Mai',
    dayOfWeek: 4, // Thứ 5
    periods: [7, 8, 9],
    room: '405-A4',
    enrolled: 60,
    maxCapacity: 60,
    department: 'Công nghệ thông tin',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-3',
    classCode: 'CSE381_01',
    subjectCode: 'CSE381',
    subjectName: 'Cơ sở dữ liệu',
    credits: 3,
    lecturer: 'PGS.TS. Lê Quốc Hưng',
    dayOfWeek: 1, // Thứ 2
    periods: [1, 2, 3],
    room: '204-T45',
    enrolled: 48,
    maxCapacity: 65,
    department: 'Công nghệ thông tin',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-4',
    classCode: 'CSE381_02',
    subjectCode: 'CSE381',
    subjectName: 'Cơ sở dữ liệu',
    credits: 3,
    lecturer: 'TS. Đặng Thanh Tùng',
    dayOfWeek: 3, // Thứ 4
    periods: [4, 5, 6],
    room: '301-A4',
    enrolled: 65,
    maxCapacity: 65,
    department: 'Công nghệ thông tin',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-5',
    classCode: 'CSE484_01',
    subjectCode: 'CSE484',
    subjectName: 'Trí tuệ nhân tạo (AI & Machine Learning)',
    credits: 3,
    lecturer: 'TS. Hoàng Đức Long',
    dayOfWeek: 5, // Thứ 6
    periods: [1, 2, 3],
    room: '402-A4',
    enrolled: 42,
    maxCapacity: 50,
    department: 'Công nghệ thông tin',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-6',
    classCode: 'CSE385_01',
    subjectCode: 'CSE385',
    subjectName: 'Mạng máy tính & Truyền thông',
    credits: 3,
    lecturer: 'ThS. Nguyễn Quỳnh Nga',
    dayOfWeek: 3, // Thứ 4
    periods: [1, 2, 3],
    room: '305-A4',
    enrolled: 52,
    maxCapacity: 60,
    department: 'Công nghệ thông tin',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-7',
    classCode: 'MAT102_01',
    subjectCode: 'MAT102',
    subjectName: 'Giải tích 2',
    credits: 3,
    lecturer: 'TS. Vũ Đình Thắng',
    dayOfWeek: 2, // Thứ 3
    periods: [7, 8, 9],
    room: '201-B1',
    enrolled: 70,
    maxCapacity: 75,
    department: 'Toán học',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-8',
    classCode: 'PHY101_01',
    subjectCode: 'PHY101',
    subjectName: 'Vật lý đại cương 1',
    credits: 3,
    lecturer: 'TS. Bùi Văn Hải',
    dayOfWeek: 4, // Thứ 5
    periods: [1, 2, 3],
    room: '304-B1',
    enrolled: 78,
    maxCapacity: 80,
    department: 'Vật lý kỹ thuật',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-9',
    classCode: 'ECO101_01',
    subjectCode: 'ECO101',
    subjectName: 'Kinh tế vi mô',
    credits: 2,
    lecturer: 'TS. Phạm Minh Hà',
    dayOfWeek: 1, // Thứ 2
    periods: [7, 8, 9],
    room: '102-A1',
    enrolled: 62,
    maxCapacity: 70,
    department: 'Kinh tế & Quản lý',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-10',
    classCode: 'ENG201_01',
    subjectCode: 'ENG201',
    subjectName: 'Tiếng Anh chuyên ngành CNTT',
    credits: 2,
    lecturer: 'ThS. Đỗ Thị Thu Hiền',
    dayOfWeek: 5, // Thứ 6
    periods: [7, 8, 9],
    room: '205-A5',
    enrolled: 40,
    maxCapacity: 45,
    department: 'Ngoại ngữ',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-11',
    classCode: 'WRE210_01',
    subjectCode: 'WRE210',
    subjectName: 'Thủy lực đại cương',
    credits: 3,
    lecturer: 'PGS.TS. Ngô Lê An',
    dayOfWeek: 6, // Thứ 7
    periods: [1, 2, 3],
    room: '302-T35',
    enrolled: 45,
    maxCapacity: 60,
    department: 'Tài nguyên nước',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  },
  {
    id: 'reg-12',
    classCode: 'CIE301_01',
    subjectCode: 'CIE301',
    subjectName: 'Sức bền vật liệu',
    credits: 3,
    lecturer: 'TS. Nguyễn Mạnh Hùng',
    dayOfWeek: 2, // Thứ 3
    periods: [4, 5, 6],
    room: '202-C1',
    enrolled: 55,
    maxCapacity: 55,
    department: 'Công trình',
    startDate: '2025-02-10',
    endDate: '2025-05-30',
  }
];

interface CourseRegistrationViewProps {
  currentSubjects: Subject[];
  onAddSubject: (newSubject: Subject) => void;
}

export function CourseRegistrationView({ currentSubjects, onAddSubject }: CourseRegistrationViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'no_conflict'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [addedClassIds, setAddedClassIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    MOCK_TLU_OPEN_COURSES.forEach(c => set.add(c.department));
    return Array.from(set);
  }, []);

  // Check if a section conflicts with student's current timetable
  const checkScheduleConflict = (section: OpenClassSection): { conflict: boolean; conflictingSubject?: Subject } => {
    for (const sub of currentSubjects) {
      // Check day overlap
      if (sub.daysOfWeek.includes(section.dayOfWeek)) {
        // Check period overlap
        const periodOverlap = section.periods.some(p => sub.periods.includes(p));
        if (periodOverlap) {
          return { conflict: true, conflictingSubject: sub };
        }
      }
    }
    return { conflict: false };
  };

  const filteredCourses = useMemo(() => {
    return MOCK_TLU_OPEN_COURSES.filter(c => {
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
  }, [searchTerm, filterMode, selectedDepartment, currentSubjects]);

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

  return (
    <div className="flex flex-col gap-4">
      {/* Header Info Banner */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-blue-50/60 dark:from-blue-950/30 dark:via-gray-800 dark:to-indigo-950/20 border-blue-200/70 dark:border-blue-800/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
              Tra cứu danh sách lớp học phần đang mở tại TLU, theo dõi sĩ số chỗ trống trực tiếp và tự động đối chiếu xem có bị trùng lịch với TKB của bạn hay không.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold px-2.5 py-1 bg-white/90 dark:bg-gray-700/90 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700 shadow-xs">
              Kỳ 2 (2025 - 2026)
            </span>
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
            <Button
              size="sm"
              variant={filterMode === 'all' ? 'primary' : 'outline'}
              onClick={() => setFilterMode('all')}
              className="rounded-xl text-xs h-8 px-3 font-medium shrink-0"
            >
              Tất cả ({MOCK_TLU_OPEN_COURSES.length})
            </Button>
            <Button
              size="sm"
              variant={filterMode === 'available' ? 'primary' : 'outline'}
              onClick={() => setFilterMode('available')}
              className="rounded-xl text-xs h-8 px-3 font-medium shrink-0"
            >
              Chỉ lớp còn chỗ
            </Button>
            <Button
              size="sm"
              variant={filterMode === 'no_conflict' ? 'primary' : 'outline'}
              onClick={() => setFilterMode('no_conflict')}
              className="rounded-xl text-xs h-8 px-3 font-medium shrink-0 gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Không trùng TKB hiện tại
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs rounded-xl px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:border-blue-400"
            >
              <option value="all">Mọi Khoa / Bộ môn</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="flex flex-col gap-3">
        {filteredCourses.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            Không tìm thấy lớp học phần phù hợp với điều kiện tìm kiếm.
          </div>
        ) : (
          filteredCourses.map((course) => {
            const isFull = course.enrolled >= course.maxCapacity;
            const remaining = Math.max(0, course.maxCapacity - course.enrolled);
            const fillPercentage = Math.round((course.enrolled / course.maxCapacity) * 100);
            const { conflict, conflictingSubject } = checkScheduleConflict(course);
            const isAlreadyAdded = addedClassIds.has(course.id);

            return (
              <Card 
                key={course.id} 
                className={cn(
                  "p-4 transition-all hover:border-gray-300 dark:hover:border-gray-600 shadow-xs flex flex-col gap-3",
                  conflict ? "border-amber-200/80 bg-amber-50/20 dark:bg-amber-950/10" : ""
                )}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                        {course.classCode}
                      </span>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                        {course.subjectName}
                      </h4>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{course.subjectCode}</span>
                      <span>•</span>
                      <span>{course.credits} tín chỉ</span>
                      <span>•</span>
                      <span className="text-gray-600 dark:text-gray-300 font-medium">{course.department}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isFull ? (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        Đã hết chỗ (Đầy)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Còn {remaining} chỗ
                      </span>
                    )}

                    {conflict && (
                      <span className="px-2 py-1 rounded-xl text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Trùng TKB
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-gray-50 dark:bg-gray-800/80 p-3 rounded-xl border border-gray-100 dark:border-gray-700/80">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>
                      <b>{getDayText(course.dayOfWeek)}</b>, Tiết {Math.min(...course.periods)}-{Math.max(...course.periods)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Phòng: <b>{course.room}</b></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="truncate">GV: <b>{course.lecturer}</b></span>
                  </div>
                </div>

                {/* Enrollment Bar & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  {/* Sĩ số progress bar */}
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

                  {/* Actions & Conflicts message */}
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
    </div>
  );
}
