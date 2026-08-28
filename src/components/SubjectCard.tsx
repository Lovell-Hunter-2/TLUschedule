import { useState, useRef, useEffect } from 'react';
import { Subject, PERIODS } from '../types';
import { Card } from './Card';
import { MapPin, User, Clock, Map as MapIcon, X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { cn, getSubjectColor } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { getWeatherIcon, getWeatherText } from './WeatherWidget';

const BUILDING_PINS: Record<string, { top: string, left: string }> = {
  'A4': { top: '39%', left: '12.3%' },
  'A1': { top: '55%', left: '22%' },
  'T45': { top: '37%', left: '33%' },
  'THƯ VIỆN': { top: '37%', left: '48%' },
  'K1': { top: '60%', left: '62%' },
  'C1': { top: '60%', left: '51%' },
  'C5': { top: '80%', left: '76.5%' },
  'A5': { top: '80%', left: '42.5%' },
  'B1': { top: '82%', left: '22.5%' },
  'B5': { top: '82%', left: '33%' },
  'A2': { top: '77%', left: '9.2%' },
  'T35': { top: '77%', left: '16.5%' },
  'A3': { top: '82%', left: '9.2%' },
  'KTX4': { top: '73.5%', left: '52%' },
  'KTX3': { top: '79.5%', left: '52%' },
  'KTX2': { top: '85.5%', left: '52%' },
  'SÂN BÓNG ĐÁ': { top: '60%', left: '79%' },
  'SÂN BÓNG CHUYỀN': { top: '60%', left: '75%' },
  'SÂN BÓNG RỔ': { top: '60%', left: '90%' },
  'SÂN PICKLEBALL': { top: '80%', left: '85%' },
  'SÂN TENNIS': { top: '95%', left: '83%' },
  'BỂ BƠI': { top: '95%', left: '88%' },
  'NHÀ GDTC': { top: '90%', left: '95%' }
};

const getBuildingFromRoom = (room?: string) => {
  if (!room) return null;
  const upperRoom = room.toUpperCase();

  // Khớp các địa điểm thể thao, KTX (kiểm tra trước để ưu tiên)
  if (upperRoom.includes('SÂN BÓNG ĐÁ') || upperRoom.includes('SAN BONG DA') || upperRoom === 'SÂN BÓNG') return 'SÂN BÓNG ĐÁ';
  if (upperRoom.includes('BÓNG CHUYỀN') || upperRoom.includes('BONG CHUYEN')) return 'SÂN BÓNG CHUYỀN';
  if (upperRoom.includes('BÓNG RỔ') || upperRoom.includes('BONG RO')) return 'SÂN BÓNG RỔ';
  if (upperRoom.includes('PICKLEBALL')) return 'SÂN PICKLEBALL';
  if (upperRoom.includes('TENNIS')) return 'SÂN TENNIS';
  if (upperRoom.includes('BỂ BƠI') || upperRoom.includes('BE BOI')) return 'BỂ BƠI';
  if (upperRoom.includes('GDTC') || upperRoom.includes('GIÁO DỤC THỂ CHẤT') || upperRoom.includes('GIAO DUC THE CHAT') || upperRoom.includes('CẦU LÔNG') || upperRoom.includes('CAU LONG')) return 'NHÀ GDTC';

  if (upperRoom.includes('KTX NHÀ 4') || upperRoom.includes('KTX NHA 4')) return 'KTX4';
  if (upperRoom.includes('KTX NHÀ 3') || upperRoom.includes('KTX NHA 3')) return 'KTX3';
  if (upperRoom.includes('KTX NHÀ 2') || upperRoom.includes('KTX NHA 2')) return 'KTX2';

  // Khớp các tòa nhà chính
  const buildings = ['A4', 'A1', 'T45', 'THƯ VIỆN', 'K1', 'C1', 'C5', 'A5', 'B1', 'B5', 'A2', 'T35', 'A3'];
  
  // Pass 1: Tìm bằng RegEx để bóc tách chính xác (VD: "305-A4", "P. A4") 
  // Tránh việc "B15" bị nhận nhầm thành "B1"
  for (const b of buildings) {
    const regex = new RegExp(`(?:^|[^A-Z0-9])${b}(?:[^A-Z0-9]|$)`);
    if (regex.test(upperRoom)) return b;
  }
  
  // Pass 2: Fallback cho các trường hợp viết dính liền ("305A4")
  for (const b of buildings) {
    if (upperRoom.includes(b)) return b;
  }

  return null;
};

interface SubjectCardProps {
  subject: Subject;
  onClick?: () => void;
  weather?: { code: number; maxTemp: number; minTemp: number };
}

export function SubjectCard({ subject, onClick, weather }: SubjectCardProps) {
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
          getSubjectColor(subject.name)
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-lg leading-tight">{subject.name}</h4>
            <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-300">
              <Clock className="w-3 h-3" />
              {startPeriod?.startTime} - {endPeriod?.endTime}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
            {subject.room && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <MapPin className="w-4 h-4 text-red-300 dark:text-red-400 shrink-0" />
                <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">{subject.room}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMap(true);
                  }}
                  className="p-2 sm:p-2 ml-1.5 bg-blue-100/50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm hover:bg-blue-200/60 dark:hover:bg-blue-900/60 hover:scale-105 active:scale-95 transition-all shrink-0"
                  title="Xem bản đồ"
                >
                  <MapIcon className="w-5 h-5 sm:w-5 sm:h-5" />
                </button>
              </div>
            )}
            
            <div className="flex items-start sm:items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 flex-1">
              {subject.lecturer && (
                <>
                  <User className="w-4 h-4 text-blue-300 dark:text-blue-400 shrink-0 mt-[3px] sm:mt-0" />
                  <span className="leading-tight">{subject.lecturer}</span>
                </>
              )}
              {weather && (
                <div className="hidden sm:flex items-center gap-1.5 ml-auto pl-2 border-l border-gray-200 dark:border-gray-700 text-xs shrink-0" title={getWeatherText(weather.code)}>
                  {getWeatherIcon(weather.code)}
                  <span className="font-medium">{weather.minTemp}°-{weather.maxTemp}°C</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between mt-1.5 gap-2">
            <div className="flex gap-1">
              {subject.periods.map(p => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded text-gray-400 dark:text-gray-300 font-mono">
                  T{p}
                </span>
              ))}
            </div>
            {weather && (
              <div className="flex sm:hidden items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0" title={getWeatherText(weather.code)}>
                {getWeatherIcon(weather.code)}
                <span className="font-medium">{weather.minTemp}°-{weather.maxTemp}°C</span>
              </div>
            )}
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
              className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  Sơ đồ trường - Phòng {subject.room} {targetBuilding ? `(Tòa ${targetBuilding})` : ''}
                </h3>
                <button 
                  onClick={() => setShowMap(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="relative flex-1 bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center min-h-[50vh]">
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
                      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <button onClick={() => zoomIn()} className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Phóng to">
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button onClick={() => zoomOut()} className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Thu nhỏ">
                          <ZoomOut className="w-5 h-5" />
                        </button>
                        <button onClick={() => resetTransform()} className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Khôi phục">
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

              <div className="p-3 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shrink-0">
                Dùng 2 ngón tay, lăn chuột hoặc nút bấm để phóng to/thu nhỏ
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
