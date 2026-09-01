import { syncTluWithChunks } from "../lib/tlu-client";
import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Users, Key, CheckCircle2, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useAnimation, PanInfo } from 'motion/react';
import { collection, setDoc, doc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace } from '../types';

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
              <h3 className="font-bold text-gray-900 dark:text-white">{workspace.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tiếp tục đồng bộ và xem lịch</p>
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
  
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncingWorkspaceId, setSyncingWorkspaceId] = useState<string | null>(null);

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
    
    // Fetch password from secure subcollection
    let secretData: any = null;
    try {
        const { getDoc } = await import('firebase/firestore');
        const secretSnap = await getDoc(doc(db, 'users', userId, 'workspaces', workspace.id, 'secrets', 'tlu_credentials'));
        if (secretSnap.exists()) {
            secretData = secretSnap.data();
        } else if (workspace.password) {
            // Fallback for older data before migration
            secretData = { password: workspace.password, isEncrypted: (workspace as any).isEncrypted };
        }
    } catch(e) {}

    // Attempt background sync before entering, if password is available
    if (secretData && secretData.password) {
      try {
        if (secretData.isEncrypted) {
            await handleSyncRequest(workspace.id, secretData.password, workspace, true);
        } else {
            let decodedRaw = secretData.password; try { decodedRaw = decodeURIComponent(atob(secretData.password)); } catch(e) {}
            await handleSyncRequest(workspace.id, decodedRaw, workspace, false);
        }
      } catch (err) {
        // If sync fails, just enter anyway
        console.error("Auto sync on select failed:", err);
        localStorage.setItem('savedWorkspaceId', workspace.id);
        onWorkspaceSelect(workspace);
      }
    } else {
      localStorage.setItem('savedWorkspaceId', workspace.id);
      onWorkspaceSelect(workspace);
    }
  };

  const handleSyncRequest = async (code: string, pass: string, existingWp?: Workspace, isEncrypted: boolean = false) => {
    const { auth } = await import('../firebase');
    const idToken = await auth.currentUser?.getIdToken();
    
    const bodyParams: any = { studentCode: code };
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
             for(let i = sPeriod; i <= ePeriod; i++) periods.push(i);
             
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
       throw new Error('Đăng nhập thành công nhưng không có dữ liệu lịch học.');
    }

    const name = json.studentName ? `${json.studentName} (${code})` : `Sinh viên ${code}`;
    const newWorkspace: Workspace = existingWp || {
      id: code,
      name: name,
      password: json.encryptedPassword || btoa(encodeURIComponent(pass)),
      isEncrypted: !!json.encryptedPassword
    };
    
    // Auto upgrade old base64 password to encrypted password
    if (existingWp && json.encryptedPassword && !existingWp.isEncrypted) {
        newWorkspace.password = json.encryptedPassword;
        newWorkspace.isEncrypted = true;
        await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id), newWorkspace, { merge: true });
    }

        if (!existingWp) {
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
    
    const batch = writeBatch(db);
    
    results.forEach(subject => {
       const deterministicId = btoa(encodeURIComponent(`${subject.name}_${subject.startDate}_${subject.daysOfWeek[0]}_${subject.periods[0]}`));
       subject.id = deterministicId;
       const docRef = doc(db, 'users', userId, 'workspaces', newWorkspace.id, 'subjects', subject.id);
       batch.set(docRef, subject);
    });
    await batch.commit();

    localStorage.setItem('savedWorkspaceId', newWorkspace.id);
    onWorkspaceSelect(newWorkspace);
  };

  const handleTluLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode || !password) {
      setError('Vui lòng nhập mã sinh viên và mật khẩu TLU');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await handleSyncRequest(studentCode, password);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
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
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-2 text-center">
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

        <Card className="p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90">
          <form onSubmit={handleTluLogin} className="flex flex-col gap-6">
            
            <Input
              label="Mã sinh viên"
              placeholder="Nhập mã sinh viên"
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

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg shadow-lg font-bold">
              {isLoading ? 'Đang đồng bộ lấy lịch...' : 'Đồng bộ'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
