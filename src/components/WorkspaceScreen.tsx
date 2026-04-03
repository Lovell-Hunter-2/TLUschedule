import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Card } from './Card';
import { UserPlus, Users, Key, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, setDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace } from '../types';

interface WorkspaceScreenProps {
  userId: string;
  onWorkspaceSelect: (workspace: Workspace) => void;
}

export function WorkspaceScreen({ userId, onWorkspaceSelect }: WorkspaceScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [newName, setNewName] = useState('');
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
      if (loadedWorkspaces.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(loadedWorkspaces[0].id);
      } else if (loadedWorkspaces.length === 0) {
        setActiveTab('register');
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Reset state when switching tabs
  useEffect(() => {
    setError('');
    setPassword('');
  }, [activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId || !password) {
      setError('Vui lòng chọn tên và nhập mật khẩu');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
      if (selectedWorkspace) {
        if (selectedWorkspace.password === btoa(encodeURIComponent(password))) {
          onWorkspaceSelect(selectedWorkspace);
        } else {
          setError('Mật khẩu chưa chính xác.');
        }
      }
    } catch (err) {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !password) {
      setError('Vui lòng nhập đầy đủ tên và mật khẩu');
      return;
    }
    if (workspaces.some(w => w.name.toLowerCase() === newName.toLowerCase())) {
      setError('Tên này đã tồn tại. Vui lòng chọn tên khác hoặc chuyển sang phần Đăng nhập.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const newWorkspace: Workspace = {
        id: Math.random().toString(36).substr(2, 9),
        name: newName,
        password: btoa(encodeURIComponent(password))
      };
      await setDoc(doc(db, 'users', userId, 'workspaces', newWorkspace.id), newWorkspace);
      onWorkspaceSelect(newWorkspace);
    } catch (err) {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 mb-6 rotate-12">
            <Users className="w-10 h-10 text-white -rotate-12" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Lịch Học Của Bạn</h1>
          <p className="text-gray-500 font-medium mt-2 text-center">
            Quản lý nhiều lịch học khác nhau trên cùng một tài khoản
          </p>
        </div>

        <Card className="p-2 shadow-2xl shadow-gray-200/50 border-white/50 backdrop-blur-sm bg-white/90 mb-6">
          <div className="flex bg-gray-100/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'login' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'register' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tạo lịch mới
            </button>
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
              <Card className="p-8 shadow-2xl shadow-gray-200/50 border-white/50 backdrop-blur-sm bg-white/90">
                <form onSubmit={handleLogin} className="flex flex-col gap-6">
                  {workspaces.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Chọn tên lịch học</label>
                      <div className="relative">
                        <select
                          value={selectedWorkspaceId}
                          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                          className="w-full h-12 pl-11 pr-10 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all appearance-none font-medium text-gray-700"
                        >
                          {workspaces.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                        <Users className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <ChevronDown className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-gray-500 text-sm">Bạn chưa có lịch học nào. Vui lòng tạo mới.</p>
                    </div>
                  )}
                  
                  <Input
                    label="Mật khẩu"
                    type="password"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Key className="w-4 h-4" />}
                  />

                  {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                  <Button 
                    type="submit" 
                    disabled={isLoading || workspaces.length === 0}
                    className="w-full h-12 text-lg font-bold rounded-2xl shadow-lg shadow-blue-100"
                  >
                    {isLoading ? 'Đang xử lý...' : 'Vào lịch học'}
                  </Button>
                </form>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-8 shadow-2xl shadow-gray-200/50 border-white/50 backdrop-blur-sm bg-white/90">
                <form onSubmit={handleRegister} className="flex flex-col gap-6">
                  <Input
                    label="Tên lịch học mới"
                    placeholder="Ví dụ: Ngô Minh Thuận"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    icon={<UserPlus className="w-4 h-4" />}
                  />
                  <Input
                    label="Mật khẩu"
                    type="password"
                    placeholder="Tạo mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Key className="w-4 h-4" />}
                  />

                  {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full h-12 text-lg font-bold rounded-2xl shadow-lg shadow-blue-100"
                  >
                    {isLoading ? 'Đang xử lý...' : 'Tạo lịch mới'}
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
