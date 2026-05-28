/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { WorkspaceScreen } from './components/WorkspaceScreen';
import { Layout } from './components/Layout';
import { DailyView } from './components/DailyView';
import { WeeklyView } from './components/WeeklyView';
import { UpdateView } from './components/UpdateView';
import { Tabs } from './components/Tabs';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { Subject, Note, UserProfile, Workspace } from './types';
import { Calendar, LayoutGrid, Settings, LogOut, Plus, Users, Download, Image as ImageIcon, Moon, Sun, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, writeBatch } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteDate, setNoteDate] = useState<Date | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | 'all'>('all');
  
  // Dark Mode
  // Admin & Global Settings
  const [globalBg, setGlobalBg] = useState<string>('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [bgInput, setBgInput] = useState('');

  const isAdmin = user?.email === 'taikhoanphubg4@gmail.com';

  const semestersList = useMemo(() => {
    const map = new Map<number, string>();
    subjects.forEach(s => {
      if (s.semesterId && s.semesterName) {
        map.set(s.semesterId, s.semesterName);
      }
    });
    const arr = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    arr.sort((a, b) => b.id - a.id); // Mới nhất lên đầu
    return arr;
  }, [subjects]);

  // Tự động gán kỳ mới nhất nếu chưa chọn
  useEffect(() => {
    if (semestersList.length > 0 && selectedSemesterId === 'all') {
      setSelectedSemesterId(semestersList[0].id);
    }
  }, [semestersList]);

  const filteredSubjects = useMemo(() => {
    if (selectedSemesterId === 'all') return subjects;
    return subjects.filter(s => s.semesterId === selectedSemesterId);
  }, [subjects, selectedSemesterId]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Background Auto-sync
  const runSync = async (force: boolean = false) => {
    if (!user || !workspace || !workspace.password || workspace.password === '') return;
    
    const lastSyncKey = `last_sync_tlu_${workspace.id}`;
    if (!force) {
      const lastTime = localStorage.getItem(lastSyncKey);
      const now = Date.now();
      if (lastTime && now - parseInt(lastTime) < 4 * 60 * 60 * 1000) {
        return;
      }
    }

    try {
      setIsSyncing(true);
      console.log("Đang đồng bộ ngầm lịch học/thi...");
      const rawPassword = decodeURIComponent(atob(workspace.password!));
      const studentCode = workspace.id;

      const res = await fetch('/api/tlu-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode, password: rawPassword })
      });
      
      if (!res.ok) {
        if (force) alert("Có lỗi khi đồng bộ. Vui lòng thử lại sau.");
        return;
      }
      const json = await res.json();
      const results: any[] = [];
      
      // Map lịch học
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
      
      // Map lịch thi
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
          if (item.examTime && item.examTime.includes('13:') || String(item.examTime).startsWith('14:')) {
             periods = [7, 8, 9];
          }
          results.push({
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

      if (results.length > 0) {
        const batch = writeBatch(db);
        results.forEach(subject => {
           const deterministicId = btoa(encodeURIComponent(`${subject.name}_${subject.startDate}_${subject.daysOfWeek[0]}_${subject.periods[0]}`));
           subject.id = deterministicId;
           const docRef = doc(db, 'users', user.uid, 'workspaces', workspace.id, 'subjects', subject.id);
           batch.set(docRef, subject);
        });
        await batch.commit();
        localStorage.setItem(lastSyncKey, Date.now().toString());
        console.log("Đã đồng bộ thành công!");
        if (force) alert("Đồng bộ lịch học và lịch thi thành công!");
      } else {
        if (force) alert("Không tìm thấy môn học nào.");
      }
    } catch (err) {
      console.log("Auto sync failed:", err);
      if (force) alert("Có lỗi khi đồng bộ.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    runSync(false);
  }, [user, workspace]);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen to global settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalBg(data.backgroundImage || '');
      }
    }, (error) => {
      console.error("Error fetching global settings:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userData = {
          displayName: currentUser.displayName || 'Sinh viên',
          email: currentUser.email || ''
        };
        setUser({ ...userData, uid: currentUser.uid });
        
        // Save user profile to Firestore
        try {
          await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
        } catch (error) {
          console.error("Failed to save user profile:", error);
        }
      } else {
        setUser(null);
        setWorkspace(null);
        setSubjects([]);
        setNotes([]);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !workspace) return;

    const subjectsRef = collection(db, 'users', user.uid, 'workspaces', workspace.id, 'subjects');
    const unsubscribeSubjects = onSnapshot(query(subjectsRef), (snapshot) => {
      const loadedSubjects: Subject[] = [];
      snapshot.forEach((doc) => {
        loadedSubjects.push(doc.data() as Subject);
      });
      setSubjects(loadedSubjects);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/workspaces/${workspace.id}/subjects`);
    });

    const notesRef = collection(db, 'users', user.uid, 'workspaces', workspace.id, 'notes');
    const unsubscribeNotes = onSnapshot(query(notesRef), (snapshot) => {
      const loadedNotes: Note[] = [];
      snapshot.forEach((doc) => {
        loadedNotes.push(doc.data() as Note);
      });
      setNotes(loadedNotes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/workspaces/${workspace.id}/notes`);
    });

    return () => {
      unsubscribeSubjects();
      unsubscribeNotes();
    };
  }, [user, workspace, isAuthReady]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('savedWorkspaceId');
      localStorage.removeItem('savedWorkspacePassword');
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSwitchWorkspace = () => {
    localStorage.removeItem('savedWorkspaceId');
    localStorage.removeItem('savedWorkspacePassword');
    setWorkspace(null);
    setSubjects([]);
    setNotes([]);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('Android: Chọn "3 chấm" ==> "Cài đặt ứng dụng" \niOS: Chọn "Chia sẻ" ==> "Thêm vào màn hình chính"');
    }
  };

  const updateSubjects = async (newSubjects: Subject[]) => {
    if (!user || !workspace) return;
    
    try {
      const batch = writeBatch(db);
      
      // Delete old subjects
      subjects.forEach(subject => {
        const subjectRef = doc(db, 'users', user.uid, 'workspaces', workspace.id, 'subjects', subject.id);
        batch.delete(subjectRef);
      });
      
      // Add new subjects
      newSubjects.forEach(subject => {
        const subjectRef = doc(db, 'users', user.uid, 'workspaces', workspace.id, 'subjects', subject.id);
        batch.set(subjectRef, subject);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/workspaces/${workspace.id}/subjects`);
    }
  };

  const addNote = async () => {
    if (!noteContent.trim() || !noteDate || !user || !workspace) return;
    
    const noteId = editingNoteId || Math.random().toString(36).substr(2, 9);
    const newNote: Note = {
      id: noteId,
      date: format(noteDate, 'yyyy-MM-dd'),
      content: noteContent,
      createdAt: Date.now()
    };
    
    try {
      await setDoc(doc(db, 'users', user.uid, 'workspaces', workspace.id, 'notes', newNote.id), newNote);
      setNoteContent('');
      setEditingNoteId(null);
      setIsNoteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/workspaces/${workspace.id}/notes/${newNote.id}`);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!user || !workspace) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workspaces', workspace.id, 'notes', noteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/workspaces/${workspace.id}/notes/${noteId}`);
    }
  };

  const editNote = (note: Note) => {
    setNoteDate(new Date(note.date));
    setNoteContent(note.content);
    setEditingNoteId(note.id);
    setIsNoteModalOpen(true);
  };

  const saveGlobalSettings = async () => {
    try {
      await setDoc(doc(db, 'app_settings', 'global'), {
        backgroundImage: bgInput
      }, { merge: true });
      setIsAdminModalOpen(false);
    } catch (error) {
      console.error("Failed to save global settings:", error);
      alert("Lỗi khi lưu cài đặt. Bạn có chắc mình là admin không?");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6 shadow-lg"></div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight animate-pulse">Đang tải dữ liệu...</h2>
        <p className="text-gray-500 mt-2 font-medium">Vui lòng đợi một chút nhé</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLoginSuccess={() => {}} />;
  }

  if (!workspace) {
    return <WorkspaceScreen userId={user.uid} onWorkspaceSelect={setWorkspace} />;
  }

  return (
    <Layout 
      title={workspace.name} 
      subtitle="Sinh viên Đại học Thủy Lợi"
      backgroundImage={globalBg}
      headerAction={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setBgInput(globalBg);
                setIsAdminModalOpen(true);
              }} 
              className="text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-gray-800" 
              title="Cài đặt Admin"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => runSync(true)} 
            disabled={isSyncing}
            className="text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 font-medium hidden sm:flex" 
            title="Đồng bộ lại"
          >
            {isSyncing ? "Đang đồng bộ..." : "Đồng bộ lại"}
          </Button>
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 dark:shadow-none"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Cài đặt app</span>
          </button>
          <Button variant="ghost" size="sm" onClick={handleSwitchWorkspace} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="Đổi lịch học">
            <Users className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400" title="Đăng xuất">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-8 gap-4">
        <Tabs
          className="w-full sm:w-auto"
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'daily', label: 'Ngày', icon: <Calendar className="w-4 h-4" /> },
            { id: 'weekly', label: 'Tuần', icon: <LayoutGrid className="w-4 h-4" /> },
            { id: 'update', label: 'Cập nhật', icon: <Settings className="w-4 h-4" /> },
          ]}
        />
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => runSync(true)} 
            disabled={isSyncing}
            className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 sm:hidden w-full flex-1" 
            title="Đồng bộ lại"
          >
            {isSyncing ? "Đang đồng bộ..." : "Đồng bộ lại TLU"}
          </Button>

          {semestersList.length > 0 && activeTab !== 'update' && (
            <div className="relative flex-1 sm:flex-none">
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full sm:w-auto appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2.5 pl-4 pr-10 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Tất cả kỳ học</option>
                {semestersList.map(sem => (
                  <option key={sem.id} value={sem.id}>{sem.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'daily' && (
          <DailyView 
            subjects={filteredSubjects} 
            notes={notes} 
            onAddNote={(date) => {
              setNoteDate(date);
              setNoteContent('');
              setEditingNoteId(null);
              setIsNoteModalOpen(true);
            }} 
            onEditNote={editNote}
            onDeleteNote={deleteNote}
          />
        )}
        {activeTab === 'weekly' && (
          <WeeklyView 
            subjects={filteredSubjects} 
            notes={notes}
            onAddNote={(date) => {
              setNoteDate(date);
              setNoteContent('');
              setEditingNoteId(null);
              setIsNoteModalOpen(true);
            }} 
            onEditNote={editNote}
            onDeleteNote={deleteNote}
          />
        )}
        {activeTab === 'update' && (
          <UpdateView subjects={subjects} onUpdate={updateSubjects} />
        )}
      </div>

      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNoteId(null);
        }}
        title={`${editingNoteId ? 'Sửa' : 'Thêm'} ghi chú ${noteDate ? format(noteDate, 'dd/MM') : ''}`}
      >
        <div className="flex flex-col gap-4">
          <textarea
            className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-600 outline-none transition-all dark:text-gray-100"
            placeholder="Nhập nội dung ghi chú..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <Button onClick={addNote} className="w-full">Lưu ghi chú</Button>
        </div>
      </Modal>

      {/* Admin Modal */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title="Cài đặt Admin - Đổi hình nền"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Dán link ảnh (URL) vào đây để đổi hình nền cho toàn bộ người dùng. Để trống nếu muốn xóa hình nền.
          </p>
          <input
            type="text"
            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 focus:border-purple-400 dark:focus:border-purple-600 outline-none transition-all dark:text-gray-100"
            placeholder="https://example.com/image.jpg"
            value={bgInput}
            onChange={(e) => setBgInput(e.target.value)}
          />
          {bgInput && (
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-32 relative">
              <img src={bgInput} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
          <Button onClick={saveGlobalSettings} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
            Lưu hình nền
          </Button>
        </div>
      </Modal>

      {/* Floating Action Button for quick add */}
      {activeTab !== 'update' && (
        <button
          onClick={() => {
            setNoteDate(new Date());
            setNoteContent('');
            setEditingNoteId(null);
            setIsNoteModalOpen(true);
          }}
          className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </Layout>
  );
}
