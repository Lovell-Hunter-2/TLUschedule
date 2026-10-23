import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Activity, AlertTriangle, Settings, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { collection, collectionGroup, query, onSnapshot, orderBy, limit, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'errors' | 'settings'>('users');
  const [bgInput, setBgInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [userMsvMap, setUserMsvMap] = useState<Record<string, string>>({});
  const [userStudentNameMap, setUserStudentNameMap] = useState<Record<string, string>>({});
  const [userClassMap, setUserClassMap] = useState<Record<string, string>>({});
  const [userMajorMap, setUserMajorMap] = useState<Record<string, string>>({});
  const [workspaceDataMap, setWorkspaceDataMap] = useState<Record<string, any>>({});
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [usageEvents, setUsageEvents] = useState<any[]>([]);
  const [syncErrors, setSyncErrors] = useState<any[]>([]);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'app_settings', 'global'));
        if (snap.exists()) {
          setBgInput(snap.data().backgroundImage || snap.data().bgUrl || '');
        }
      } catch (e) {}
    };
    fetchGlobalSettings();

    // Fetch MSV, Student Name, Class and Major for existing users using collectionGroup
    const fetchMsvs = async () => {
      try {
        const msvSnapshot = await getDocs(collectionGroup(db, 'workspaces'));
        const msvMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        const classMap: Record<string, string> = {};
        const majorMap: Record<string, string> = {};
        const wsMap: Record<string, any> = {};

        msvSnapshot.forEach(docSnap => {
          const userId = docSnap.ref.parent.parent?.id;
          if (userId) {
            msvMap[userId] = docSnap.id; // workspace.id is MSV
            const data = docSnap.data() || {};
            wsMap[userId] = { ...data, workspaceId: docSnap.id, docRef: docSnap.ref };
            const rawName = String(data.name || '').trim();
            // Extract student name if format is "Ngô Minh Thuận (2554104778)"
            const match = rawName.match(/^(.*?)\s*\(\d+\)$/);
            if (match && match[1] && !match[1].toLowerCase().startsWith('sinh viên')) {
              nameMap[userId] = match[1].trim();
            } else if (rawName && !rawName.toLowerCase().startsWith('sinh viên')) {
              nameMap[userId] = rawName;
            } else if (data.studentName) {
              nameMap[userId] = data.studentName;
            }

            if (data.className) {
              classMap[userId] = data.className;
            }
            if (data.major) {
              majorMap[userId] = data.major;
            }
          }
        });

        setUserMsvMap(msvMap);
        setUserStudentNameMap(nameMap);
        setUserClassMap(classMap);
        setUserMajorMap(majorMap);
        setWorkspaceDataMap(wsMap);

        // Asynchronously check grades for missing class info in existing workspaces
        msvSnapshot.docs.forEach(async (docSnap) => {
          const userId = docSnap.ref.parent.parent?.id;
          if (!userId) return;
          const data = docSnap.data() || {};
          if (!data.className || !data.major) {
            try {
              const gradeSnap = await getDoc(doc(db, 'users', userId, 'workspaces', docSnap.id, 'grades', 'data'));
              if (gradeSnap.exists()) {
                const gData = gradeSnap.data();
                if (Array.isArray(gData?.detailed)) {
                  let foundClass = '';
                  let foundMajor = '';
                  for (const item of gData.detailed) {
                    const c = item?.enrollmentClass?.className || item?.student?.enrollmentClass?.className || item?.enrollmentClass?.classCode;
                    const m = item?.speciality?.name || item?.student?.speciality?.name || item?.department?.name;
                    if (c && !foundClass) foundClass = String(c).trim();
                    if (m && !foundMajor) foundMajor = String(m).trim();
                    if (foundClass && foundMajor) break;
                  }
                  if (foundClass) {
                    setUserClassMap(prev => ({ ...prev, [userId]: foundClass }));
                    setDoc(docSnap.ref, { className: foundClass }, { merge: true }).catch(() => {});
                    setDoc(doc(db, 'users', userId), { className: foundClass }, { merge: true }).catch(() => {});
                  }
                  if (foundMajor) {
                    setUserMajorMap(prev => ({ ...prev, [userId]: foundMajor }));
                    setDoc(docSnap.ref, { major: foundMajor }, { merge: true }).catch(() => {});
                    setDoc(doc(db, 'users', userId), { major: foundMajor }, { merge: true }).catch(() => {});
                  }
                }
              }
            } catch (e) {}
          }
        });
      } catch (e) {
        console.error("Failed to fetch MSVs:", e);
      }
    };
    fetchMsvs();

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const data = snapshot.docs.map(doc => (({ id: doc.id, ...doc.data() } as any)));
      
      // Sắp xếp: Ai có hoạt động gần nhất (hoặc đăng nhập gần nhất) lên đầu
      data.sort((a, b) => {
        const timeA = a.lastActive ? new Date(a.lastActive).getTime() : (a.lastLogin ? new Date(a.lastLogin).getTime() : 0);
        const timeB = b.lastActive ? new Date(b.lastActive).getTime() : (b.lastLogin ? new Date(b.lastLogin).getTime() : 0);
        return timeB - timeA; // Descending
      });
      
      setUsers(data);
    });

    const unsubscribeUsage = onSnapshot(query(collection(db, 'usage_events'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      const data = snapshot.docs.map(doc => (({ id: doc.id, ...doc.data() } as any)));
      setUsageEvents(data);
    });

    const unsubscribeErrors = onSnapshot(query(collection(db, 'sync_errors'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
      const data = snapshot.docs.map(doc => (({ id: doc.id, ...doc.data() } as any)));
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

    const saveGlobalSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'app_settings', 'global'), {
        backgroundImage: bgInput
      }, { merge: true });
      alert("Đã lưu hình nền chung!");
    } catch (error) {
      console.error(error);
      alert("Lỗi khi lưu hình nền");
    }
    setIsSaving(false);
  };

  const handleSyncUserClass = async (userId: string) => {
    const wsData = workspaceDataMap[userId];
    const msv = userMsvMap[userId];
    if (!msv) return false;

    setSyncingUserId(userId);
    let updated = false;

    // 1. Try checking grades subcollection first
    try {
      const gradeSnap = await getDoc(doc(db, 'users', userId, 'workspaces', msv, 'grades', 'data'));
      if (gradeSnap.exists()) {
        const gData = gradeSnap.data();
        if (Array.isArray(gData?.detailed)) {
          let foundClass = '';
          let foundMajor = '';
          for (const item of gData.detailed) {
            const c = item?.enrollmentClass?.className || item?.student?.enrollmentClass?.className || item?.enrollmentClass?.classCode;
            const m = item?.speciality?.name || item?.student?.speciality?.name || item?.department?.name;
            if (c && !foundClass) foundClass = String(c).trim();
            if (m && !foundMajor) foundMajor = String(m).trim();
            if (foundClass && foundMajor) break;
          }
          if (foundClass) {
            setUserClassMap(prev => ({ ...prev, [userId]: foundClass }));
            await setDoc(doc(db, 'users', userId, 'workspaces', msv), { className: foundClass }, { merge: true });
            await setDoc(doc(db, 'users', userId), { className: foundClass }, { merge: true });
            updated = true;
          }
          if (foundMajor) {
            setUserMajorMap(prev => ({ ...prev, [userId]: foundMajor }));
            await setDoc(doc(db, 'users', userId, 'workspaces', msv), { major: foundMajor }, { merge: true });
            await setDoc(doc(db, 'users', userId), { major: foundMajor }, { merge: true });
          }
        }
      }
    } catch (e) {}

    // 2. If class still not found and password exists, query TLU directly
    if (!updated && wsData?.password) {
      try {
        const { auth } = await import('../firebase');
        const idToken = await auth.currentUser?.getIdToken();
        const bodyParams: any = {
          studentCode: msv,
          portal: wsData.portal || 'sinhvien1',
          syncTarget: 'user_info'
        };
        if (wsData.isEncrypted) {
          bodyParams.encryptedPassword = wsData.password;
        } else {
          try {
            bodyParams.password = decodeURIComponent(atob(wsData.password));
          } catch(e) {
            bodyParams.password = wsData.password;
          }
        }

        const res = await fetch('/api/tlu-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify(bodyParams)
        });

        if (res.ok) {
          const json = await res.json();
          if (json.className) {
            setUserClassMap(prev => ({ ...prev, [userId]: json.className }));
            await setDoc(doc(db, 'users', userId, 'workspaces', msv), { className: json.className }, { merge: true });
            await setDoc(doc(db, 'users', userId), { className: json.className }, { merge: true });
            updated = true;
          }
          if (json.major) {
            setUserMajorMap(prev => ({ ...prev, [userId]: json.major }));
            await setDoc(doc(db, 'users', userId, 'workspaces', msv), { major: json.major }, { merge: true });
            await setDoc(doc(db, 'users', userId), { major: json.major }, { merge: true });
          }
          if (json.studentName) {
            setUserStudentNameMap(prev => ({ ...prev, [userId]: json.studentName }));
            await setDoc(doc(db, 'users', userId), { displayName: json.studentName }, { merge: true });
          }
        }
      } catch (err) {
        console.error("TLU info query failed:", err);
      }
    }

    setSyncingUserId(null);
    return updated;
  };

  const handleSyncAllClasses = async () => {
    setIsBatchScanning(true);
    setBatchProgress({ current: 0, total: users.length });

    let updatedCount = 0;
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      setBatchProgress({ current: i + 1, total: users.length });
      if (userClassMap[u.id] || u.className) continue;
      try {
        const ok = await handleSyncUserClass(u.id);
        if (ok) updatedCount++;
      } catch (e) {}
    }

    setIsBatchScanning(false);
    alert(`Đã hoàn tất quét! Đã cập nhật lớp cho ${updatedCount} sinh viên.`);
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
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Settings className="w-4 h-4" /> Cài đặt chung
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
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">Danh sách người dùng ({users.length})</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tự động nhận diện mã sinh viên, tên thật, lớp học và ngành</p>
                </div>
                <button
                  onClick={handleSyncAllClasses}
                  disabled={isBatchScanning}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 active:scale-95 text-white transition-all disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isBatchScanning && "animate-spin")} />
                  {isBatchScanning 
                    ? `Đang quét & lấy lớp (${batchProgress.current}/${batchProgress.total})...`
                    : "⚡ Quét & Cập nhật Lớp cho tất cả"
                  }
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <th className="p-4 font-medium">Người dùng</th>
                      <th className="p-4 font-medium">MSV</th>
                      <th className="p-4 font-medium">Lớp</th>
                      <th className="p-4 font-medium">Ngành</th>
                      <th className="p-4 font-medium">Email</th>
                      <th className="p-4 font-medium">Trạng thái</th>
                      <th className="p-4 font-medium">Lần cuối đăng nhập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="p-4 text-gray-900 dark:text-gray-100 font-medium">
                          {(() => {
                            const isGeneric = !u.displayName || u.displayName === 'Sinh viên' || u.displayName === 'Sinh viên TLU' || u.displayName === 'Khách';
                            const workspaceStudentName = userStudentNameMap[u.id];

                            if (!isGeneric) {
                              return (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-gray-900 dark:text-white">{u.displayName}</span>
                                  {workspaceStudentName && workspaceStudentName.toLowerCase() !== u.displayName.toLowerCase() && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-normal">
                                      {workspaceStudentName}
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            if (workspaceStudentName) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-blue-600 dark:text-blue-400">{workspaceStudentName}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    TLU
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <span className="text-gray-400 dark:text-gray-500 italic">
                                {u.displayName || 'Khách (chưa đồng bộ)'}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300 font-mono text-sm">
                          {userMsvMap[u.id] || u.msv || u.studentId || 'Chưa có'}
                        </td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          {userClassMap[u.id] || u.className ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {userClassMap[u.id] || u.className}
                            </span>
                          ) : userMsvMap[u.id] ? (
                            <button
                              onClick={() => handleSyncUserClass(u.id)}
                              disabled={syncingUserId === u.id || isBatchScanning}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 transition-colors"
                              title="Bấm để quét lớp và ngành cho sinh viên này"
                            >
                              <RefreshCw className={cn("w-3 h-3", syncingUserId === u.id && "animate-spin")} />
                              {syncingUserId === u.id ? "Đang lấy..." : "Tìm lớp"}
                            </button>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs italic">Chưa rõ</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-700 dark:text-gray-300 text-sm max-w-[200px] truncate" title={userMajorMap[u.id] || u.major || ''}>
                          {userMajorMap[u.id] || u.major ? (
                            <span className="font-medium text-gray-800 dark:text-gray-200">{userMajorMap[u.id] || u.major}</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs italic">Chưa rõ</span>
                          )}
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
                        <td colSpan={7} className="p-8 text-center text-gray-500">
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
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-500" />
                  Đổi hình nền toàn cục
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
                  <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-64 relative">
                    <img src={bgInput} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <button 
                  onClick={saveGlobalSettings} 
                  disabled={isSaving}
                  className="mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu hình nền'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
