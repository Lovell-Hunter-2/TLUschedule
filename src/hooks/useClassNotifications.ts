import { useEffect, useRef, useState } from 'react';
import { Subject, PERIODS } from '../types';
import { format, parse, differenceInMinutes, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';

export function useClassNotifications(subjects: Subject[]) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  
  // Keep track of which classes we've already notified about today
  const notifiedSetRef = useRef<Set<string>>(new Set());

  // Function to ask for permission
  const requestPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        toast.success('Đã bật thông báo lịch học!');
      } else {
        toast.error('Bạn đã từ chối quyền thông báo!');
      }
    } else {
      toast.error('Trình duyệt của bạn không hỗ trợ thông báo.');
    }
  };

  useEffect(() => {
    // If not granted, we can't show system notifications, but we still show in-app toasts
    // Actually, let's only run if the user hasn't explicitly denied, or we just rely on the app being open.
    
    const checkSchedule = () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const currentDayOfWeek = now.getDay();

      subjects.forEach(subject => {
        // Check if the subject is scheduled for today
        if (
          todayStr >= subject.startDate &&
          todayStr <= subject.endDate &&
          subject.daysOfWeek.includes(currentDayOfWeek)
        ) {
          // Find the first period of this subject block
          const startPeriodId = Math.min(...subject.periods);
          const period = PERIODS.find(p => p.id === startPeriodId);
          
          if (period) {
            // Parse start time (e.g., "07:00") into today's Date
            const startTimeDate = parse(period.startTime, 'HH:mm', now);
            
            // Calculate difference in minutes (startTime - now)
            const diffMins = differenceInMinutes(startTimeDate, now);
            
            // If class starts in 15 minutes or less (and hasn't started yet), and we haven't notified yet
            const notificationId = `${subject.id}-${todayStr}-${startPeriodId}`;
            
            if (diffMins > 0 && diffMins <= 15 && !notifiedSetRef.current.has(notificationId)) {
              // Add to notified set so we don't spam
              notifiedSetRef.current.add(notificationId);
              
              const title = `Sắp đến giờ học: ${subject.name}`;
              const body = `Tiết ${startPeriodId} sẽ bắt đầu lúc ${period.startTime} tại phòng ${subject.room || 'Chưa rõ'}.`;
              
              // 1. Show in-app Toast
              toast(body, {
                icon: '⏰',
                duration: 10000,
                style: {
                  borderRadius: '10px',
                  background: '#333',
                  color: '#fff',
                },
              });

              // 2. Show System Notification (if granted)
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(title, {
                  body: body,
                  icon: '/icon.png',
                });
              }
            }
          }
        }
      });
    };

    // Check immediately on mount
    checkSchedule();
    
    // Then check every 1 minute (60000 ms)
    const interval = setInterval(checkSchedule, 60000);
    
    return () => clearInterval(interval);
  }, [subjects]);

  return { permission, requestPermission };
}
