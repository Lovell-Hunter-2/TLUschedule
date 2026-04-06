import { useState, useMemo } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Subject, PERIODS } from '../types';
import { Sparkles, Plus, Trash2, Save, FileText, Edit2, Search, Calendar as CalendarIcon } from 'lucide-react';
import { parseScheduleText } from '../services/geminiService';
import { syncToGoogleCalendar } from '../services/googleCalendarService';
import { motion, AnimatePresence } from 'motion/react';

interface UpdateViewProps {
  subjects: Subject[];
  onUpdate: (subjects: Subject[]) => void;
}

export function UpdateView({ subjects, onUpdate }: UpdateViewProps) {
  const [mode, setMode] = useState<'manual' | 'ai' | 'list' | 'edit'>('list');
  const [aiText, setAiText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingSubjects, setEditingSubjects] = useState<Subject[]>(subjects);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseScheduleText(aiText);
      const newSubjects = parsed.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        color: `border-l-${['blue', 'purple', 'green', 'orange', 'pink', 'indigo'][Math.floor(Math.random() * 6)]}-400`
      }));
      setEditingSubjects([...editingSubjects, ...newSubjects]);
      setMode('list');
      setAiText('');
    } catch (e) {
      alert('Lỗi khi phân tích lịch học. Vui lòng thử lại.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSyncCalendar = async () => {
    if (editingSubjects.length === 0) {
      alert('Không có môn học nào để đồng bộ!');
      return;
    }
    
    setIsSyncing(true);
    try {
      const count = await syncToGoogleCalendar(editingSubjects);
      alert(`Đã đồng bộ thành công ${count} lịch học/thi lên Google Calendar! Bạn sẽ nhận được thông báo trước 15 phút.`);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        alert('Bạn đã đóng cửa sổ đăng nhập. Vui lòng thử lại để cấp quyền cho Google Calendar.');
      } else {
        alert('Lỗi khi đồng bộ: ' + (error.message || 'Vui lòng thử lại sau.'));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const removeSubject = (id: string) => {
    setEditingSubjects(editingSubjects.filter(s => s.id !== id));
  };

  const saveAll = () => {
    onUpdate(editingSubjects);
    setMode('list');
  };

  const groupedSubjects = useMemo(() => {
    const filtered = editingSubjects.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const groups: Record<string, Subject[]> = {};
    filtered.forEach(s => {
      if (!groups[s.name]) groups[s.name] = [];
      groups[s.name].push(s);
    });
    return groups;
  }, [editingSubjects, searchTerm]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <Button 
          variant={mode === 'list' ? 'primary' : 'outline'} 
          onClick={() => setMode('list')}
          className="flex-1"
        >
          Danh sách
        </Button>
        <Button 
          variant={mode === 'ai' ? 'primary' : 'outline'} 
          onClick={() => setMode('ai')}
          className="flex-1 gap-2"
        >
          <Sparkles className="w-4 h-4" />
          AI Import
        </Button>
        <Button 
          variant={mode === 'manual' ? 'primary' : 'outline'} 
          onClick={() => setMode('manual')}
          className="flex-1 gap-2"
        >
          <Plus className="w-4 h-4" />
          Thủ công
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Dán lịch học vào đây
              </h3>
              <p className="text-sm text-gray-500 mb-4">AI sẽ tự động phân tích môn học, phòng, giảng viên và thời gian.</p>
              <textarea
                className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all text-sm"
                placeholder="Ví dụ: Thứ 2 Tiết 1-3 Phòng 202 Môn Toán cao cấp..."
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
              <Button 
                onClick={handleAiParse} 
                disabled={isParsing || !aiText.trim()}
                className="w-full mt-4 bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200"
              >
                {isParsing ? "Đang phân tích..." : "Phân tích bằng AI"}
              </Button>
            </Card>
          </motion.div>
        )}

        {mode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-gray-700">Môn học đã thêm ({editingSubjects.length})</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSyncCalendar} 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  disabled={isSyncing || editingSubjects.length === 0}
                >
                  <CalendarIcon className="w-4 h-4" />
                  {isSyncing ? "Đang đồng bộ..." : "Đồng bộ Google Calendar"}
                </Button>
                <Button onClick={saveAll} variant="primary" size="sm" className="gap-2">
                  <Save className="w-4 h-4" />
                  Lưu tất cả
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm tên môn học..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all text-sm shadow-sm"
              />
            </div>
            
            {Object.keys(groupedSubjects).length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                {searchTerm ? 'Không tìm thấy môn học nào' : 'Chưa có môn học nào'}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedSubjects).map(([name, subs]) => (
                  <Card key={name} className="p-4 flex flex-col gap-3 shadow-sm border-gray-100">
                    <h4 className="font-bold text-gray-800 text-lg">{name}</h4>
                    <div className="flex flex-col gap-2">
                      {subs.map((s) => {
                        const daysStr = s.daysOfWeek.map(d => d === 0 ? 'CN' : `T${d+1}`).join(', ');
                        const periodsStr = `Tiết ${Math.min(...s.periods)}-${Math.max(...s.periods)}`;
                        return (
                          <div key={s.id} className="flex items-center justify-between bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                            <div className="text-sm text-gray-600 font-medium">
                              {s.lecturer || 'Chưa có GV'} <span className="text-gray-300 mx-1">|</span> {daysStr}, {periodsStr} <span className="text-gray-300 mx-1">|</span> {s.room || 'Chưa có phòng'}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setSubjectToEdit(s);
                                  setMode('edit');
                                }}
                                className="p-1.5 h-auto text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeSubject(s.id)}
                                className="p-1.5 h-auto text-red-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {mode === 'manual' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ManualAddForm onAdd={(s) => {
              setEditingSubjects([...editingSubjects, s]);
              setMode('list');
            }} />
          </motion.div>
        )}

        {mode === 'edit' && subjectToEdit && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ManualAddForm 
              initialData={subjectToEdit}
              onAdd={(updatedSubject) => {
                setEditingSubjects(editingSubjects.map(s => s.id === updatedSubject.id ? updatedSubject : s));
                setMode('list');
                setSubjectToEdit(null);
              }} 
              onCancel={() => {
                setMode('list');
                setSubjectToEdit(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ManualAddForm({ onAdd, initialData, onCancel }: { onAdd: (s: Subject) => void, initialData?: Subject, onCancel?: () => void }) {
  const [name, setName] = useState(initialData?.name || '');
  const [room, setRoom] = useState(initialData?.room || '');
  const [lecturer, setLecturer] = useState(initialData?.lecturer || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [days, setDays] = useState<number[]>(initialData?.daysOfWeek || []);
  const [periods, setPeriods] = useState<number[]>(initialData?.periods || []);

  const toggleDay = (d: number) => {
    setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
  };

  const togglePeriod = (p: number) => {
    setPeriods(periods.includes(p) ? periods.filter(x => x !== p) : [...periods, p]);
  };

  const handleSubmit = () => {
    if (!name || !startDate || !endDate || days.length === 0 || periods.length === 0) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    onAdd({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      name,
      room,
      lecturer,
      startDate,
      endDate,
      daysOfWeek: days,
      periods: periods.sort((a, b) => a - b),
      color: initialData?.color || `border-l-${['blue', 'purple', 'green', 'orange', 'pink', 'indigo'][Math.floor(Math.random() * 6)]}-400`
    });
  };

  return (
    <Card className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg text-gray-800">{initialData ? 'Sửa môn học' : 'Thêm môn học thủ công'}</h3>
      </div>
      <Input label="Tên môn học" value={name} onChange={e => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Phòng học" value={room} onChange={e => setRoom(e.target.value)} />
        <Input label="Giảng viên" value={lecturer} onChange={e => setLecturer(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Ngày bắt đầu" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <Input label="Ngày kết thúc" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>
      
      <div>
        <label className="text-sm font-medium text-gray-600 mb-2 block">Thứ trong tuần</label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map(d => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={cn(
                "w-10 h-10 rounded-xl text-sm font-bold border transition-all",
                days.includes(d) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-100"
              )}
            >
              {d === 0 ? "CN" : `T${d + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 mb-2 block">Tiết học</label>
        <div className="grid grid-cols-5 gap-2">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => togglePeriod(p.id)}
              className={cn(
                "py-2 rounded-lg text-xs font-bold border transition-all",
                periods.includes(p.id) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-100"
              )}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">Hủy</Button>
        )}
        <Button onClick={handleSubmit} className="flex-1">{initialData ? 'Lưu thay đổi' : 'Thêm môn học'}</Button>
      </div>
    </Card>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
