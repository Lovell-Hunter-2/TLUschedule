import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Activity, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'errors'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [usageEvents, setUsageEvents] = useState<any[]>([]);
  const [syncErrors, setSyncErrors] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    });

    const unsubscribeUsage = onSnapshot(query(collection(db, 'usage_events'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsageEvents(data);
    });

    const unsubscribeErrors = onSnapshot(query(collection(db, 'sync_errors'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSyncErrors(data);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeUsage();
      unsubscribeErrors();
    };
  }, []);

  const isOnline = (lastActiveStr: string) => {
    if (!lastActiveStr) return false;
    const lastActive = new Date(lastActiveStr).getTime();
    // Consider online if active within the last 3 minutes
    return Date.now() - lastActive < 3 * 60 * 1000;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Không rõ';
    try {
      return format(new Date(dateStr), 'HH:mm dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: vi });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 overflow-y-auto flex flex-col">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 p-2 rounded-lg">
              <Users className="w-6 h-6" />
            </span>
            Admin Dashboard
          </h1>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="max-w-6xl mx-auto mt-6 flex gap-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              activeTab === 'users' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Users className="w-4 h-4" /> Người dùng (${users.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Activity className="w-4 h-4" /> Usage Analytics
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              activeTab === 'errors' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Sync Errors (${syncErrors.length})
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <th className="p-4 font-medium">Người dùng</th>
                      <th className="p-4 font-medium">Email</th>
                      <th className="p-4 font-medium">Trạng thái</th>
                      <th className="p-4 font-medium">Lần cuối đăng nhập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="p-4 text-gray-900 dark:text-gray-100 font-medium">
                          {u.displayName || 'Khách'}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {u.email}
                        </td>
                        <td className="p-4">
                          {isOnline(u.lastActive) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              Đang hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              Ngoại tuyến
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                          <div>{formatDate(u.lastLogin)}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(u.lastLogin)}</div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">
                          Chưa có dữ liệu người dùng
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Lịch sử Hoạt động (100 sự kiện gần nhất)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <th className="p-4 font-medium">Thời gian</th>
                      <th className="p-4 font-medium">Email</th>
                      <th className="p-4 font-medium">Sự kiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {usageEvents.map(ev => (
                      <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="p-4 text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                          {formatDate(ev.timestamp)}
                        </td>
                        <td className="p-4 text-gray-900 dark:text-gray-100 font-medium">
                          {ev.userEmail || 'Unknown'}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {ev.eventType}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {usageEvents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-gray-500">
                          Chưa có dữ liệu thống kê
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'errors' && (
            <motion.div
              key="errors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Nhật ký lỗi (100 lỗi gần nhất)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <th className="p-4 font-medium">Thời gian</th>
                      <th className="p-4 font-medium">Email / Student ID</th>
                      <th className="p-4 font-medium">Chi tiết lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {syncErrors.map(err => (
                      <tr key={err.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="p-4 text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                          {formatDate(err.timestamp)}
                        </td>
                        <td className="p-4">
                          <div className="text-gray-900 dark:text-gray-100 font-medium">{err.userEmail}</div>
                          <div className="text-xs text-gray-500">ID: {err.studentCode}</div>
                        </td>
                        <td className="p-4 text-red-600 dark:text-red-400 text-sm font-mono bg-red-50/50 dark:bg-red-900/10">
                          {err.errorMessage}
                        </td>
                      </tr>
                    ))}
                    {syncErrors.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-gray-500">
                          Tuyệt vời! Chưa có lỗi đồng bộ nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
