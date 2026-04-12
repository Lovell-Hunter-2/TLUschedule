import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Subject, Note, PERIODS } from '../types';
import { ChevronLeft, ChevronRight, StickyNote, Edit2, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'motion/react';

interface WeeklyViewProps {
  subjects: Subject[];
  notes: Note[];
  onAddNote: (date: Date) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (noteId: string) => void;
}

export function WeeklyView({ subjects, notes, onAddNote, onEditNote, onDeleteNote }: WeeklyViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
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
        <h3 className="font-bold text-lg text-gray-700">
          {format(weekStart, 'dd/MM', { locale: vi })} - {format(weekDays[6], 'dd/MM/yyyy', { locale: vi })}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek} className="p-2 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek} className="p-2 rounded-full">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-50 bg-gray-50/50">
            <div className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Tiết</div>
            {weekDays.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayNotes = weekNotes[dayStr] || [];
              
              return (
                <div 
                  key={day.toString()} 
                  className={cn(
                    "p-3 text-center border-l border-gray-100 flex flex-col",
                    isSameDay(day, new Date()) && "bg-blue-50/50"
                  )}
                >
                  <div className="text-[10px] font-bold text-gray-400 uppercase">{format(day, 'EEEE', { locale: vi })}</div>
                  <div className={cn(
                    "text-sm font-bold",
                    isSameDay(day, new Date()) ? "text-blue-600" : "text-gray-700"
                  )}>
                    {format(day, 'dd/MM')}
                  </div>
                  <button 
                    onClick={() => onAddNote(day)}
                    className="mt-1 text-[10px] text-blue-400 hover:text-blue-600 font-bold"
                  >
                    + Note
                  </button>
                  
                  {dayNotes.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {dayNotes.map(note => (
                        <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded p-1 text-left relative group">
                          <div className="flex items-start gap-1">
                            <StickyNote className="w-3 h-3 text-yellow-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-gray-700 line-clamp-2">{note.content}</p>
                          </div>
                          <div className="absolute right-0 top-0 bottom-0 bg-yellow-50/90 hidden group-hover:flex flex-col justify-center px-1 gap-1">
                            <button onClick={() => onEditNote(note)} className="text-blue-500 hover:text-blue-700">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => onDeleteNote(note.id)} className="text-red-500 hover:text-red-700">
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
              <div key={period.id} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-50 last:border-0 h-12">
                <div className="flex flex-col items-center justify-center bg-gray-50/30 border-r border-gray-100">
                  <span className="text-xs font-bold text-gray-500">Tiết {period.id}</span>
                  <span className="text-[9px] text-gray-400">{period.startTime}</span>
                </div>
                {weekDays.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const subjectsAtPeriod = weekSchedule[dayStr]?.[period.id] || [];
                  
                  return (
                    <div key={day.toString()} className="border-l border-gray-100 p-0.5 relative group">
                      {subjectsAtPeriod.map((s, i) => (
                        <div 
                          key={s.id + i}
                          className={cn(
                            "absolute inset-0.5 rounded-md p-1 text-[9px] font-bold leading-tight overflow-hidden shadow-sm border",
                            s.color || "bg-blue-100 text-blue-700 border-blue-200"
                          )}
                        >
                          <div className="line-clamp-2">{s.name}</div>
                          {s.room && (
                            <div className="text-[8px] font-medium opacity-80 mt-0.5 truncate">
                               {s.room}
                            </div>
                          )}
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
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
