import { syncTluWithChunks, fetchTluCaptcha } from "../lib/tlu-client";
import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Users, Key, CheckCircle2, ChevronRight, RefreshCw, Trash2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence, useAnimation, PanInfo } from 'motion/react';
import { collection, setDoc, doc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace } from '../types';
import { cn } from '../lib/utils';

interface WorkspaceScreenProps {
  userId: string;
  onWorkspaceSelect: (workspace: Workspace) => void;
}

const SwipeableWorkspace = ({ workspace, onSelect, onDelete, isSyncing }: any) => {
  const controls = useAnimation();
  
  const handleDragEnd = (event: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset < -50 || velocity < -500) {
      controls.start({ x: -70 });
    } else {
      controls.start({ x: 0 });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-red-500">
      <div className="absolute inset-y-0 right-0 w-[70px] flex items-center justify-center">
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(workspace); }}
          className="w-full h-full flex flex-col items-center justify-center text-white hover:bg-red-600 transition-colors"
        >
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">Xóa</span>
        </button>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -70, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative z-10 w-full"
      >
        <Card 
          className="overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-all hover:border-blue-300 hover:shadow-md cursor-pointer"
          onClick={() => onSelect(workspace)}
        >
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">{workspace.name}</h3>
                {workspace.portal === 'sv_tlu' ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    Khóa mới K68+
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    Khóa cũ
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tiếp tục xem và quản lý lịch học</p>
            </div>
            {isSyncing ? (
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export function WorkspaceScreen({ userId, onWorkspaceSelect }: WorkspaceScreenProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  
  // Form states
  const [portalType, setPortalType] = useState<'sinhvien1' | 'sv_tlu'>('sinhvien1');
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncingWorkspaceId, setSyncingWorkspaceId] = useState<string | null>(null);

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
      setError('Không tải được mã CAPTCHA từ TLU. Vui lòng bấm nút tròn để tải lại.');
    } finally {
      setIsCaptchaLoading(false);
    }
  };

  useEffect(() => {
    const workspacesRef = collection(db, 'users', userId, 'workspaces');
    const unsubscribe = onSnapshot(workspacesRef, (snapshot) => {
      const loadedWorkspaces: Workspace[] = [];
      snapshot.forEach((doc) => {
        loadedWorkspaces.push(doc.data() as Workspace);
      });
      setWorkspaces(loadedWorkspaces);

      const savedWorkspaceId = localStorage.getItem('savedWorkspaceId');

      if (savedWorkspaceId) {
        const savedWorkspace = loadedWorkspaces.find(w => w.id === savedWorkspaceId);
        if (savedWorkspace) {
          onWorkspaceSelect(savedWorkspace);
          return;
        }
      } else if (loadedWorkspaces.length === 1) {
        // Auto select if there's exactly 1 workspace and no saved workspace ID
        const onlyWorkspace = loadedWorkspaces[0];
        localStorage.setItem('savedWorkspaceId', onlyWorkspace.id);
        onWorkspaceSelect(onlyWorkspace);
        return;
      }
    });

    return () => unsubscribe();
  }, [userId, onWorkspaceSelect]);

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa tài khoản ${workspace.name} không?`)) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'workspaces', workspace.id));
        if (localStorage.getItem('savedWorkspaceId') === workspace.id) {
          localStorage.removeItem('savedWorkspaceId');
        }
      } catch (err) {
        console.error("Lỗi khi xóa:", err);
        alert('Có lỗi xảy ra khi xóa!');
      }
    }
  };

  const handleSelectWorkspace = async (workspace: Workspace) => {
    setSyncingWorkspaceId(workspace.id);
    
    // If workspace is from sv_tlu, enter directly (schedule is already saved in Firestore)
    if (workspace.portal === 'sv_tlu') {
      localStorage.setItem('savedWorkspaceId', workspace.id);
      onWorkspaceSelect(workspace);
      setSyncingWorkspaceId(null);
      return;
    }

    // Fetch password from secure subcollection for sinhvien1
    let secretData: any = null;
    try {
        const { getDoc } = await import('firebase/firestore');
        const secretSnap = await getDoc(doc(db, 'users', userId, 'workspaces', workspace.id, 'secrets', 'tlu_credentials'));
        if (secretSnap.exists()) {
            secretData = secretSnap.data();
        } else if (workspace.password) {
            secretData = { password: workspace.password, isEncrypted: (workspace as any).isEncrypted };
        }
    } catch(e) {}

    // Attempt background sync before entering, if password is available
    if (secretData && secretData.password) {
      try {
        if (secretData.isEncrypted) {
            await handleSyncRequest(workspace.id, secretData.password, workspace, true, 'sinhvien1');
        } else {
            let decodedRaw = secretData.password; try { decodedRaw = decodeURIComponent(atob(secretData.password)); } catch(e) {}
            await handleSyncRequest(workspace.id, decodedRaw, workspace, false, 'sinhvien1');
        }
      } catch (err) {
        console.error("Auto sync on select failed:", err);
        localStorage.setItem('savedWorkspaceId', workspace.id);
        onWorkspaceSelect(workspace);
      }
    } else {
      localStorage.setItem('savedWorkspaceId', workspace.id);
      onWorkspaceSelect(workspace);
    }
  };

  const handleSyncRequest = async (
    code: string, 
    pass: string, 
    existingWp?: Workspace, 
    isEncrypted: boolean = false,
    portal: 'sinhvien1' | 'sv_tlu' = portalType,
    captcha: string = captchaCode,
    sessionState: string = captchaSession || ''
  ) => {
    const { auth } = await import('../firebase');
    const idToken = await auth.currentUser?.getIdToken();
    
    const bodyParams: any = { 
      studentCode: code,
      portal 
    };

    if (portal === 'sv_tlu') {
      bodyParams.captcha = captcha;
      bodyParams.sessionState = sessionState;
    }

    if (isEncrypted) {
       bodyParams.encryptedPassword = pass;
    } else {
       bodyParams.password = pass;
    }

    const { json } = await syncTluWithChunks(bodyParams, idToken);

    const results: any[] = [];
    if (json.data && Array.isArray(json.data)) {
      json.data.forEach((item: any) => {
        if (item.timetables && Array.isArray(item.timetables)) {
          item.timetables.forEach((tb: any) => {
             const room = tb?.room?.name || tb?.room?.code || tb?.roomName || '';
             const lecturer = tb?.teacher?.displayName || tb?.teacher?.name || tb?.teacherName || '';
             const startStr = tb?.startHour?.name || tb?.startHour?.index || tb?.startHour || 1;
             const endStr = tb?.endHour?.name || tb?.endHour?.index || tb?.endHour || 1;
             const sPeriod = parseInt(String(startStr).replace(/\D/g, '')) || 1;
             const ePeriod = parseInt(String(endStr).replace(/\D/g, '')) || 1;
             
             const periods = [];
             for(let i = sPeriod; i <= ePeriod && periods.length < 20; i++) periods.push(i);
             
             const weekIndex = tb?.weekIndex || 2;
             const dayIndex = weekIndex === 1 ? 0 : weekIndex - 1; 
             
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

    if (json.exams && Array.isArray(json.exams)) {
      json.exams.forEach((item: any) => {
        let eDate = new Date().toISOString().split('T')[0];
        let dayIndex = 0; 
        try {
          if (item.examDate) {
             const d = new Date(item.examDate);
             eDate = d.toISOString().split('T')[0];
             dayIndex = d.getDay();
          }
        } catch (e) {}

        let periods = [1, 2, 3];
        const timeStr = String(item.examTime || '');
        const shiftStr = String(item.examShift || item.shift || item.caThi || '');
        let shiftMatch = shiftStr.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        
        if (shiftMatch) {
            const s = parseInt(shiftMatch[1]);
            const e = parseInt(shiftMatch[2] || shiftMatch[1]);
            periods = [];
            for (let i = s; i <= e; i++) periods.push(i);
        } else if (timeStr) {
            const hsMatch = timeStr.match(/(\d+):/);
            if (hsMatch) {
                const h = parseInt(hsMatch[1]);
                if (h === 7) periods = [1, 2, 3];
                else if (h === 8) periods = [3, 4];
                else if (h === 9) periods = [4, 5, 6];
                else if (h === 10) periods = [5, 6];
                else if (h === 12 || h === 13) periods = [7, 8, 9];
                else if (h === 14) periods = [9, 10];
                else if (h === 15) periods = [10, 11, 12];
                else if (h === 16) periods = [11, 12];
                else if (h >= 17) periods = [13, 14, 15];
            }
        }

        results.push({
          id: Math.random().toString(36).substr(2, 9),
          name: `${item.subjectName} (THI)`,
          code: item.subjectCode || '',
          room: item.roomName || '',
          lecturer: 'Lịch Thi',
          startDate: eDate,
          endDate: eDate,
          daysOfWeek: [dayIndex],
          periods: periods,
          color: 'border-l-red-500', 
          semesterId: item.semesterId == null ? '' : String(item.semesterId),
          semesterName: item.semesterName == null ? '' : String(item.semesterName)
        });
      });
    }
    
    if (results.length === 0) {
       throw new Error('Đăng nhập thành công nhưng không tìm thấy dữ liệu lịch học.');
    }

    const name = json.studentName ? `${json.studentName} (${code})` : `Sinh viên ${code}`;
    const newWorkspace: Workspace = existingWp || {
      id: code,
      name: name,
      password: json.encryptedPassword || btoa(encodeURIComponent(pass)),
      isEncrypted: !!json.encryptedPassword,
      portal: portal
    };
    
    if (existingWp) {
        newWorkspace.portal = portal;
        if (json.encryptedPassword && !existingWp.isEncrypted) {
            newWorkspace.password = json.encryptedPassword;
            newWorkspace.isEncrypted = true;
        }
        await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id), newWorkspace, { merge: true });
    } else {
        await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id), newWorkspace);
    }
    
    // Save grades
    if (json.gpaSummary || json.detailedMarks) {
      try {
        await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id, 'grades', 'data'), {
          summary: json.gpaSummary || [],
          detailed: json.detailedMarks || [],
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Lỗi khi lưu điểm:", e);
      }
    }
    
    for (const subject of results) {
       try {
           let deterministicId = btoa(encodeURIComponent(`${subject.name}_${subject.startDate}_${subject.daysOfWeek[0]}_${subject.periods[0]}`));
           deterministicId = deterministicId.replace(/\//g, '_').replace(/\+/g, '-');
           subject.id = deterministicId;
           const docRef = doc(db, 'users', userId, 'workspaces', newWorkspace.id, 'subjects', subject.id);
           await setDoc(docRef, subject);
       } catch (err) {
           console.error("FAIL ON SUBJECT:", JSON.stringify(subject), err);
       }
    }

    localStorage.setItem('savedWorkspaceId', newWorkspace.id);
    onWorkspaceSelect(newWorkspace);
  };

  const handleTluLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode || !password) {
      setError('Vui lòng nhập mã sinh viên và mật khẩu TLU');
      return;
    }

    if (portalType === 'sv_tlu' && !captchaCode.trim()) {
      setError('Vui lòng nhập 4 ký tự mã bảo vệ (CAPTCHA)');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await handleSyncRequest(studentCode, password, undefined, false, portalType, captchaCode, captchaSession || '');
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      if (portalType === 'sv_tlu') {
        loadNewCaptcha();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-none mb-6 rotate-12">
            <Users className="w-10 h-10 text-white -rotate-12" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Lịch Học Của Bạn</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-center text-sm">
            {workspaces.length > 0 ? 'Chọn tài khoản đã kết nối hoặc đăng nhập mới' : 'Đăng nhập bằng tài khoản TLU để lấy toàn bộ lịch học'}
          </p>
        </div>

        {workspaces.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            {workspaces.map(w => (
              <SwipeableWorkspace
                key={w.id}
                workspace={w}
                onSelect={handleSelectWorkspace}
                onDelete={handleDeleteWorkspace}
                isSyncing={syncingWorkspaceId === w.id}
              />
            ))}
            <div className="flex items-center gap-4 my-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              <span className="text-xs font-semibold text-gray-400">HOẶC THÊM TÀI KHOẢN MỚI</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        )}

        <Card className="p-6 sm:p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90">
          <form onSubmit={handleTluLogin} className="flex flex-col gap-5">
            
            {/* Cổng đăng nhập: Khóa cũ vs Khóa mới */}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 block">
                Chọn cổng sinh viên
              </label>
              <div className="grid grid-cols-2 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setPortalType('sinhvien1');
                    setError('');
                  }}
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
                    setError('');
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

            <Input
              label="Mã sinh viên"
              placeholder="Ví dụ: 2351060123"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              icon={<Users className="w-4 h-4" />}
            />
            
            <Input
              label="Mật khẩu TLU"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Key className="w-4 h-4" />}
            />

            {/* CAPTCHA section for Khóa mới (sv.tlu.edu.vn) */}
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
                  Bấm nút tròn để đổi mã khác nếu chữ khó nhìn. Khi sai, hệ thống sẽ tự động đổi mã mới.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full h-12 text-base shadow-lg font-bold">
              {isLoading ? 'Đang đồng bộ lấy lịch...' : 'Đồng bộ'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
