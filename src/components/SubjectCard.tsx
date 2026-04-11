import { useState, useRef, useEffect } from 'react';
import { Subject, PERIODS } from '../types';
import { Card } from './Card';
import { MapPin, User, Clock, Map as MapIcon, X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const BUILDING_PINS: Record<string, { top: string, left: string }> = {
  'A4': { top: '43%', left: '35%' },
  'A1': { top: '55%', left: '39.5%' },
  'T45': { top: '43%', left: '35%' },
  'THƯ VIỆN': { top: '46.5%', left: '51%' },
  'K1': { top: '58%', left: '58%' },
  'C1': { top: '60%', left: '51%' },
  'A5': { top: '79%', left: '46%' },
  'B1': { top: '80%', left: '39.5%' },
  'B5': { top: '80%', left: '43%' },
  'A2': { top: '70%', left: '39.5%' },
  'T35': { top: '70%', left: '35.5%' },
  'A3': { top: '80%', left: '34%' },
  'KTX4': { top: '73.5%', left: '52%' },
  'KTX3': { top: '79.5%', left: '52%' },
  'KTX2': { top: '85.5%', left: '52%' },
};

const getBuildingFromRoom = (room?: string) => {
  if (!room) return null;
  const upperRoom = room.toUpperCase();
  const buildings = ['A4', 'A1', 'T45', 'THƯ VIỆN', 'K1', 'C1', 'A5', 'B1', 'B5', 'A2', 'T35', 'A3'];
  for (const b of buildings) {
    if (upperRoom.includes(b)) return b;
  }
  if (upperRoom.includes('KTX NHÀ 4') || upperRoom.includes('KTX NHA 4')) return 'KTX4';
  if (upperRoom.includes('KTX NHÀ 3') || upperRoom.includes('KTX NHA 3')) return 'KTX3';
  if (upperRoom.includes('KTX NHÀ 2') || upperRoom.includes('KTX NHA 2')) return 'KTX2';
  return null;
};

interface SubjectCardProps {
  subject: Subject;
  onClick?: () => void;
}

export function SubjectCard({ subject, onClick }: SubjectCardProps) {
  const [showMap, setShowMap] = useState(false);
  const transformRef = useRef<any>(null);
  const startPeriod = PERIODS.find(p => p.id === Math.min(...subject.periods));
  const endPeriod = PERIODS.find(p => p.id === Math.max(...subject.periods));
  const targetBuilding = getBuildingFromRoom(subject.room);

  useEffect(() => {
    if (showMap && targetBuilding && BUILDING_PINS[targetBuilding]) {
      const timer = setTimeout(() => {
        if (transformRef.current) {
          transformRef.current.zoomToElement("target-pin", 2.5, 800);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showMap, targetBuilding]);

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
              className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  Sơ đồ trường - Phòng {subject.room} {targetBuilding ? `(Tòa ${targetBuilding})` : ''}
                </h3>
                <button 
                  onClick={() => setShowMap(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="relative flex-1 bg-gray-100 overflow-hidden flex items-center justify-center min-h-[50vh]">
                <TransformWrapper
                  ref={transformRef}
                  initialScale={1}
                  minScale={0.5}
                  maxScale={4}
                  centerOnInit={true}
                  wheel={{ step: 0.1 }}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm border border-gray-200">
                        <button onClick={() => zoomIn()} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Phóng to">
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button onClick={() => zoomOut()} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Thu nhỏ">
                          <ZoomOut className="w-5 h-5" />
                        </button>
                        <button onClick={() => resetTransform()} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Khôi phục">
                          <Maximize className="w-5 h-5" />
                        </button>
                      </div>
                      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                        <div className="relative inline-block max-w-full max-h-full">
                          <img 
                            src="/map_tlu.jpg" 
                            alt="Sơ đồ trường" 
                            className="block max-w-full max-h-[70vh] w-auto h-auto object-contain"
                            referrerPolicy="no-referrer"
                            draggable={false}
                          />
                          {targetBuilding && BUILDING_PINS[targetBuilding] && (
                            <div
                              id="target-pin"
                              className="absolute z-20"
                              style={{
                                top: BUILDING_PINS[targetBuilding].top,
                                left: BUILDING_PINS[targetBuilding].left,
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              <div className="relative flex items-center justify-center w-8 h-8">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white shadow-md"></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              </div>

              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-100 shrink-0">
                Dùng 2 ngón tay, lăn chuột hoặc nút bấm để phóng to/thu nhỏ
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
