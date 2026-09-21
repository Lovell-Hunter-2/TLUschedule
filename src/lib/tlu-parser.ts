import { Subject } from '../types';
import { normalizeSubjectName } from './utils';

export function parseTluTimetable(tb: any, defaultSemesterName?: string): {
  room: string;
  lecturer: string;
  startDate: string;
  endDate: string;
  dayIndex: number;
  periods: number[];
} | null {
  if (!tb) return null;

  // 1. Day of week (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday)
  let dayIndex: number | null = null;

  // Check direct dayIndex property (0..6)
  if (tb.dayIndex !== undefined && tb.dayIndex !== null) {
    const d = Number(tb.dayIndex);
    if (!isNaN(d) && d >= 0 && d <= 6) dayIndex = d;
  }

  // Check CMC weekIndex (1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat)
  if (dayIndex === null && (tb.weekIndex !== undefined && tb.weekIndex !== null)) {
    const rawVal = typeof tb.weekIndex === 'object' ? (tb.weekIndex.index ?? tb.weekIndex.id ?? tb.weekIndex.name) : tb.weekIndex;
    const w = parseInt(String(rawVal).replace(/\D/g, ''), 10);
    if (!isNaN(w)) {
      if (w === 1) dayIndex = 0; // Sun
      else if (w >= 2 && w <= 7) dayIndex = w - 1; // 2 -> 1 (Mon), 3 -> 2 (Tue), ..., 7 -> 6 (Sat)
    }
  }

  // Check dayOfWeek (0=Sun, 1=Mon... or 1=Sun, 2=Mon...)
  if (dayIndex === null && (tb.dayOfWeek !== undefined && tb.dayOfWeek !== null)) {
    const rawDow = typeof tb.dayOfWeek === 'object' ? (tb.dayOfWeek.id ?? tb.dayOfWeek.index) : tb.dayOfWeek;
    const dow = parseInt(String(rawDow).replace(/\D/g, ''), 10);
    if (!isNaN(dow)) {
      if (dow >= 0 && dow <= 6) dayIndex = dow;
      else if (dow === 7) dayIndex = 0;
    }
  }

  // Check text column like 'Thứ 2', 'Thứ hai', 'Chủ nhật'
  if (dayIndex === null) {
    const thuText = String(tb.thu || tb.dayName || tb.thuText || tb.thuTrongTuan || '').toLowerCase();
    if (thuText.includes('hai') || thuText.includes('2')) dayIndex = 1;
    else if (thuText.includes('ba') || thuText.includes('3')) dayIndex = 2;
    else if (thuText.includes('tư') || thuText.includes('tu') || thuText.includes('4')) dayIndex = 3;
    else if (thuText.includes('năm') || thuText.includes('nam') || thuText.includes('5')) dayIndex = 4;
    else if (thuText.includes('sáu') || thuText.includes('sau') || thuText.includes('6')) dayIndex = 5;
    else if (thuText.includes('bảy') || thuText.includes('bay') || thuText.includes('7')) dayIndex = 6;
    else if (thuText.includes('nhật') || thuText.includes('nhat') || thuText.includes('cn') || thuText.includes('chủ')) dayIndex = 0;
  }

  if (dayIndex === null) {
    return null; // Skip invalid or unscheduled day
  }

  // 2. Periods (strictly 1 to 16)
  const extractPeriod = (hourObj: any): number | null => {
    if (hourObj === null || hourObj === undefined) return null;
    if (typeof hourObj === 'number' && hourObj >= 1 && hourObj <= 16) return hourObj;
    if (typeof hourObj === 'object') {
      const idx = hourObj.index ?? hourObj.id ?? hourObj.name;
      const parsed = parseInt(String(idx).replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 16) return parsed;
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

  let sPeriod = extractPeriod(tb.startHour ?? tb.fromHour ?? tb.startPeriod);
  let ePeriod = extractPeriod(tb.endHour ?? tb.toHour ?? tb.endPeriod);

  // If periods were in a single string like "1-3" or "7,8,9"
  if (sPeriod === null && tb.tiet) {
    const nums = String(tb.tiet).match(/\d+/g)?.map(Number).filter(n => n >= 1 && n <= 16) || [];
    if (nums.length > 0) {
      sPeriod = Math.min(...nums);
      ePeriod = Math.max(...nums);
    }
  }

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
  const rawLecturer = (tb?.teacher?.displayName || tb?.teacher?.name || tb?.teacherName || tb?.lecturer || '').trim();
  const isInvalidLecturer = /^(lý\s*thuyết|thực\s*hành|bài\s*tập|tự\s*học|thao\s*trường|trực\s*tuyến|chưa\s*cập\s*nhật|chưa\s*phân\s*công|đang\s*cập\s*nhật|none|null|undefined|[\-–—._]+)$/i.test(rawLecturer);
  const lecturer = isInvalidLecturer ? '' : rawLecturer;

  // 4. Room
  const room = (tb?.room?.name || tb?.room?.code || tb?.roomName || tb?.room || '').trim();

  // 5. Start and End Date
  let sDate = '';
  let eDate = '';
  try {
    if (tb.startDate) {
      const d = new Date(tb.startDate);
      if (!isNaN(d.getTime())) sDate = d.toISOString().split('T')[0];
    }
    if (tb.endDate) {
      const d = new Date(tb.endDate);
      if (!isNaN(d.getTime())) eDate = d.toISOString().split('T')[0];
    }
  } catch (e) {}

  const currentYear = new Date().getFullYear();
  if (!sDate) sDate = `${currentYear}-08-15`;
  if (!eDate) eDate = `${currentYear + 1}-01-31`;

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

  // Determine current semester default name based on real date
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  let defaultSemName = '';
  if (curMonth >= 8 || curMonth === 1) {
    const startY = curMonth === 1 ? curYear - 1 : curYear;
    defaultSemName = `Học kỳ 1 Năm học ${startY}-${startY + 1}`;
  } else if (curMonth >= 2 && curMonth <= 6) {
    defaultSemName = `Học kỳ 2 Năm học ${curYear - 1}-${curYear}`;
  } else {
    defaultSemName = `Học kỳ phụ Năm học ${curYear - 1}-${curYear}`;
  }

  // 1. Schedules
  if (json.data && Array.isArray(json.data)) {
    json.data.forEach((item: any) => {
      let semName = item.semesterName ? String(item.semesterName).trim() : defaultSemName;
      let semId = item.semesterId != null ? String(item.semesterId) : '1';

      if (item.timetables && Array.isArray(item.timetables)) {
        item.timetables.forEach((tb: any) => {
          const parsed = parseTluTimetable(tb, semName);
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
            semesterId: semId,
            semesterName: semName
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
          if (!isNaN(d.getTime())) {
            eDate = d.toISOString().split('T')[0];
            dayIndex = d.getDay();
          }
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

      let semName = item.semesterName ? String(item.semesterName).trim() : defaultSemName;
      let semId = item.semesterId != null ? String(item.semesterId) : '1';

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
        semesterId: semId,
        semesterName: semName
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

