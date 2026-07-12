import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Users, Key, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, setDoc, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace } from '../types';

interface WorkspaceScreenProps {
  userId: string;
  onWorkspaceSelect: (workspace: Workspace) => void;
}

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

  const handleSelectWorkspace = async (workspace: Workspace) => {
    setSyncingWorkspaceId(workspace.id);
    
    // Attempt background sync before entering, if password is available
    if (workspace.password) {
      try {
        const decodedRaw = decodeURIComponent(atob(workspace.password));
        await handleSyncRequest(workspace.id, decodedRaw, workspace);
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

  const handleSyncRequest = async (code: string, pass: string, existingWp?: Workspace) => {
    const res = await fetch('/api/tlu-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode: code, password: pass })
    });
    
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`Máy chủ Vercel phản hồi lỗi (Status: ${res.status}). Vui lòng thử lại.`);
    }
    
    if (!res.ok) {
      let errorMsg = json?.error || 'Lỗi đăng nhập hoặc đồng bộ';
      throw new Error(errorMsg);
    }

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
               semesterId: item.semesterId,
               semesterName: item.semesterName
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
          semesterId: item.semesterId,
          semesterName: item.semesterName
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
      password: btoa(encodeURIComponent(pass))
    };

    if (!existingWp) {
      await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id), newWorkspace);
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
              <Card 
                key={w.id} 
                className="overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-all hover:border-blue-300 hover:shadow-md cursor-pointer"
                onClick={() => handleSelectWorkspace(w)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{w.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tiếp tục đồng bộ và xem lịch</p>
                  </div>
                  {syncingWorkspaceId === w.id ? (
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </Card>
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
