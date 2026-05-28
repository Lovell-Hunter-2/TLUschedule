export interface Period {
  id: number;
  startTime: string;
  endTime: string;
  session: 'Sáng' | 'Chiều' | 'Tối';
}

export const PERIODS: Period[] = [
  { id: 1, startTime: '07:00', endTime: '07:50', session: 'Sáng' },
  { id: 2, startTime: '07:55', endTime: '08:45', session: 'Sáng' },
  { id: 3, startTime: '08:50', endTime: '09:40', session: 'Sáng' },
  { id: 4, startTime: '09:45', endTime: '10:35', session: 'Sáng' },
  { id: 5, startTime: '10:40', endTime: '11:30', session: 'Sáng' },
  { id: 6, startTime: '11:35', endTime: '12:25', session: 'Sáng' },
  { id: 7, startTime: '12:55', endTime: '13:45', session: 'Chiều' },
  { id: 8, startTime: '13:50', endTime: '14:40', session: 'Chiều' },
  { id: 9, startTime: '14:45', endTime: '15:35', session: 'Chiều' },
  { id: 10, startTime: '15:40', endTime: '16:30', session: 'Chiều' },
  { id: 11, startTime: '16:35', endTime: '17:25', session: 'Chiều' },
  { id: 12, startTime: '17:30', endTime: '18:20', session: 'Chiều' },
  { id: 13, startTime: '18:50', endTime: '19:40', session: 'Tối' },
  { id: 14, startTime: '19:45', endTime: '20:35', session: 'Tối' },
  { id: 15, startTime: '20:40', endTime: '21:30', session: 'Tối' },
];

export interface Subject {
  id: string;
  name: string;
  room?: string;
  lecturer?: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  daysOfWeek: number[]; // 0 (Sun) to 6 (Sat)
  periods: number[]; // Array of period IDs (1-15)
  color: string;
  semesterId?: number;
  semesterName?: string;
}

export interface Note {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  content: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName: string;
  studentId?: string;
}

export interface Workspace {
  id: string;
  name: string;
  password?: string;
}
