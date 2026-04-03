import { Subject, PERIODS } from '../types';
import { Card } from './Card';
import { MapPin, User, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface SubjectCardProps {
  subject: Subject;
  onClick?: () => void;
}

export function SubjectCard({ subject, onClick }: SubjectCardProps) {
  const startPeriod = PERIODS.find(p => p.id === Math.min(...subject.periods));
  const endPeriod = PERIODS.find(p => p.id === Math.max(...subject.periods));

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "relative overflow-hidden border-l-4",
        subject.color || "border-l-blue-400"
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-lg text-gray-800 leading-tight">{subject.name}</h4>
          <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-gray-100 rounded-full text-gray-500">
            <Clock className="w-3 h-3" />
            {startPeriod?.startTime} - {endPeriod?.endTime}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-1">
          {subject.room && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="w-4 h-4 text-red-300" />
              <span className="truncate">{subject.room}</span>
            </div>
          )}
          {subject.lecturer && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <User className="w-4 h-4 text-blue-300" />
              <span className="truncate">{subject.lecturer}</span>
            </div>
          )}
        </div>

        <div className="flex gap-1 mt-1">
          {subject.periods.map(p => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 bg-gray-50 border border-gray-100 rounded text-gray-400 font-mono">
              T{p}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
