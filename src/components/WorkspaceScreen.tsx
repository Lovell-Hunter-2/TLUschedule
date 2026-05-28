import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { Users, Key, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, setDoc, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace } from '../types';

interface WorkspaceScreenProps {
  userId: string;
  onWorkspaceSelect: (workspace: Workspace) => void;
}

export function WorkspaceScreen({ userId, onWorkspaceSelect }: WorkspaceScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'select'>('login');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      }

      if (loadedWorkspaces.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(loadedWorkspaces[0].id);
        setActiveTab('select');
      } else if (loadedWorkspaces.length === 0) {
        setActiveTab('login');
      }
    });

    return () => unsubscribe();
  }, [userId, selectedWorkspaceId, onWorkspaceSelect]);

  useEffect(() => {
    setError('');
  }, [activeTab]);

  const handleSelectWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId) return;
    const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
    if (selectedWorkspace) {
      localStorage.setItem('savedWorkspaceId', selectedWorkspace.id);
      onWorkspaceSelect(selectedWorkspace);
    }
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
      const res = await fetch('/api/tlu-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode, password })
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

      // Xử lý lịch thi
      if (json.exams && Array.isArray(json.exams)) {
        json.exams.forEach((item: any) => {
          let eDate = new Date().toISOString().split('T')[0];
          let dayIndex = 0; // default Sunday
          try {
            if (item.examDate) {
               const d = new Date(item.examDate);
               eDate = d.toISOString().split('T')[0];
               dayIndex = d.getDay();
            }
          } catch (e) {}

          // Phân tích examTime ví dụ "07:00-09:00" => chuyển thành tiết tạm (1, 2, 3) 
          // Thi thường 2-3 tiếng, ta cho tạm chiếm tiết 1-3 hoặc 7-9 tuỳ thời gian
          let periods = [1, 2, 3];
          if (item.examTime && item.examTime.includes('13:') || String(item.examTime).startsWith('14:')) {
             periods = [7, 8, 9];
          }

          results.push({
            id: Math.random().toString(36).substr(2, 9),
            name: `${item.subjectName} (THI)`,
            room: item.roomName || '',
            lecturer: 'Lịch Thi',
            startDate: eDate,
            endDate: eDate, // startDate = endDate để hiện duy nhất ngày đó
            daysOfWeek: [dayIndex],
            periods: periods,
            color: 'border-l-red-500', // Đỏ cho lịch thi
            semesterId: item.semesterId,
            semesterName: item.semesterName
          });
        });
      }
      
      if (results.length === 0) {
         throw new Error('Đăng nhập thành công nhưng không có dữ liệu lịch học.');
      }

      // Tạo Workspace
      const name = json.studentName ? `${json.studentName} (${studentCode})` : `Sinh viên ${studentCode}`;
      const newWorkspace: Workspace = {
        id: studentCode,
        name: name,
        password: btoa(encodeURIComponent(password)) // Giữ lại để tiện sync sau
      };

      await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id), newWorkspace);
      
      // Batch update môn học
      const batch = writeBatch(db);
      // Thay vì xoá, ta cập nhật thêm, hoặc có thể fetch xoá rồi thêm. Tạm thời set đè. Thực ra môn học có id sinh ngẫu nhiên, nếu user sync 2 lần sẽ bị nhân đôi. 
      // Để tránh nhân đôi, id môn học nên tạo ra từ `item.subjectCode + tb.weekIndex + d`. 
      
      results.forEach(subject => {
         // Tính ID deterministic để không bị nhân đôi
         const deterministicId = btoa(encodeURIComponent(`${subject.name}_${subject.startDate}_${subject.daysOfWeek[0]}_${subject.periods[0]}`));
         subject.id = deterministicId;
         const docRef = doc(db, 'users', userId, 'workspaces', newWorkspace.id, 'subjects', subject.id);
         batch.set(docRef, subject);
      });
      await batch.commit();

      localStorage.setItem('savedWorkspaceId', newWorkspace.id);
      onWorkspaceSelect(newWorkspace);

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
            Đăng nhập bằng tài khoản TLU để đồng bộ toàn bộ lịch học
          </p>
        </div>

        <Card className="p-2 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 mb-6">
          <div className="flex bg-gray-100/50 dark:bg-gray-900/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'login' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Đăng nhập & Đồng bộ
            </button>
            {workspaces.length > 0 && (
              <button
                onClick={() => setActiveTab('select')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  activeTab === 'select' 
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Tài khoản đã lưu
              </button>
            )}
          </div>
        </Card>

        <AnimatePresence mode="wait">
          {activeTab === 'login' ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
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
                    {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                  </Button>
                </form>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90">
                <form onSubmit={handleSelectWorkspace} className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Chọn tài khoản</label>
                    <div className="space-y-3">
                      {workspaces.map(w => (
                        <div 
                          key={w.id}
                          onClick={() => setSelectedWorkspaceId(w.id)}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                            selectedWorkspaceId === w.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${selectedWorkspaceId === w.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                              <Users className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{w.name}</span>
                          </div>
                          {selectedWorkspaceId === w.id && (
                            <CheckCircle2 className="w-6 h-6 text-blue-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" disabled={!selectedWorkspaceId} className="w-full h-12 text-lg shadow-lg font-bold">
                    Vào lịch học
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
