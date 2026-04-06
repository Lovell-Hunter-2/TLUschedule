import { useState } from 'react';
import { Subject, PERIODS } from '../types';
import { Card } from './Card';
import { MapPin, User, Clock, Map as MapIcon, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SubjectCardProps {
  subject: Subject;
  onClick?: () => void;
}

export function SubjectCard({ subject, onClick }: SubjectCardProps) {
  const [showMap, setShowMap] = useState(false);
  const startPeriod = PERIODS.find(p => p.id === Math.min(...subject.periods));
  const endPeriod = PERIODS.find(p => p.id === Math.max(...subject.periods));

  return (
    <>
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
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMap(true);
                  }}
                  className="ml-auto p-1 bg-blue-50 text-blue-500 rounded-md hover:bg-blue-100 transition-colors shrink-0"
                  title="Xem bản đồ"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                </button>
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

      <AnimatePresence>
        {showMap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowMap(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  Sơ đồ trường - Phòng {subject.room}
                </h3>
                <button 
                  onClick={() => setShowMap(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 overflow-auto max-h-[70vh] bg-gray-100 flex items-center justify-center">
                <img 
                  src="/map_tlu.jpg" 
                  alt="Sơ đồ trường" 
                  className="w-full h-auto object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                Bạn có thể dùng 2 ngón tay để phóng to/thu nhỏ bản đồ
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
