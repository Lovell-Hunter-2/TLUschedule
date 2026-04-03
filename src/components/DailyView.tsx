import { useState, useMemo } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Subject, Note } from '../types';
import { SubjectCard } from './SubjectCard';
import { Card } from './Card';
import { StickyNote, Plus, Edit2, Trash2 } from 'lucide-react';
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
  
  const dates = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i - 2));
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

  const dayNotes = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return notes.filter(note => note.date === dateStr);
  }, [notes, selectedDate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
        {dates.map((date) => (
          <button
            key={date.toString()}
            onClick={() => setSelectedDate(date)}
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
