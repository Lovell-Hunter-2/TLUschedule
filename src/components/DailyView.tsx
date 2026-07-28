import { useState, useMemo, useEffect, useRef } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Subject, Note, PERIODS } from '../types';
import { SubjectCard } from './SubjectCard';
import { Card } from './Card';
import { StickyNote, Plus, Edit2, Trash2, Timer, PlayCircle } from 'lucide-react';
import { Button } from './Button';
import { motion } from 'motion/react';

interface DailyViewProps {
  subjects: Subject[];
  notes: Note[];
  onAddNote: (date: Date) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (noteId: string) => void;
  isSyncing?: boolean;
  onForceSync?: () => void;
}

export function DailyView({ subjects, notes, onAddNote, onEditNote, onDeleteNote, isSyncing, onForceSync }: DailyViewProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [now, setNow] = useState(new Date());

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragDistanceRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragDistanceRef.current = 0;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    dragDistanceRef.current = Math.abs(x - startX);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleDateClick = (date: Date) => {
    if (dragDistanceRef.current > 5) return;
    setSelectedDate(date);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dates = useMemo(() => {
    // Generate dates from 30 days ago to 60 days in the future
    return Array.from({ length: 90 }, (_, i) => addDays(startOfDay(new Date()), i - 30));
  }, []);

  useEffect(() => {
    // Scroll to today's date on initial load
    if (scrollRef.current) {
      const todayElement = scrollRef.current.querySelector('[data-today="true"]');
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      }
    }
  }, []);

  const daySchedule = useMemo(() => {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    return subjects
      .filter(subject => {
        return selectedDateStr >= subject.startDate && 
               selectedDateStr <= subject.endDate && 
               subject.daysOfWeek.includes(selectedDate.getDay());
      })
      .sort((a, b) => Math.min(...a.periods) - Math.min(...b.periods));
  }, [subjects, selectedDate]);

  const nextClassInfo = useMemo(() => {
    if (!isSameDay(selectedDate, new Date())) return null;

    for (const subject of daySchedule) {
      const startPeriod = PERIODS.find(p => p.id === Math.min(...subject.periods));
      const endPeriod = PERIODS.find(p => p.id === Math.max(...subject.periods));
      
      if (!startPeriod || !endPeriod) continue;

      const [startHour, startMinute] = startPeriod.startTime.split(':').map(Number);
      const [endHour, endMinute] = endPeriod.endTime.split(':').map(Number);

      const startTime = new Date(now);
      startTime.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(now);
      endTime.setHours(endHour, endMinute, 0, 0);

      if (now < startTime) {
        const diffMs = startTime.getTime() - now.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        let timeString = '';
        if (hours > 0) timeString += `${hours} giờ `;
        if (minutes > 0 || hours > 0) timeString += `${minutes} phút `;
        timeString += `${seconds} giây`;

        return {
          subject,
          status: 'upcoming',
          timeString,
          room: subject.room
        };
      } else if (now >= startTime && now <= endTime) {
        return {
          subject,
          status: 'ongoing',
          timeString: 'Đang diễn ra',
          room: subject.room
        };
      }
    }
    return null;
  }, [daySchedule, now, selectedDate]);

  const dayNotes = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return notes.filter(note => note.date === dateStr);
  }, [notes, selectedDate]);

  return (
    <div className="flex flex-col gap-6">
      <div 
        className={cn(
          "flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {dates.map((date) => (
          <button
            key={date.toString()}
            data-today={isSameDay(date, new Date())}
            onClick={() => handleDateClick(date)}
            className={cn(
              "flex flex-col items-center min-w-[64px] p-3 rounded-2xl transition-all border",
              isSameDay(date, selectedDate)
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 dark:shadow-none scale-105"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-500"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {format(date, 'EEE', { locale: vi })}
            </span>
            <span className="text-lg font-bold">
              {format(date, 'dd')}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">
            {isSameDay(selectedDate, new Date()) ? "Hôm nay" : format(selectedDate, 'EEEE, dd/MM', { locale: vi })}
          </h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onAddNote(selectedDate)}
            className="rounded-full gap-1.5 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            Note
          </Button>
        </div>

        {nextClassInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={cn(
              "p-4 border-l-4 shadow-md dark:shadow-none",
              nextClassInfo.status === 'ongoing' 
                ? "bg-green-50/50 dark:bg-green-900/20 border-l-green-500 border-green-100 dark:border-green-900/30" 
                : "bg-blue-50/50 dark:bg-blue-900/20 border-l-blue-500 border-blue-100 dark:border-blue-900/30"
            )}>
              <div className="flex items-start gap-3">
                {nextClassInfo.status === 'ongoing' ? (
                  <PlayCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5 animate-pulse" />
                ) : (
                  <Timer className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">
                    {nextClassInfo.status === 'ongoing' ? 'Đang học:' : 'Môn tiếp theo:'} {nextClassInfo.subject.name}
                  </h4>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                    {nextClassInfo.room && <span className="mr-2">Phòng: {nextClassInfo.room}</span>}
                    <span className={cn(
                      "font-bold",
                      nextClassInfo.status === 'ongoing' ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"
                    )}>
                      {nextClassInfo.status === 'ongoing' ? 'Đang diễn ra' : `Bắt đầu sau: ${nextClassInfo.timeString}`}
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {daySchedule.length === 0 && dayNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
            <p className="font-medium text-lg mb-2">Không có lịch học hay ghi chú</p>
            {subjects.length === 0 && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-sm mb-4 text-center text-gray-500">Chưa có lịch học nào được tải về.<br/>Nếu bạn vừa đổi mật khẩu TLU, hãy nhấn biểu tượng <b>Tài khoản</b> ở góc trên bên phải để đăng nhập lại.</p>
                <Button 
                  onClick={() => onForceSync && onForceSync()} 
                  disabled={isSyncing}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                >
                  {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ lại lịch học'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {daySchedule.map((subject) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <SubjectCard subject={subject} />
              </motion.div>
            ))}

            {dayNotes.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ghi chú</h4>
                {dayNotes.map((note) => (
                  <Card key={note.id} className="bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/30">
                    <div className="flex gap-3">
                      <StickyNote className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => onEditNote(note)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDeleteNote(note.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
