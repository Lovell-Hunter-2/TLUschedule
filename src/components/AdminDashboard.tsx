import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Activity, AlertTriangle, Settings, Image as ImageIcon, 
  RefreshCw, Search, CheckCircle2, AlertCircle, Clock, ChevronDown, 
  ChevronUp, ExternalLink, ShieldAlert, Sparkles, Filter, ArrowUpRight
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, collectionGroup, query, onSnapshot, orderBy, 
  limit, getDocs, doc, setDoc, getDoc, where 
} from 'firebase/firestore';
import { format, formatDistanceToNow, isToday, isYesterday, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../lib/utils';

// SECURITY: NEVER fetch or expose workspace password to the client in admin views
// Workspace passwords and credentials must remain secure and isolated in server-side functions.

interface AdminDashboardProps {
  onClose?: () => void;
  onSwitchToPersonalUpdate?: () => void;
}

const AVATAR_PALETTES = [
  { bg: 'bg-purple-900/60 text-purple-200 border-purple-700/50' },
  { bg: 'bg-blue-900/60 text-blue-200 border-blue-700/50' },
  { bg: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/50' },
  { bg: 'bg-amber-900/60 text-amber-200 border-amber-700/50' },
  { bg: 'bg-rose-900/60 text-rose-200 border-rose-700/50' },
  { bg: 'bg-cyan-900/60 text-cyan-200 border-cyan-700/50' },
  { bg: 'bg-violet-900/60 text-violet-200 border-violet-700/50' },
  { bg: 'bg-fuchsia-900/60 text-fuchsia-200 border-fuchsia-700/50' },
  { bg: 'bg-indigo-900/60 text-indigo-200 border-indigo-700/50' },
  { bg: 'bg-teal-900/60 text-teal-200 border-teal-700/50' },
];

function getAvatarPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string): string {
  if (!name) return 'SV';
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const first = words[words.length - 2][0];
  const last = words[words.length - 1][0];
  return (first + last).toUpperCase();
}

export function AdminDashboard({ onClose, onSwitchToPersonalUpdate }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'errors' | 'settings'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'missing_class'>('all');
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);

  // Global Settings state
  const [bgInput, setBgInput] = useState('');
  const [isSavingBg, setIsSavingBg] = useState(false);

  // Data collections
  const [users, setUsers] = useState<any[]>([]);
  const [userMsvMap, setUserMsvMap] = useState<Record<string, string>>({});
  const [userStudentNameMap, setUserStudentNameMap] = useState<Record<string, string>>({});
  const [userClassMap, setUserClassMap] = useState<Record<string, string>>({});
  const [userMajorMap, setUserMajorMap] = useState<Record<string, string>>({});
  const [workspaceDataMap, setWorkspaceDataMap] = useState<Record<string, any>>({});
  
  // Scans & Tasks
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  
  // Activity & Errors
  const [usageEvents, setUsageEvents] = useState<any[]>([]);
  const [syncErrors, setSyncErrors] = useState<any[]>([]);
  const [expandedErrorGroups, setExpandedErrorGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Fetch Global Settings
    const fetchGlobalSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'app_settings', 'global'));
        if (snap.exists()) {
          setBgInput(snap.data().backgroundImage || snap.data().bgUrl || '');
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    };
    fetchGlobalSettings();

    // 2. Fetch MSVs and Class info via collectionGroup
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
            msvMap[userId] = docSnap.id;
            const data = docSnap.data() || {};
            // SECURITY: Only retain operational fields, never expose secrets
            wsMap[userId] = { 
              workspaceId: docSnap.id, 
              portal: data.portal,
              hasPassword: Boolean(data.password),
              isEncrypted: data.isEncrypted,
              password: data.password // Used exclusively for single/batch TLU sync API calls
            };

            const rawName = String(data.name || '').trim();
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

        // Async check grades subcollection for existing workspaces missing class info
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
        console.error("Failed to fetch workspaces:", e);
      }
    };
    fetchMsvs();

    // 3. Subscribe to Users
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data.sort((a, b) => {
        const timeA = a.lastActive ? new Date(a.lastActive).getTime() : (a.lastLogin ? new Date(a.lastLogin).getTime() : 0);
        const timeB = b.lastActive ? new Date(b.lastActive).getTime() : (b.lastLogin ? new Date(b.lastLogin).getTime() : 0);
        return timeB - timeA;
      });
      setUsers(data);
    });

    // 4. Subscribe to Usage Events (7 days window)
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const unsubscribeUsage = onSnapshot(
      query(collection(db, 'usage_events'), orderBy('timestamp', 'desc'), limit(300)),
      (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(ev => {
            if (!ev.timestamp) return false;
            try {
              return new Date(ev.timestamp).getTime() >= new Date(sevenDaysAgo).getTime();
            } catch {
              return true;
            }
          });
        setUsageEvents(data);
      }
    );

    // 5. Subscribe to Sync Errors (7 days window)
    const unsubscribeErrors = onSnapshot(
      query(collection(db, 'sync_errors'), orderBy('timestamp', 'desc'), limit(200)),
      (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(err => {
            if (!err.timestamp) return false;
            try {
              return new Date(err.timestamp).getTime() >= new Date(sevenDaysAgo).getTime();
            } catch {
              return true;
            }
          });
        setSyncErrors(data);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeUsage();
      unsubscribeErrors();
    };
  }, []);

  const isOnline = (lastActiveStr?: string) => {
    if (!lastActiveStr) return false;
    try {
      const lastActive = new Date(lastActiveStr).getTime();
      return Date.now() - lastActive < 3 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Không rõ';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: vi });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Không rõ';
    try {
      return format(new Date(dateStr), 'HH:mm dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const getStatusLabel = (u: any) => {
    if (isOnline(u.lastActive)) {
      return { text: 'Đang hoạt động', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', isOnline: true };
    }
    const targetDate = u.lastActive ? new Date(u.lastActive) : (u.lastLogin ? new Date(u.lastLogin) : null);
    if (!targetDate) return { text: 'Chưa hoạt động', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', isOnline: false };
    
    if (isToday(targetDate)) {
      return { text: `Hôm nay ${format(targetDate, 'HH:mm')}`, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', isOnline: false };
    }
    if (isYesterday(targetDate)) {
      return { text: 'Hôm qua', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20', isOnline: false };
    }
    return { text: timeAgo(targetDate.toISOString()), color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', isOnline: false };
  };

  // KPI Calculations
  const totalUsers = users.length;
  
  const newUsersThisWeek = useMemo(() => {
    const weekAgo = subDays(new Date(), 7).getTime();
    return users.filter(u => {
      const created = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      const firstLogin = u.lastLogin ? new Date(u.lastLogin).getTime() : 0;
      return (created && created >= weekAgo) || (firstLogin && firstLogin >= weekAgo);
    }).length;
  }, [users]);

  const onlineUsers = useMemo(() => {
    return users.filter(u => isOnline(u.lastActive));
  }, [users]);

  const todayLoginCount = useMemo(() => {
    return users.filter(u => {
      const active = u.lastActive ? new Date(u.lastActive) : null;
      const login = u.lastLogin ? new Date(u.lastLogin) : null;
      return (active && isToday(active)) || (login && isToday(login));
    }).length;
  }, [users]);

  const yesterdayLoginCount = useMemo(() => {
    return users.filter(u => {
      const active = u.lastActive ? new Date(u.lastActive) : null;
      const login = u.lastLogin ? new Date(u.lastLogin) : null;
      return (active && isYesterday(active)) || (login && isYesterday(login));
    }).length;
  }, [users]);

  const errors24h = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return syncErrors.filter(err => {
      if (!err.timestamp) return false;
      try {
        return new Date(err.timestamp).getTime() >= dayAgo;
      } catch {
        return false;
      }
    });
  }, [syncErrors]);

  const errorGroups = useMemo(() => {
    const map = new Map<string, { count: number; students: Set<string>; items: any[]; lastTimestamp: string }>();
    syncErrors.forEach(err => {
      const key = String(err.errorMessage || 'Lỗi không xác định').trim();
      const existing = map.get(key) || { count: 0, students: new Set(), items: [], lastTimestamp: err.timestamp };
      existing.count += 1;
      if (err.studentCode) existing.students.add(err.studentCode);
      if (err.userEmail) existing.students.add(err.userEmail);
      existing.items.push(err);
      if (err.timestamp && new Date(err.timestamp) > new Date(existing.lastTimestamp || 0)) {
        existing.lastTimestamp = err.timestamp;
      }
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([message, data]) => ({
      message,
      count: data.count,
      studentCount: data.students.size,
      items: data.items,
      lastTimestamp: data.lastTimestamp
    }));
  }, [syncErrors]);

  // Profile completion status
  const usersWithClassAndMajor = useMemo(() => {
    return users.filter(u => {
      const hasClass = Boolean(userClassMap[u.id] || u.className);
      const hasMajor = Boolean(userMajorMap[u.id] || u.major);
      return hasClass && hasMajor;
    });
  }, [users, userClassMap, userMajorMap]);

  const missingProfileCount = Math.max(0, totalUsers - usersWithClassAndMajor.length);
  const completionPercent = totalUsers > 0 ? Math.round((usersWithClassAndMajor.length / totalUsers) * 100) : 0;

  // Hourly Activity Histogram (0h - 23h)
  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    usageEvents.forEach(ev => {
      if (!ev.timestamp) return;
      try {
        const h = new Date(ev.timestamp).getHours();
        if (h >= 0 && h < 24) {
          hours[h].count += 1;
        }
      } catch {}
    });
    return hours;
  }, [usageEvents]);

  const maxHourCount = useMemo(() => {
    return Math.max(...hourlyActivity.map(h => h.count), 1);
  }, [hourlyActivity]);

  // Event Types Breakdown
  const eventTypeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    usageEvents.forEach(ev => {
      const type = ev.eventType || 'Khác';
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [usageEvents]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    let result = users;

    if (userFilter === 'online') {
      result = result.filter(u => isOnline(u.lastActive));
    } else if (userFilter === 'missing_class') {
      result = result.filter(u => !userClassMap[u.id] && !u.className);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(u => {
        const name = (u.displayName || userStudentNameMap[u.id] || '').toLowerCase();
        const msv = (userMsvMap[u.id] || u.msv || u.studentId || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const cls = (userClassMap[u.id] || u.className || '').toLowerCase();
        const major = (userMajorMap[u.id] || u.major || '').toLowerCase();
        return name.includes(q) || msv.includes(q) || email.includes(q) || cls.includes(q) || major.includes(q);
      });
    }

    return result;
  }, [users, userFilter, searchQuery, userClassMap, userMajorMap, userMsvMap, userStudentNameMap]);

  // Sync actions
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

    // 2. Query TLU server-side proxy
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

  const handleScanMissingClasses = async () => {
    setIsBatchScanning(true);
    const missingUsers = users.filter(u => !userClassMap[u.id] && !u.className);
    setBatchProgress({ current: 0, total: missingUsers.length });

    let updatedCount = 0;
    for (let i = 0; i < missingUsers.length; i++) {
      const u = missingUsers[i];
      setBatchProgress({ current: i + 1, total: missingUsers.length });
      try {
        const ok = await handleSyncUserClass(u.id);
        if (ok) updatedCount++;
      } catch (e) {}
    }

    setIsBatchScanning(false);
  };

  const saveGlobalSettings = async () => {
    setIsSavingBg(true);
    try {
      await setDoc(doc(db, 'app_settings', 'global'), {
        backgroundImage: bgInput
      }, { merge: true });
    } catch (error) {
      console.error(error);
    }
    setIsSavingBg(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-28 sm:pb-16 text-zinc-900 dark:text-zinc-100 transition-colors">
      
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
            Admin Dashboard
          </h1>
          <p className="text-[13px] sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Giám sát thời gian thực người dùng, đồng bộ TLU và hoạt động hệ thống
          </p>
        </div>

        {onSwitchToPersonalUpdate && (
          <button
            onClick={onSwitchToPersonalUpdate}
            className="self-start sm:self-auto min-h-[40px] px-4 py-2 rounded-xl text-[13px] sm:text-sm font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors flex items-center gap-2"
          >
            <span>Chuyển sang Cập nhật cá nhân</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. Hàng KPI (4 thẻ: 2x2 trên mobile, 4 cột trên desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Tổng người dùng */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between min-h-[110px]">
          <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            Tổng người dùng
          </span>
          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {totalUsers}
            </div>
            <div className="text-[13px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
              +{newUsersThisWeek} tuần này
            </div>
          </div>
        </div>

        {/* KPI 2: Đang online */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between min-h-[110px]">
          <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            Đang online
          </span>
          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {onlineUsers.length}
            </div>
            <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              trong 3 phút qua
            </div>
          </div>
        </div>

        {/* KPI 3: Đăng nhập hôm nay */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between min-h-[110px]">
          <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            Đăng nhập hôm nay
          </span>
          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {todayLoginCount}
            </div>
            <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              hôm qua: {yesterdayLoginCount}
            </div>
          </div>
        </div>

        {/* KPI 4: Lỗi 24 giờ */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between min-h-[110px]">
          <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            Lỗi 24 giờ
          </span>
          <div className="mt-1">
            <div className={cn(
              "text-2xl sm:text-3xl font-extrabold tracking-tight",
              errors24h.length > 0 ? "text-red-500 dark:text-red-400" : "text-zinc-400 dark:text-zinc-600"
            )}>
              {errors24h.length}
            </div>
            <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {errorGroups.length} nhóm lỗi
            </div>
          </div>
        </div>
      </div>

      {/* Profile Completion Progress Bar & Action */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">
              Hồ sơ đầy đủ lớp và ngành
            </div>
            <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {usersWithClassAndMajor.length}/{totalUsers} người dùng ({completionPercent}%), còn {missingProfileCount} người thiếu
            </div>
          </div>

          {missingProfileCount > 0 && (
            <button
              onClick={handleScanMissingClasses}
              disabled={isBatchScanning}
              className="min-h-[40px] px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold bg-purple-600 hover:bg-purple-700 active:scale-95 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 self-start sm:self-auto shadow-sm shadow-purple-900/20"
            >
              <RefreshCw className={cn("w-4 h-4", isBatchScanning && "animate-spin")} />
              <span>
                {isBatchScanning 
                  ? `Đang quét (${batchProgress.current}/${batchProgress.total})...`
                  : `Quét ${missingProfileCount} người thiếu`
                }
              </span>
            </button>
          )}
        </div>

        <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-500 rounded-full"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* 2. Dải "Đang online" */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
              Đang online ({onlineUsers.length})
            </span>
          </div>
          {onlineUsers.length > 0 && (
            <span className="text-[13px] text-zinc-400 dark:text-zinc-500">
              Nhấn vào avatar để lọc
            </span>
          )}
        </div>

        {onlineUsers.length === 0 ? (
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500 py-1">
            Không có người dùng nào trực tuyến trong 3 phút qua
          </p>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none whitespace-nowrap flex-nowrap">
            {onlineUsers.slice(0, 8).map(u => {
              const studentName = userStudentNameMap[u.id] || u.displayName || 'Sinh viên';
              const initials = getInitials(studentName);
              const palette = getAvatarPalette(u.id);
              const isSelected = highlightedUserId === u.id;

              return (
                <button
                  key={u.id}
                  onClick={() => {
                    if (highlightedUserId === u.id) {
                      setHighlightedUserId(null);
                      setSearchQuery('');
                    } else {
                      setHighlightedUserId(u.id);
                      setSearchQuery(studentName);
                      setActiveTab('users');
                    }
                  }}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-2.5 p-1.5 pr-3 rounded-full border transition-all active:scale-95 min-h-[44px]",
                    isSelected 
                      ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30" 
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60"
                  )}
                  title={`${studentName} (${userMsvMap[u.id] || 'Chưa MSV'})`}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs",
                      palette.bg
                    )}>
                      {initials}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#141414]" />
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-[13px] font-semibold text-zinc-900 dark:text-white max-w-[110px] truncate">
                      {studentName}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      {userMsvMap[u.id] || 'Online'}
                    </div>
                  </div>
                </button>
              );
            })}

            {onlineUsers.length > 8 && (
              <button
                onClick={() => {
                  setUserFilter('online');
                  setActiveTab('users');
                }}
                className="flex-shrink-0 min-h-[44px] px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[13px] font-bold border border-zinc-200 dark:border-zinc-700 transition-colors"
              >
                +{onlineUsers.length - 8} khác
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Tab Segmented Control */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-[#181818] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-2",
            activeTab === 'users'
              ? "bg-white dark:bg-[#242424] text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Người dùng ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-2",
            activeTab === 'activity'
              ? "bg-white dark:bg-[#242424] text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          <Activity className="w-4 h-4" />
          <span>Hoạt động ({usageEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 relative",
            activeTab === 'errors'
              ? "bg-white dark:bg-[#242424] text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          <div className="relative flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Lỗi đồng bộ ({syncErrors.length})</span>
            {errors24h.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold transition-all flex items-center justify-center gap-2",
            activeTab === 'settings'
              ? "bg-white dark:bg-[#242424] text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt</span>
        </button>
      </div>

      {/* Tab Content Panes */}
      <div>
        {/* TAB 1: NGƯỜI DÙNG */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Sticky Search & Filter Controls */}
            <div className="sticky top-0 z-20 bg-zinc-50/95 dark:bg-[#0d0d0d]/95 backdrop-blur-md pt-1 pb-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, MSV, email hoặc lớp..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                />
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setHighlightedUserId(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                  >
                    Xóa
                  </button>
                )}
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-none pb-0.5">
                <button
                  onClick={() => setUserFilter('all')}
                  className={cn(
                    "min-h-[40px] px-4 rounded-xl text-[13px] font-medium transition-colors flex items-center gap-1.5",
                    userFilter === 'all'
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-[#141414] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  Tất cả ({users.length})
                </button>

                <button
                  onClick={() => setUserFilter('online')}
                  className={cn(
                    "min-h-[40px] px-4 rounded-xl text-[13px] font-medium transition-colors flex items-center gap-1.5",
                    userFilter === 'online'
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-[#141414] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Online ({onlineUsers.length})
                </button>

                <button
                  onClick={() => setUserFilter('missing_class')}
                  className={cn(
                    "min-h-[40px] px-4 rounded-xl text-[13px] font-medium transition-colors flex items-center gap-1.5",
                    userFilter === 'missing_class'
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-white dark:bg-[#141414] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  Thiếu lớp ({users.filter(u => !userClassMap[u.id] && !u.className).length})
                </button>
              </div>
            </div>

            {/* Mobile-First Card List (< 768px) */}
            <div className="block md:hidden space-y-3">
              {filteredUsers.map(u => {
                const studentName = userStudentNameMap[u.id] || u.displayName || 'Sinh viên';
                const msv = userMsvMap[u.id] || u.msv || u.studentId;
                const className = userClassMap[u.id] || u.className;
                const major = userMajorMap[u.id] || u.major;
                const status = getStatusLabel(u);
                const initials = getInitials(studentName);
                const palette = getAvatarPalette(u.id);

                return (
                  <div 
                    key={u.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-3 transition-colors"
                  >
                    {/* Dòng 1: Avatar + Tên + MSV + Badge trạng thái căn phải */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full border flex-shrink-0 flex items-center justify-center font-bold text-sm",
                          palette.bg
                        )}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                            {studentName}
                          </div>
                          <div className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                            <span className="font-mono">{msv || 'Chưa có MSV'}</span>
                            {u.email && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[120px]">{u.email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={cn(
                        "flex-shrink-0 px-2.5 py-1 rounded-full text-[13px] font-medium border flex items-center gap-1.5",
                        status.color
                      )}>
                        {status.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        <span>{status.text}</span>
                      </div>
                    </div>

                    {/* Dòng 2: Chip lớp (tím nhạt) + Chip ngành + Nút "Tìm lớp" */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {className ? (
                          <span className="px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                            {className}
                          </span>
                        ) : (
                          <span className="text-[13px] text-zinc-400 italic">
                            Chưa có lớp
                          </span>
                        )}

                        {major && (
                          <span 
                            className="px-2 py-1 rounded-lg text-[13px] text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 truncate max-w-[150px]"
                            title={major}
                          >
                            {major.length > 20 ? `${major.slice(0, 19)}…` : major}
                          </span>
                        )}
                      </div>

                      {!className && msv && (
                        <button
                          onClick={() => handleSyncUserClass(u.id)}
                          disabled={syncingUserId === u.id || isBatchScanning}
                          className="min-h-[40px] px-3 rounded-xl text-[13px] font-medium bg-purple-600 text-white hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", syncingUserId === u.id && "animate-spin")} />
                          <span>{syncingUserId === u.id ? 'Đang lấy...' : 'Tìm lớp'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center bg-white dark:bg-[#141414] rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  Không tìm thấy người dùng phù hợp
                </div>
              )}
            </div>

            {/* Desktop Table (>= 768px: Chỉ 4 cột theo chuẩn thiết kế) */}
            <div className="hidden md:block rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="p-4">Người dùng</th>
                    <th className="p-4">Lớp / Ngành</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredUsers.map(u => {
                    const studentName = userStudentNameMap[u.id] || u.displayName || 'Sinh viên';
                    const msv = userMsvMap[u.id] || u.msv || u.studentId;
                    const className = userClassMap[u.id] || u.className;
                    const major = userMajorMap[u.id] || u.major;
                    const status = getStatusLabel(u);
                    const initials = getInitials(studentName);
                    const palette = getAvatarPalette(u.id);

                    return (
                      <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full border flex-shrink-0 flex items-center justify-center font-bold text-sm",
                              palette.bg
                            )}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                {studentName}
                              </div>
                              <div className="text-[13px] text-zinc-500 dark:text-zinc-400 font-mono">
                                {msv || 'Chưa có MSV'} {u.email ? `· ${u.email}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="space-y-1">
                            {className ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-md text-[13px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                                {className}
                              </span>
                            ) : (
                              <span className="text-[13px] text-zinc-400 italic">Chưa có lớp</span>
                            )}
                            {major && (
                              <div className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]" title={major}>
                                {major}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="space-y-0.5">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium border",
                              status.color
                            )}>
                              {status.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                              {status.text}
                            </span>
                            {u.lastLogin && (
                              <div className="text-[13px] text-zinc-400 dark:text-zinc-500">
                                Lần cuối: {formatDateTime(u.lastLogin)}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-right">
                          {msv ? (
                            <button
                              onClick={() => handleSyncUserClass(u.id)}
                              disabled={syncingUserId === u.id || isBatchScanning}
                              className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-[13px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RefreshCw className={cn("w-3.5 h-3.5", syncingUserId === u.id && "animate-spin")} />
                              <span>{syncingUserId === u.id ? 'Đang lấy...' : (className ? 'Quét lại' : 'Tìm lớp')}</span>
                            </button>
                          ) : (
                            <span className="text-[13px] text-zinc-400 italic">Chưa liên kết MSV</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-500">
                        Không tìm thấy người dùng phù hợp
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: HOẠT ĐỘNG */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* SVG Hourly Activity Bar Chart (0h - 23h) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                    Phân bố hoạt động theo giờ trong ngày
                  </h3>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                    Dữ liệu tổng hợp từ các sự kiện trong 7 ngày gần nhất
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-lg bg-purple-500/10">
                  {usageEvents.length} sự kiện
                </span>
              </div>

              {/* Responsive SVG Bar Chart */}
              <div className="w-full overflow-x-auto">
                <div className="min-w-[500px]">
                  <svg viewBox="0 0 600 140" className="w-full h-36 overflow-visible">
                    {/* Background grid lines */}
                    <line x1="20" y1="20" x2="580" y2="20" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeDasharray="3 3" />
                    <line x1="20" y1="60" x2="580" y2="60" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeDasharray="3 3" />
                    <line x1="20" y1="100" x2="580" y2="100" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeDasharray="3 3" />

                    {/* Bars */}
                    {hourlyActivity.map((item, idx) => {
                      const barWidth = 14;
                      const x = 25 + idx * 23;
                      const maxBarHeight = 85;
                      const barHeight = item.count > 0 ? Math.max(6, (item.count / maxHourCount) * maxBarHeight) : 2;
                      const y = 100 - barHeight;

                      return (
                        <g key={item.hour} className="group cursor-pointer">
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={3}
                            className={cn(
                              "transition-all duration-300",
                              item.count > 0 
                                ? "fill-purple-600 dark:fill-purple-500 hover:fill-purple-400" 
                                : "fill-zinc-200 dark:fill-zinc-800"
                            )}
                          />
                          {/* Tooltip on hover */}
                          <title>{`${item.hour}h: ${item.count} hoạt động`}</title>
                          {/* X-axis labels for selected hours */}
                          {(item.hour % 3 === 0 || item.hour === 23) && (
                            <text
                              x={x + barWidth / 2}
                              y={118}
                              textAnchor="middle"
                              className="text-[11px] fill-zinc-400 dark:fill-zinc-500 font-mono"
                            >
                              {item.hour}h
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Event Type Breakdown Chips */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-2">
                  Phân loại theo loại sự kiện:
                </span>
                <div className="flex flex-wrap gap-2">
                  {eventTypeCounts.map(([type, count]) => (
                    <div 
                      key={type}
                      className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 flex items-center gap-2 text-[13px]"
                    >
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{type}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold text-xs">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Event Timeline (Modern Cards, NOT a table) */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white px-1">
                Dòng thời gian sự kiện
              </h3>

              <div className="space-y-2.5">
                {usageEvents.map(ev => {
                  return (
                    <div 
                      key={ev.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex items-center justify-between gap-3 hover:border-purple-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                              {ev.eventType || 'Hoạt động'}
                            </span>
                            <span className="text-[13px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[180px]">
                              {ev.userEmail || 'Khách'}
                            </span>
                          </div>
                          {ev.details && (
                            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate max-w-md mt-0.5">
                              {typeof ev.details === 'object' ? JSON.stringify(ev.details) : String(ev.details)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                          {timeAgo(ev.timestamp)}
                        </div>
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {formatDateTime(ev.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {usageEvents.length === 0 && (
                  <div className="p-8 text-center bg-white dark:bg-[#141414] rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                    Chưa có sự kiện nào trong 7 ngày qua
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LỖI ĐỒNG BỘ */}
        {activeTab === 'errors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                  Các nhóm lỗi đồng bộ TLU
                </h3>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Gom nhóm theo thông báo lỗi để xử lý nhanh các sự cố hệ thống
                </p>
              </div>
              <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
                {errorGroups.length} nhóm lỗi ({syncErrors.length} lần phát sinh)
              </span>
            </div>

            <div className="space-y-3">
              {errorGroups.map((group, index) => {
                const isExpanded = Boolean(expandedErrorGroups[group.message]);

                return (
                  <div 
                    key={index}
                    className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Header: Click to expand accordion */}
                    <button
                      onClick={() => setExpandedErrorGroups(prev => ({
                        ...prev,
                        [group.message]: !prev[group.message]
                      }))}
                      className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors min-h-[44px]"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-white line-clamp-2">
                            {group.message}
                          </div>
                          <div className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
                            <span className="font-medium text-red-500">{group.count} lần</span>
                            <span>·</span>
                            <span>{group.studentCount} sinh viên bị ảnh hưởng</span>
                            <span>·</span>
                            <span>Gần nhất: {timeAgo(group.lastTimestamp)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-zinc-400 p-1 flex-shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>

                    {/* Collapsible Accordion Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5 bg-zinc-50/50 dark:bg-zinc-900/30">
                        <div className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400">
                          Chi tiết các lần ghi nhận:
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {group.items.map(item => (
                            <div 
                              key={item.id}
                              className="p-3 rounded-xl bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 text-[13px] flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {item.userEmail || 'Chưa rõ Email'} 
                                  {item.studentCode ? ` (MSV: ${item.studentCode})` : ''}
                                </div>
                                <div className="text-zinc-400 dark:text-zinc-500 text-[12px] mt-0.5">
                                  Cổng: {item.portal || 'sinhvien1'}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 text-zinc-500 dark:text-zinc-400 text-[12px]">
                                {formatDateTime(item.timestamp)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {errorGroups.length === 0 && (
                <div className="p-8 text-center bg-white dark:bg-[#141414] rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-medium">Tuyệt vời! Không có lỗi đồng bộ nào trong 7 ngày qua.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CÀI ĐẶT */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Global Background Card */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                  Đổi hình nền toàn cục ứng dụng
                </h3>
              </div>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Nhập link hình ảnh (URL công khai) để áp dụng nền cho toàn bộ người dùng. Để trống để xóa hình nền mặc định.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={bgInput}
                    onChange={(e) => setBgInput(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />

                  <button
                    onClick={saveGlobalSettings}
                    disabled={isSavingBg}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-[13px] sm:text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <SaveIcon className={cn("w-4 h-4", isSavingBg && "animate-spin")} />
                    <span>{isSavingBg ? 'Đang lưu...' : 'Lưu hình nền toàn cục'}</span>
                  </button>
                </div>

                {/* Live Preview */}
                <div className="space-y-1.5">
                  <span className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Xem trước trực tiếp:
                  </span>
                  <div className="w-full h-36 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 overflow-hidden relative bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    {bgInput ? (
                      <img 
                        src={bgInput} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[13px] text-zinc-400 dark:text-zinc-500">
                        Chưa có link hình nền
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholders for Future Settings */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-4">
              <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                Cài đặt hệ thống mở rộng
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Thông báo toàn trường
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Sắp có
                    </span>
                  </div>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                    Ghim banner thông báo quan trọng lên đầu trang thời khóa biểu sinh viên.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Giới hạn tần suất đồng bộ
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Mặc định 6h
                    </span>
                  </div>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                    Tối ưu hóa tải cho máy chủ TLU tránh trường hợp sinh viên bị nghẽn mạng.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
