import { Subject, PERIODS } from '../types';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export async function syncToGoogleCalendar(subjects: Subject[]) {
  try {
    // 1. Thêm quyền truy cập Google Calendar
    googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
    
    // 2. Yêu cầu người dùng đăng nhập lại để lấy Token mới nhất
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error("Không thể lấy quyền truy cập Google Calendar");
    }

    let successCount = 0;
    
    // 3. Xử lý từng môn học
    for (const subject of subjects) {
      if (!subject.periods || subject.periods.length === 0) continue;
      
      const startPeriod = PERIODS.find(p => p.id === Math.min(...subject.periods));
      const endPeriod = PERIODS.find(p => p.id === Math.max(...subject.periods));
      
      if (!startPeriod || !endPeriod) continue;
      
      const startDate = new Date(subject.startDate);
      const endDate = new Date(subject.endDate);
      
      // Tạo sự kiện cho mỗi thứ trong tuần của môn học
      for (const dayOfWeek of subject.daysOfWeek) {
        const firstOccurrence = getFirstOccurrence(startDate, dayOfWeek);
        if (firstOccurrence > endDate) continue;
        
        const eventStartTime = new Date(firstOccurrence);
        const [startHour, startMin] = startPeriod.startTime.split(':').map(Number);
        eventStartTime.setHours(startHour, startMin, 0);

        const eventEndTime = new Date(firstOccurrence);
        const [endHour, endMin] = endPeriod.endTime.split(':').map(Number);
        eventEndTime.setHours(endHour, endMin, 0);

        // Lặp lại hàng tuần cho đến ngày kết thúc
        const untilStr = endDate.toISOString().replace(/[-:]/g, '').split('T')[0] + 'T235959Z';
        const byDayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const rrule = `RRULE:FREQ=WEEKLY;UNTIL=${untilStr};BYDAY=${byDayMap[dayOfWeek]}`;

        const event = {
          summary: subject.name,
          location: subject.room || '',
          description: `Giảng viên: ${subject.lecturer || 'Chưa có'}\nTiết: ${subject.periods.join(', ')}`,
          start: {
            dateTime: eventStartTime.toISOString(),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          end: {
            dateTime: eventEndTime.toISOString(),
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          recurrence: [rrule],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 15 }, // Thông báo trước 15 phút
            ],
          },
        };

        // Gửi API tạo sự kiện lên Google Calendar
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          successCount++;
        } else {
          console.error("Lỗi khi tạo sự kiện:", await response.text());
        }
      }
    }
    
    return successCount;
  } catch (error) {
    console.error("Sync error:", error);
    throw error;
  }
}

function getFirstOccurrence(startDate: Date, dayOfWeek: number) {
  const date = new Date(startDate);
  const currentDay = date.getDay();
  const distance = (dayOfWeek + 7 - currentDay) % 7;
  date.setDate(date.getDate() + distance);
  return date;
}
