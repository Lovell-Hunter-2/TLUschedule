import { Subject } from '../types';
import { normalizeSubjectName } from './utils';

export function parseTluTimetable(tb: any): {
  room: string;
  lecturer: string;
  startDate: string;
  endDate: string;
  dayIndex: number;
  periods: number[];
} | null {
  if (!tb) return null;

  // 1. Day of week (CMC weekIndex: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat)
  const rawWeek = tb.weekIndex;
  if (rawWeek === null || rawWeek === undefined || typeof rawWeek !== 'number' || rawWeek < 1 || rawWeek > 7) {
    return null; // Skip invalid or unscheduled day
  }
  const dayIndex = rawWeek === 1 ? 0 : rawWeek - 1;

  // 2. Periods (strictly 1 to 16)
  const extractPeriod = (hourObj: any): number | null => {
    if (hourObj === null || hourObj === undefined) return null;
    if (typeof hourObj === 'number' && hourObj >= 1 && hourObj <= 16) return hourObj;
    if (typeof hourObj === 'object') {
      const idx = hourObj.index ?? hourObj.id;
      if (typeof idx === 'number' && idx >= 1 && idx <= 16) return idx;
      hourObj = hourObj.name || hourObj.index || '';
    }
    const str = String(hourObj).trim();
    // Match strictly 1..16 without capturing academic years (e.g., 2024, 2027)
    const m = str.match(/\b([1-9]|1[0-6])\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 16) return n;
    }
    return null;
  };

  let sPeriod = extractPeriod(tb.startHour);
  let ePeriod = extractPeriod(tb.endHour);

  if (sPeriod === null && ePeriod === null) {
    return null; // Skip if no period info
  }
  if (sPeriod === null && ePeriod !== null) sPeriod = ePeriod;
  if (ePeriod === null && sPeriod !== null) ePeriod = sPeriod;
  if (sPeriod! > ePeriod!) {
    const tmp = sPeriod;
    sPeriod = ePeriod;
    ePeriod = tmp;
  }

  // Guard max 6 periods per class session (e.g., 1-3, 7-9, 4-6, 10-12)
  if (ePeriod! - sPeriod! > 6) {
    ePeriod = sPeriod! + 2;
  }

  const periods: number[] = [];
  for (let i = sPeriod!; i <= ePeriod!; i++) {
    periods.push(i);
  }

  // 3. Lecturer
  const rawLecturer = (tb?.teacher?.displayName || tb?.teacher?.name || tb?.teacherName || '').trim();
  const isInvalidLecturer = /^(lý\s*thuyết|thực\s*hành|bài\s*tập|tự\s*học|thao\s*trường|trực\s*tuyến|chưa\s*cập\s*nhật|chưa\s*phân\s*công|đang\s*cập\s*nhật|none|null|undefined|[\-–—._]+)$/i.test(rawLecturer);
  const lecturer = isInvalidLecturer ? '' : rawLecturer;

  // 4. Room
  const room = (tb?.room?.name || tb?.room?.code || tb?.roomName || '').trim();

  // 5. Start and End Date
  let sDate = tb?.startDate ? String(tb.startDate).split('T')[0] : '';
  let eDate = tb?.endDate ? String(tb.endDate).split('T')[0] : '';
  if (!sDate) sDate = new Date().toISOString().split('T')[0];
  if (!eDate) eDate = sDate;

  return {
    room,
    lecturer,
    startDate: sDate,
    endDate: eDate,
    dayIndex,
    periods
  };
}

export function parseTluSyncResponse(json: any): Subject[] {
  const results: Subject[] = [];

  // 1. Schedules
  if (json.data && Array.isArray(json.data)) {
    json.data.forEach((item: any) => {
      if (item.timetables && Array.isArray(item.timetables)) {
        item.timetables.forEach((tb: any) => {
          const parsed = parseTluTimetable(tb);
          if (!parsed) return; // Skip invalid or unscheduled entries

          const cleanSubjectName = normalizeSubjectName(item.subjectName || '');
          if (!cleanSubjectName) return;

          results.push({
            id: Math.random().toString(36).substr(2, 9),
            name: cleanSubjectName,
            code: item.subjectCode || '',
            room: parsed.room,
            lecturer: parsed.lecturer,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            daysOfWeek: [parsed.dayIndex],
            periods: parsed.periods,
            color: `border-l-${['blue', 'purple', 'green', 'orange', 'pink', 'indigo'][Math.floor(Math.random() * 6)]}-400`,
            semesterId: item.semesterId == null ? '' : String(item.semesterId),
            semesterName: item.semesterName == null ? '' : String(item.semesterName)
          });
        });
      }
    });
  }

  // 2. Exams
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
      const shiftMatch = shiftStr.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

      if (shiftMatch) {
        const s = parseInt(shiftMatch[1]);
        const e = parseInt(shiftMatch[2] || shiftMatch[1]);
        if (s >= 1 && s <= 16 && e >= 1 && e <= 16) {
          periods = [];
          for (let i = s; i <= e; i++) periods.push(i);
        }
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

      const cleanName = normalizeSubjectName(item.subjectName || '');
      if (!cleanName) return;

      results.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `${cleanName} (THI)`,
        code: item.subjectCode || '',
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

  // Generate deterministic ID and deduplicate
  const uniqueResults: Subject[] = [];
  const seenKeys = new Set<string>();

  for (const s of results) {
    const key = `${s.name}_${s.startDate}_${s.daysOfWeek[0]}_${s.periods[0]}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      let deterministicId = btoa(encodeURIComponent(key)).replace(/\//g, '_').replace(/\+/g, '-');
      s.id = deterministicId;
      uniqueResults.push(s);
    }
  }

  return uniqueResults;
}
