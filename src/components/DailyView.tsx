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
}

export function DailyView({ subjects, notes, onAddNote, onEditNote, onDeleteNote }: DailyViewProps) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [now, setNow] = useState(new Date());

  // Cập nhật thời gian mỗi giây
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tạo 120 ngày: từ 30 ngày trước đến 90 ngày sau (đủ cho 1 kỳ học)
  const dates = useMemo(() => {
    return Array.from({ length: 120 }, (_, i) => addDays(startOfDay(new Date()), i - 30));
  }, []);

  // Tự động cuộn đến ngày được chọn (Hôm nay) khi vừa mở trang
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Tìm thẻ ngày đang được chọn
      const selectedElement = container.querySelector('[data-selected="true"]') as HTMLElement;
      if (selectedElement) {
        // Tính toán vị trí để cuộn thẻ đó ra giữa màn hình
        const scrollLeft = selectedElement.offsetLeft - container.offsetWidth / 2 + selectedElement.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
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

  // Logic tính toán môn học tiếp theo và đếm ngược
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
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 scroll-smooth"
      >
        {dates.map((date) => (
          <button
            key={date.toString()}
            data-selected={isSameDay(date, selectedDate)}
            onClick={(e) => {
              setSelectedDate(date);
              // Tự động cuộn ngày vừa bấm ra giữa màn hình cho đẹp
              const container = scrollContainerRef.current;
              if (container) {
                const element = e.currentTarget;
                const scrollLeft = element.offsetLeft - container.offsetWidth / 2 + element.offsetWidth / 2;
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
              }
            }}
            className={cn(
              "flex flex-col items-center min-w-[64px] p-3 rounded-2xl transition-all border",
              isSameDay(date, selectedDate)
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-105"
                : "bg-white text-gray-500 border-gray-100 hover:border-blue-200"
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
          <h3 className="font-bold text-xl text-gray-800">
            {isSameDay(selectedDate, new Date()) ? "Hôm nay" : format(selectedDate, 'EEEE, dd/MM', { locale: vi })}
          </h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onAddNote(selectedDate)}
            className="rounded-full gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Note
          </Button>
        </div>

        {/* Giao diện hiển thị đếm ngược */}
        {nextClassInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={cn(
              "p-4 border-l-4 shadow-md",
              nextClassInfo.status === 'ongoing' 
                ? "bg-green-50/50 border-l-green-500 border-green-100" 
                : "bg-blue-50/50 border-l-blue-500 border-blue-100"
            )}>
              <div className="flex items-start gap-3">
                {nextClassInfo.status === 'ongoing' ? (
                  <PlayCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5 animate-pulse" />
                ) : (
                  <Timer className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">
                    {nextClassInfo.status === 'ongoing' ? 'Đang học:' : 'Môn tiếp theo:'} {nextClassInfo.subject.name}
                  </h4>
                  <p className="text-sm font-medium text-gray-600 mt-1">
                    {nextClassInfo.room && <span className="mr-2">Phòng: {nextClassInfo.room}</span>}
                    <span className={cn(
                      "font-bold",
                      nextClassInfo.status === 'ongoing' ? "text-green-600" : "text-blue-600"
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
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
            <p className="font-medium">Không có lịch học hay ghi chú</p>
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
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest ml-1">Ghi chú</h4>
                {dayNotes.map((note) => (
                  <Card key={note.id} className="bg-yellow-50/50 border-yellow-100">
                    <div className="flex gap-3">
                      <StickyNote className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => onEditNote(note)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDeleteNote(note.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
