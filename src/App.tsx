/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
import { Calendar, LayoutGrid, Settings, LogOut, Plus, Users } from 'lucide-react';
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
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSwitchWorkspace = () => {
    setWorkspace(null);
    setSubjects([]);
    setNotes([]);
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

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Đang tải...</div>;
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
      headerAction={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSwitchWorkspace} className="text-gray-500 hover:text-blue-600" title="Đổi lịch học">
            <Users className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-500" title="Đăng xuất">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      }
    >
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-8"
        tabs={[
          { id: 'daily', label: 'Ngày', icon: <Calendar className="w-4 h-4" /> },
          { id: 'weekly', label: 'Tuần', icon: <LayoutGrid className="w-4 h-4" /> },
          { id: 'update', label: 'Cập nhật', icon: <Settings className="w-4 h-4" /> },
        ]}
      />

      <div className="min-h-[60vh]">
        {activeTab === 'daily' && (
          <DailyView 
            subjects={subjects} 
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
            subjects={subjects} 
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
            className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
            placeholder="Nhập nội dung ghi chú..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
          <Button onClick={addNote} className="w-full">Lưu ghi chú</Button>
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
          className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </Layout>
  );
}
