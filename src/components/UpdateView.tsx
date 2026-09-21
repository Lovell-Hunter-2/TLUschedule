import { syncTluWithChunks, fetchTluCaptcha } from "../lib/tlu-client";
import { useState, useMemo, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { cn } from '../lib/utils';
import { Card } from './Card';
import { Subject, PERIODS } from '../types';
import { auth } from '../firebase';
import { Sparkles, Plus, Trash2, Save, FileText, Edit2, Search, Calendar as CalendarIcon, RefreshCw, ShieldCheck, BookOpen } from 'lucide-react';
import { parseScheduleText } from '../services/geminiService';
import { syncToGoogleCalendar } from '../services/googleCalendarService';
import { CourseRegistrationView } from './CourseRegistrationView';
import { motion, AnimatePresence } from 'motion/react';

interface UpdateViewProps {
  subjects: Subject[];
  onUpdate: (subjects: Subject[]) => void;
  setHasUnsavedChanges?: (hasUnsaved: boolean) => void;
}

export function UpdateView({ subjects, onUpdate, setHasUnsavedChanges }: UpdateViewProps) {
  const [mode, setMode] = useState<'manual' | 'ai' | 'list' | 'edit' | 'sync' | 'registration' | 'google_calendar'>('list');
  const [aiText, setAiText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);

  // TLU Sync states
  const [portalType, setPortalType] = useState<'sinhvien1' | 'sv_tlu'>('sinhvien1');
  const [tluStudentCode, setTluStudentCode] = useState('');
  const [tluPassword, setTluPassword] = useState('');
  const [isTluSyncing, setIsTluSyncing] = useState(false);

  // CAPTCHA states for sv.tlu.edu.vn
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaImg, setCaptchaImg] = useState<string | null>(null);
  const [captchaSession, setCaptchaSession] = useState<string | null>(null);
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(false);

  const loadNewCaptcha = async () => {
    setIsCaptchaLoading(true);
    try {
      const data = await fetchTluCaptcha();
      setCaptchaImg(data.captchaDataUrl);
      setCaptchaSession(data.sessionState);
      setCaptchaCode('');
    } catch (err: any) {
      console.error("Captcha fetch error:", err);
      alert('Không tải được mã CAPTCHA từ TLU. Vui lòng bấm nút tròn để thử lại.');
    } finally {
      setIsCaptchaLoading(false);
    }
  };

  const handleTluSync = async () => {
    if (!tluStudentCode || !tluPassword) {
      alert('Vui lòng nhập mã sinh viên và mật khẩu');
      return;
    }
    if (portalType === 'sv_tlu' && !captchaCode.trim()) {
      alert('Vui lòng nhập mã xác nhận bảo vệ (CAPTCHA)');
      return;
    }
    
    setIsTluSyncing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const bodyParams: any = {
        studentCode: tluStudentCode,
        password: tluPassword,
        portal: portalType
      };

      if (portalType === 'sv_tlu') {
        bodyParams.captcha = captchaCode;
        bodyParams.sessionState = captchaSession;
      }

      const { json } = await syncTluWithChunks(bodyParams, idToken);

      const results: Subject[] = [];
      if (json.data && Array.isArray(json.data)) {
        json.data.forEach((item: any) => {
          if (item.timetables && Array.isArray(item.timetables)) {
            item.timetables.forEach((tb: any) => {
               // Parse standard CMC format
               const room = tb?.room?.name || tb?.room?.code || tb?.roomName || '';
               const lecturer = tb?.teacher?.displayName || tb?.teacher?.name || tb?.teacherName || '';
               const startStr = tb?.startHour?.name || tb?.startHour?.index || tb?.startHour || 1;
               const endStr = tb?.endHour?.name || tb?.endHour?.index || tb?.endHour || 1;
               const sPeriod = parseInt(String(startStr).replace(/\D/g, '')) || 1;
               const ePeriod = parseInt(String(endStr).replace(/\D/g, '')) || 1;
               
               const periods = [];
               for(let i = sPeriod; i <= ePeriod; i++) periods.push(i);
               
               const weekIndex = tb?.weekIndex || 2;
               const dayIndex = weekIndex === 1 ? 0 : weekIndex - 1; // 2(Monday)->1, 1(Sunday)->0
               
               let sDate = new Date().toISOString().split('T')[0];
               let eDate = new Date().toISOString().split('T')[0];
               try {
                 if (tb?.startDate) sDate = new Date(tb.startDate).toISOString().split('T')[0];
                 if (tb?.endDate) eDate = new Date(tb.endDate).toISOString().split('T')[0];
               } catch (e) {}

               results.push({
                 id: Math.random().toString(36).substr(2, 9),
                 name: item.subjectName,
                 code: item.subjectCode || '',
                 room,
                 lecturer,
                 startDate: sDate,
                 endDate: eDate,
                 daysOfWeek: [dayIndex],
                 periods,
                 color: `border-l-${['blue', 'purple', 'green', 'orange', 'pink', 'indigo'][Math.floor(Math.random() * 6)]}-400`,
                 semesterId: item.semesterId == null ? '' : String(item.semesterId),
                 semesterName: item.semesterName == null ? '' : String(item.semesterName)
               });
            });
          }
        });
      }
      
      if (results.length === 0) {
         alert('Đăng nhập thành công nhưng không tìm thấy lịch học nào trong dữ liệu trả về!');
         return;
      }
      
      setEditingSubjects([...editingSubjects, ...results]);
      setMode('list');
      setTluPassword('');
      setCaptchaCode('');
      alert(`Đã đồng bộ ${results.length} môn học từ TLU!`);

    } catch (e: any) {
       alert(e.message || 'Lỗi khi đồng bộ kết quả');
       if (portalType === 'sv_tlu') {
         loadNewCaptcha();
       }
    } finally {
      setIsTluSyncing(false);
    }
  };
  const [editingSubjects, setEditingSubjects] = useState<Subject[]>(subjects);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (setHasUnsavedChanges) {
      setHasUnsavedChanges(JSON.stringify(editingSubjects) !== JSON.stringify(subjects));
    }
  }, [editingSubjects, subjects, setHasUnsavedChanges]);

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
    
    const proceed = window.confirm(
      "LƯU Ý BẢO MẬT TỪ GOOGLE:\n\n" +
      "Màn hình tiếp theo có thể hiện cảnh báo đỏ 'Google chưa xác minh ứng dụng này'.\n\n" +
      "Cách xử lý để tiếp tục:\n" +
      "1. Bấm vào chữ 'Nâng cao' (Advanced) ở góc dưới bên trái.\n" +
      "2. Bấm 'Đi tới... (không an toàn)' (Go to... unsafe).\n\n" +
      "Bấm OK để tiếp tục đồng bộ!"
    );

    if (!proceed) return;

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
    setShowSuccessIndicator(true);
    setTimeout(() => setShowSuccessIndicator(false), 2000);
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
      <AnimatePresence>
        {showSuccessIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-8 rounded-3xl shadow-2xl flex flex-col items-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-200 dark:shadow-none">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Lưu thành công!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1.5 pt-0.5">
        <Button 
          variant={mode === 'list' ? 'primary' : 'outline'} 
          onClick={() => setMode('list')}
          className="shrink-0 rounded-2xl font-semibold px-4 h-10 text-xs sm:text-sm"
        >
          Danh sách
        </Button>
        <Button 
          variant={mode === 'sync' ? 'primary' : 'outline'} 
          onClick={() => setMode('sync')}
          className="shrink-0 rounded-2xl font-semibold px-4 h-10 text-xs sm:text-sm gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Đồng bộ TLU
        </Button>
        <Button 
          variant={mode === 'registration' ? 'primary' : 'outline'} 
          onClick={() => setMode('registration')}
          className="shrink-0 rounded-2xl font-semibold px-4 h-10 text-xs sm:text-sm gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Đăng ký môn học
        </Button>
        <Button 
          variant={mode === 'ai' ? 'primary' : 'outline'} 
          onClick={() => setMode('ai')}
          className="shrink-0 rounded-2xl font-semibold px-4 h-10 text-xs sm:text-sm gap-2"
        >
          <Sparkles className="w-4 h-4" />
          AI Import
        </Button>
        <Button 
          variant={mode === 'google_calendar' ? 'primary' : 'outline'} 
          onClick={() => setMode('google_calendar')}
          className="shrink-0 rounded-2xl font-semibold px-4 h-10 text-xs sm:text-sm gap-2"
        >
          <CalendarIcon className="w-4 h-4" />
          Google Calendar
        </Button>
        <Button 
          variant={mode === 'manual' ? 'primary' : 'outline'} 
          onClick={() => setMode('manual')}
          className="shrink-0 rounded-2xl font-semibold px-4 h-10 text-xs sm:text-sm gap-2"
        >
          <Plus className="w-4 h-4" />
          + Thủ công
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'sync' && (
          <motion.div
            key="sync"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2 dark:text-gray-100">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                Đồng bộ trực tiếp từ web trường
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Đăng nhập bằng tài khoản sinh viên Thủy Lợi để tự động lấy toàn bộ môn học và thời khóa biểu.
              </p>

              {/* Portal Selector */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                  Chọn cổng sinh viên
                </label>
                <div className="grid grid-cols-2 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setPortalType('sinhvien1')}
                    className={cn(
                      "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center",
                      portalType === 'sinhvien1'
                        ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <div>Khóa cũ (K67 trở về trước)</div>
                    <span className="text-[10px] font-normal opacity-70 block">sinhvien1.tlu.edu.vn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('sv_tlu');
                      if (!captchaImg) loadNewCaptcha();
                    }}
                    className={cn(
                      "py-2 px-2 text-xs font-bold rounded-lg transition-all text-center relative",
                      portalType === 'sv_tlu'
                        ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <div>Khóa mới (K68 trở đi)</div>
                    <span className="text-[10px] font-normal opacity-70 block">sv.tlu.edu.vn</span>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 mb-5">
                <Input 
                  label="Mã sinh viên" 
                  value={tluStudentCode} 
                  onChange={e => setTluStudentCode(e.target.value)} 
                  placeholder="Ví dụ: 2351060123"
                />
                <Input 
                  label="Mật khẩu" 
                  type="password"
                  value={tluPassword} 
                  onChange={e => setTluPassword(e.target.value)} 
                  placeholder="Nhập mật khẩu trang sinh viên"
                />

                {/* CAPTCHA section for Khóa mới */}
                {portalType === 'sv_tlu' && (
                  <div className="flex flex-col gap-2 p-3.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Mã xác nhận bảo vệ
                      </label>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400">
                        Nhập 4 chữ cái trong ảnh
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Image container */}
                      <div className="relative h-12 w-32 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {isCaptchaLoading ? (
                          <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                        ) : captchaImg ? (
                          <img 
                            src={captchaImg} 
                            alt="Mã CAPTCHA" 
                            className="h-full w-full object-contain select-none"
                          />
                        ) : (
                          <span className="text-[11px] text-gray-400">Đang tải...</span>
                        )}
                      </div>

                      {/* Circular refresh button */}
                      <button
                        type="button"
                        onClick={loadNewCaptcha}
                        disabled={isCaptchaLoading}
                        title="Bấm để đổi mã khác nếu chữ khó nhìn"
                        className="w-11 h-11 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm"
                      >
                        <RefreshCw className={cn("w-4 h-4 transition-transform", isCaptchaLoading && "animate-spin text-blue-500")} />
                      </button>

                      {/* Input field */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          maxLength={4}
                          autoComplete="off"
                          value={captchaCode}
                          onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                          placeholder="MÃ"
                          className="w-full h-12 px-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-center font-mono font-black text-lg tracking-widest uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Bấm nút tròn để đổi mã khác nếu chữ khó nhìn.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-800 dark:text-blue-200 rounded-lg mb-4 leading-relaxed border border-blue-100 dark:border-blue-900/50">
                <strong>🔒 Lưu ý bảo mật:</strong> Mật khẩu của bạn được gửi mã hóa trực tiếp đến máy chủ trường Đại học Thủy Lợi để đồng bộ, chúng tôi tuyệt đối không lưu trữ tài khoản/mật khẩu dạng văn bản thô.
              </div>

              <Button 
                onClick={handleTluSync} 
                disabled={isTluSyncing || !tluStudentCode || !tluPassword}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
              >
                {isTluSyncing ? "Đang đồng bộ..." : "Đăng nhập và Đồng bộ"}
              </Button>
            </Card>
          </motion.div>
        )}

        {mode === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2 dark:text-gray-100">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Dán lịch học vào đây
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">AI sẽ tự động phân tích môn học, phòng, giảng viên và thời gian.</p>
              <textarea
                className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:border-purple-400 dark:focus:border-purple-600 outline-none transition-all text-sm dark:text-gray-100"
                placeholder="Ví dụ: Thứ 2 Tiết 1-3 Phòng 202 Môn Toán cao cấp..."
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
              <Button 
                onClick={handleAiParse} 
                disabled={isParsing || !aiText.trim()}
                className="w-full mt-4 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                {isParsing ? "Đang phân tích..." : "Phân tích bằng AI"}
              </Button>
            </Card>
          </motion.div>
        )}

        {mode === 'registration' && (
          <motion.div
            key="registration"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <CourseRegistrationView 
              currentSubjects={editingSubjects} 
              onAddSubject={(newSub) => {
                setEditingSubjects(prev => [...prev, newSub]);
                setHasUnsavedChanges?.(true);
              }} 
            />
          </motion.div>
        )}

        {mode === 'google_calendar' && (
          <motion.div
            key="google_calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    Đồng bộ Google Calendar
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tự động tạo sự kiện lịch học trên Google Calendar kèm nhắc nhở trước giờ vào lớp
                  </p>
                </div>
              </div>

              <div className="my-4 p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/80 text-sm space-y-2.5 text-gray-600 dark:text-gray-300">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Môn học sẵn sàng đồng bộ:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{editingSubjects.length} môn</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Thông báo nhắc nhở tự động:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Trước giờ học 15 phút</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Nền tảng hỗ trợ:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Google Calendar App & Web</span>
                </div>
              </div>

              <Button
                onClick={handleSyncCalendar}
                disabled={isSyncing || editingSubjects.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 shadow-xs"
              >
                <CalendarIcon className="w-4 h-4" />
                {isSyncing ? "Đang đồng bộ sang Google Calendar..." : "Đồng bộ ngay sang Google Calendar"}
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">
                Môn học đã thêm ({editingSubjects.length})
              </h3>
              <Button onClick={saveAll} variant="primary" size="sm" className="gap-2 rounded-xl">
                <Save className="w-4 h-4" />
                Lưu tất cả
              </Button>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm tên môn học..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-600 outline-none transition-all text-sm shadow-sm dark:text-gray-100"
              />
            </div>
            
            {Object.keys(groupedSubjects).length === 0 ? (
              <div className="py-12 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                {searchTerm ? 'Không tìm thấy môn học nào' : 'Chưa có môn học nào'}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedSubjects).map(([name, subs]) => (
                  <Card key={name} className="p-4 flex flex-col gap-3 shadow-sm border-gray-100 dark:border-gray-800">
                    <h4 className="font-bold text-gray-800 dark:text-gray-100 text-lg">{name}</h4>
                    <div className="flex flex-col gap-2">
                      {subs.map((s) => {
                        const daysStr = s.daysOfWeek.map(d => d === 0 ? 'CN' : `T${d+1}`).join(', ');
                        const periodsStr = `Tiết ${Math.min(...s.periods)}-${Math.max(...s.periods)}`;
                        return (
                          <div key={s.id} className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/80 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                              {s.lecturer || 'Chưa có GV'} <span className="text-gray-300 dark:text-gray-600 mx-1">|</span> {daysStr}, {periodsStr} <span className="text-gray-300 dark:text-gray-600 mx-1">|</span> {s.room || 'Chưa có phòng'}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setSubjectToEdit(s);
                                  setMode('edit');
                                }}
                                className="p-1.5 h-auto text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeSubject(s.id)}
                                className="p-1.5 h-auto text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
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
        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{initialData ? 'Sửa môn học' : 'Thêm môn học thủ công'}</h3>
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
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Thứ trong tuần</label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map(d => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={cn(
                "w-10 h-10 rounded-xl text-sm font-bold border transition-all",
                days.includes(d) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700"
              )}
            >
              {d === 0 ? "CN" : `T${d + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">Tiết học</label>
        <div className="grid grid-cols-5 gap-2">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => togglePeriod(p.id)}
              className={cn(
                "py-2 rounded-lg text-xs font-bold border transition-all",
                periods.includes(p.id) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700"
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

