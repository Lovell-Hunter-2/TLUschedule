import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Subject, Note, PERIODS } from '../types';
import { ChevronLeft, ChevronRight, StickyNote, Edit2, Trash2, BookOpen } from 'lucide-react';
import { Button } from './Button';
import { cn, getSubjectColor } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface WeeklyViewProps {
  subjects: Subject[];
  notes: Note[];
  onAddNote: (date: Date) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (noteId: string) => void;
  isSyncing?: boolean;
  onForceSync?: () => void;
}

export function WeeklyView({ subjects, notes, onAddNote, onEditNote, onDeleteNote, isSyncing, onForceSync }: WeeklyViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeSubject, setActiveSubject] = useState<{subject: Subject, x: number, y: number} | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (activeSubject) {
      timeoutId = setTimeout(() => {
        setActiveSubject(null);
      }, 5000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeSubject]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekSchedule = useMemo(() => {
    const schedule: Record<string, Record<number, Subject[]>> = {};
    
    weekDays.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      schedule[dayStr] = {};
      
      subjects.forEach(subject => {
        if (dayStr >= subject.startDate && dayStr <= subject.endDate && subject.daysOfWeek.includes(day.getDay())) {
          subject.periods.forEach(p => {
            if (!schedule[dayStr][p]) schedule[dayStr][p] = [];
            schedule[dayStr][p].push(subject);
          });
        }
      });
    });
    
    return schedule;
  }, [subjects, weekDays]);

  const weekNotes = useMemo(() => {
    const notesByDay: Record<string, Note[]> = {};
    weekDays.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      notesByDay[dayStr] = notes.filter(n => n.date === dayStr);
    });
    return notesByDay;
  }, [notes, weekDays]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));

  return (
    <div className="flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200">
          {format(weekStart, 'dd/MM', { locale: vi })} - {format(weekDays[6], 'dd/MM/yyyy', { locale: vi })}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek} className="p-2 rounded-full dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek} className="p-2 rounded-full dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {subjects.length === 0 && (
        <div className="bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500 text-center sm:text-left">
            Chưa có lịch học nào. Nếu bạn vừa đổi mật khẩu TLU, hãy nhấn biểu tượng <b>Tài khoản</b> ở góc trên bên phải để đăng nhập lại.
          </p>
          <Button 
            onClick={() => onForceSync && onForceSync()} 
            disabled={isSyncing}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ lại'}
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="w-full">
          <div className="grid grid-cols-[30px_repeat(7,1fr)] sm:grid-cols-[70px_repeat(7,1fr)] md:grid-cols-[80px_repeat(7,1fr)] border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="p-1 sm:p-3 text-[9px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center justify-center text-center">Tiết</div>
            {weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayNotes = weekNotes[dayStr] || [];
              
              return (
                <div 
                  key={day.toString()} 
                  className={cn(
                    "p-1 sm:p-3 text-center border-l border-gray-100 dark:border-gray-700 flex flex-col",
                    isSameDay(day, new Date()) && "bg-blue-50/50 dark:bg-blue-900/20"
                  )}
                >
                  <div className="text-[8px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase hidden sm:block">{format(day, 'EEEE', { locale: vi })}</div>
                  <div className="text-[8px] sm:text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase sm:hidden">{format(day, 'E', { locale: vi }).replace('Th ', 'T')}</div>
                  <div className={cn(
                    "text-[10px] sm:text-sm font-bold",
                    isSameDay(day, new Date()) ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {format(day, 'dd/MM')}
                  </div>
                  <button 
                    onClick={() => onAddNote(day)}
                    className="mt-1 text-[10px] text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-bold"
                  >
                    + Note
                  </button>
                  
                  {dayNotes.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {dayNotes.map(note => (
                        <div key={note.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded p-1 text-left relative group">
                          <div className="flex items-start gap-1">
                            <StickyNote className="w-3 h-3 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-gray-700 dark:text-gray-300 line-clamp-2">{note.content}</p>
                          </div>
                          <div className="absolute right-0 top-0 bottom-0 bg-yellow-50/90 dark:bg-gray-800/90 hidden group-hover:flex flex-col justify-center px-1 gap-1">
                            <button onClick={() => onEditNote(note)} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDeleteNote(note.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative">
            {PERIODS.map((period, idx) => (
              <div key={period.id} className="grid grid-cols-[30px_repeat(7,1fr)] sm:grid-cols-[70px_repeat(7,1fr)] md:grid-cols-[80px_repeat(7,1fr)] border-b border-gray-50 dark:border-gray-700 last:border-0 h-14 sm:h-12">
                <div className="flex flex-col items-center justify-center bg-gray-50/30 dark:bg-gray-900/30 border-r border-gray-100 dark:border-gray-700 p-0.5">
                  <span className="text-[9px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">{period.id}</span>
                  <span className="text-[7px] sm:text-[9px] text-gray-400 dark:text-gray-500 hidden sm:block">{period.startTime}</span>
                </div>
                {weekDays.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const subjectsAtPeriod = weekSchedule[dayStr]?.[period.id] || [];
                  
                  return (
                    <div key={day.toString()} className="border-l border-gray-100 dark:border-gray-700 p-0.5 relative group">
                      {subjectsAtPeriod.map((s, i) => (
                        <div 
                          key={s.id + i}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveSubject({ subject: s, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                          }}
                          className={cn(
                            "absolute inset-[1px] sm:inset-0.5 rounded-sm sm:rounded-md p-0.5 sm:p-1 text-[7.5px] sm:text-[9px] font-bold leading-[1.1] sm:leading-tight overflow-hidden shadow-sm border cursor-pointer hover:opacity-90 flex flex-col justify-center items-center text-center",
                            getSubjectColor(s.name)
                          )}
                        >
                          <span className="line-clamp-3 sm:line-clamp-2 w-full">{s.room && <span className="block sm:inline">{s.room}</span>} <span className="hidden sm:inline">-</span> {s.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {activeSubject && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center sm:items-start sm:justify-start"
          onClick={() => setActiveSubject(null)}
          onTouchStart={() => setActiveSubject(null)}
          onScroll={() => setActiveSubject(null)}
        >
          <div 
            className="fixed bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl p-4 w-[240px] z-50 border border-gray-700/50 animate-in fade-in zoom-in-95 duration-200"
            style={{ 
              // On mobile center it, on desktop place near click
              ...(window.innerWidth < 640 ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              } : {
                top: Math.min(activeSubject.y, window.innerHeight - 150), 
                left: Math.min(activeSubject.x, window.innerWidth - 260) 
              })
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">{activeSubject.subject.name}</h4>
                <p className="text-xs text-blue-400 font-medium mt-0.5">{activeSubject.subject.room}</p>
              </div>
            </div>
            
            <div className="space-y-1.5 mt-4 text-xs text-gray-300">
              <p>Mã môn: <span className="font-medium text-white">{activeSubject.subject.id}</span></p>
              {activeSubject.subject.teacher && <p>Giảng viên: <span className="font-medium text-white">{activeSubject.subject.teacher}</span></p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

