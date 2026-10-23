import React, { useState, useEffect, useRef } from 'react';

const TIPS = [
  { icon: '📅', text: 'Bấm vào môn học để xem phòng thi cuối kỳ và lịch thi bổ sung.' },
  { icon: '🔔', text: 'Bật thông báo để nhắc lịch học trước 15 phút — không bao giờ muộn giờ nữa.' },
  { icon: '🔄', text: 'Lịch tự động đồng bộ với hệ thống TLU khi có thay đổi phòng hoặc giờ học.' },
  { icon: '📋', text: 'Vào phần "Cập nhật" để xem tài liệu học tập từ SenseiTLU.' },
  { icon: '⚡', text: 'Đồng bộ lịch học sang Google Calendar chỉ với một chạm trong mục Cập nhật.' },
];

function getStatusText(progress) {
  if (progress >= 100) return 'Hoàn tất!';
  if (progress >= 95) return 'Sắp xong rồi…';
  if (progress >= 80) return 'Đồng bộ dữ liệu…';
  if (progress >= 50) return 'Đang tải lịch học…';
  if (progress >= 25) return 'Xác thực tài khoản…';
  return 'Đang kết nối…';
}

export function LoadingScreen({ isReady = false, onDone }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('loader'); // 'loader' | 'skeleton'
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isTipFading, setIsTipFading] = useState(false);

  const doneCalledRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const handleDone = () => {
    if (!doneCalledRef.current) {
      doneCalledRef.current = true;
      if (onDone) onDone();
    }
  };

  // 1. Khi dữ liệu đã sẵn sàng (isReady === true), hoàn tất ngay lập tức
  useEffect(() => {
    if (isReady) {
      setProgress(100);
      const timer = setTimeout(() => {
        handleDone();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  // 2. Tiến trình giả lập 0 -> 90% khi dữ liệu đang load (chưa ready)
  useEffect(() => {
    if (isReady) return;

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const raw = Math.min(90, Math.round(90 * (1 - Math.pow(1 - Math.min(1, elapsed / 2200), 2))));
      
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return Math.max(prev, raw);
      });

      // Nếu tải lâu qua 1.8s mà chưa có dữ liệu, hiển thị khung skeleton mô phỏng
      if (elapsed > 1800) {
        setStage('skeleton');
      }
    }, 40);

    // Timeout an toàn: Tối đa 3.5s luôn mở ứng dụng
    const safetyTimer = setTimeout(() => {
      handleDone();
    }, 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimer);
    };
  }, [isReady]);

  // 3. Xoay vòng Tips mỗi 4 giây
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setIsTipFading(true);
      const fadeTimer = setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
        setIsTipFading(false);
      }, 200);
      return () => clearTimeout(fadeTimer);
    }, 4000);

    return () => clearInterval(tipInterval);
  }, []);

  const currentTip = TIPS[currentTipIndex];
  const statusText = getStatusText(progress);

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden select-none font-sans bg-[#FDFCFE] text-gray-900"
    >
      {/* Keyframe Shimmer chuẩn trắng xám */}
      <style>{`
        @keyframes shimmerNeutral {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-box {
          position: relative;
          overflow: hidden;
          background-color: #e2e8f0;
        }
        .shimmer-box-light {
          position: relative;
          overflow: hidden;
          background-color: #f1f5f9;
        }
        .shimmer-box::after,
        .shimmer-box-light::after {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.6) 40%,
            rgba(255, 255, 255, 0.85) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmerNeutral 1.6s infinite;
          content: '';
        }
      `}</style>

      {/* GIAI ĐOẠN 1 + 2: LOADER + TIPS */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-between p-6 sm:p-8 transition-all duration-300 ease-out z-20 ${
          stage === 'skeleton'
            ? 'opacity-0 scale-[0.98] pointer-events-none'
            : 'opacity-100 scale-100'
        }`}
      >
        <div className="w-full h-8" />

        {/* Logo App + Progress */}
        <div className="flex flex-col items-center text-center max-w-sm w-full">
          <div className="relative mb-5 group">
            <div 
              className="absolute -inset-2 rounded-3xl blur-xl opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(124, 111, 255, 0.35) 0%, rgba(124, 111, 255, 0) 70%)' }}
            />
            <img
              src="/icon.png"
              alt="TLU Schedule Icon"
              className="relative w-20 h-20 rounded-2xl object-cover shadow-xl shadow-purple-500/20 border border-white/80"
            />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 mb-6">
            TLU schedule
          </h1>

          {/* Thanh tiến độ */}
          <div className="w-full max-w-[280px] space-y-2">
            <div className="w-full h-2 rounded-full overflow-hidden bg-gray-100 border border-gray-200/80 p-0.5">
              <div
                className="h-full rounded-full transition-all duration-200 ease-out bg-gradient-to-r from-indigo-500 via-purple-600 to-purple-500 shadow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[13px] px-0.5">
              <span 
                className="font-semibold tracking-wide transition-all duration-200"
                style={{ color: progress >= 100 ? '#16a34a' : '#7c3aed' }}
              >
                {statusText}
              </span>
              <span className="font-mono text-gray-500 font-medium text-xs">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Ô mẹo (Tip box) */}
        <div className="w-full max-w-sm mb-4">
          <div className="rounded-2xl p-4 bg-white border border-gray-200/90 shadow-md shadow-purple-500/5 transition-all">
            <div className="flex items-start gap-3 min-h-[46px]">
              <span className="text-xl shrink-0 select-none">
                {currentTip.icon}
              </span>
              <p 
                className={`text-[13px] leading-relaxed text-gray-700 transition-opacity duration-200 ${
                  isTipFading ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {currentTip.text}
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100">
              {TIPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentTipIndex ? 'w-5 bg-purple-600' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GIAI ĐOẠN 3: SKELETON SCREEN (KHUÔN MÔ PHỎNG TRẮNG XÁM CHUẨN) */}
      <div
        className={`absolute inset-0 flex flex-col justify-between overflow-y-auto transition-opacity duration-300 z-10 bg-[#FDFCFE] ${
          stage === 'skeleton' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 90px)'
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-4 space-y-4 sm:space-y-6">
          
          {/* 1. Header (Khuôn Tên SV bên trái, cụm nút icon bên phải) */}
          <header className="flex items-center justify-between gap-3 pb-2 sm:pb-3 border-b border-gray-100">
            {/* Left: User Title */}
            <div className="min-w-0">
              {/* Desktop view */}
              <div className="hidden sm:block space-y-2">
                <div className="w-64 h-6 rounded-lg shimmer-box" />
                <div className="w-28 h-3.5 rounded-md shimmer-box-light" />
              </div>
              {/* Mobile view (2 dòng xếp chồng) */}
              <div className="sm:hidden space-y-1.5">
                <div className="w-20 h-5 rounded-md shimmer-box" />
                <div className="w-24 h-5 rounded-md shimmer-box" />
              </div>
            </div>

            {/* Right: Actions (Thời tiết, Đồng bộ, Chuông, Cài đặt, Menu) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Weather Pill */}
              <div className="w-16 sm:w-20 h-8 sm:h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center gap-1.5 px-2 shadow-2xs">
                <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
                <div className="w-7 h-3 rounded shimmer-box" />
              </div>

              {/* Sync Pill (Desktop) / Circle (Mobile) */}
              <div className="hidden sm:flex w-28 h-9 rounded-full bg-white border border-gray-200 items-center justify-center gap-1.5 px-3 shadow-2xs">
                <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
                <div className="w-14 h-3 rounded shimmer-box-light" />
              </div>
              <div className="sm:hidden w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-2xs">
                <div className="w-4 h-4 rounded-full shimmer-box" />
              </div>

              {/* Bell Notification */}
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-2xs">
                <div className="w-4 h-4 rounded-full shimmer-box" />
              </div>

              {/* Install App Button */}
              <div className="hidden sm:flex w-28 h-9 rounded-full bg-gray-200 items-center justify-center gap-1.5 px-3">
                <div className="w-3.5 h-3.5 rounded shimmer-box" />
                <div className="w-16 h-3 rounded shimmer-box" />
              </div>
              <div className="sm:hidden w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded shimmer-box" />
              </div>

              {/* Menu Button */}
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-2xs">
                <div className="w-4 h-3 rounded shimmer-box" />
              </div>
            </div>
          </header>

          {/* 2. Desktop Segmented Tabs & Dropdown / Mobile Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Left spacer desktop */}
            <div className="hidden sm:block sm:flex-1" />

            {/* Desktop Center Segmented Tabs */}
            <div className="hidden sm:flex items-center gap-1 p-1 bg-gray-100 border border-gray-200/70 rounded-2xl shadow-2xs">
              <div className="w-20 h-8 rounded-xl bg-white border border-gray-200/60 shadow-xs flex items-center justify-center">
                <div className="w-12 h-3 rounded shimmer-box" />
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-20 h-8 rounded-xl flex items-center justify-center">
                  <div className="w-12 h-3 rounded shimmer-box-light" />
                </div>
              ))}
            </div>

            {/* Right Semester Dropdown (Full width on Mobile) */}
            <div className="flex justify-end sm:flex-1">
              <div className="w-full sm:w-44 h-11 sm:h-10 rounded-2xl bg-white border border-gray-200 shadow-2xs flex items-center justify-between px-4">
                <div className="w-24 h-3.5 rounded shimmer-box-light" />
                <div className="w-3 h-3 rounded shimmer-box" />
              </div>
            </div>
          </div>

          {/* 3. Dải ngày trong tuần (Date Strip) */}
          <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-1 sm:pb-2 no-scrollbar -mx-1 px-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((idx) => {
              const isSelected = idx === 3;
              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center min-w-[58px] sm:min-w-[64px] h-[72px] sm:h-[76px] rounded-2xl border shrink-0 transition-all ${
                    isSelected
                      ? 'bg-gray-100 border-gray-300 shadow-xs'
                      : 'bg-white border-gray-150 shadow-2xs'
                  }`}
                >
                  <div className="w-8 h-2 rounded shimmer-box-light" />
                  <div className="w-6 h-5 rounded-md mt-2 shimmer-box" />
                </div>
              );
            })}
          </div>

          {/* 4. Tiêu đề ngày & Nút + Note */}
          <div className="flex items-center justify-between pt-1">
            <div className="w-36 sm:w-48 h-6 sm:h-7 rounded-lg shimmer-box" />
            <div className="w-20 h-8 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center justify-center gap-1.5 px-3">
              <div className="w-3 h-3 rounded shimmer-box" />
              <div className="w-8 h-3 rounded shimmer-box-light" />
            </div>
          </div>

          {/* 5. Danh sách thẻ môn học (Khung mô phỏng trắng xám trung tính) */}
          <div className="space-y-3.5 sm:space-y-4">
            {[1, 2].map((cardIdx) => (
              <div 
                key={cardIdx}
                className="rounded-2xl p-4 sm:p-5 bg-white border border-gray-200/80 shadow-xs space-y-3 relative overflow-hidden"
              >
                {/* Dải viền trái mô phỏng */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gray-300" />

                {/* Dòng 1: Tên môn & Giờ học */}
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="w-3/5 sm:w-2/5 h-6 rounded-md shimmer-box" />
                    {/* Mã lớp pill */}
                    <div className="w-60 max-w-full h-5 rounded-md shimmer-box-light" />
                  </div>
                  {/* Giờ học pill */}
                  <div className="w-28 h-6 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center gap-1 px-2.5 shrink-0 shadow-2xs">
                    <div className="w-3 h-3 rounded-full shimmer-box" />
                    <div className="w-16 h-2.5 rounded shimmer-box-light" />
                  </div>
                </div>

                {/* Dòng 2: Phòng học & Nút bản đồ & Giảng viên */}
                <div className="flex items-center gap-2 pt-0.5 pl-1 flex-wrap">
                  <div className="w-4 h-4 rounded-full shimmer-box" />
                  <div className="w-16 h-4 rounded shimmer-box" />
                  <div className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 ml-1">
                    <div className="w-3.5 h-3.5 rounded shimmer-box" />
                  </div>
                  {cardIdx === 2 && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
                      <div className="w-28 h-4 rounded shimmer-box-light" />
                    </div>
                  )}
                </div>

                {/* Dòng 3: Tiết học badges & Thời tiết */}
                <div className="flex items-center justify-between pt-1 pl-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-5 rounded bg-gray-50 border border-gray-200 shimmer-box-light" />
                    <div className="w-8 h-5 rounded bg-gray-50 border border-gray-200 shimmer-box-light" />
                    <div className="w-8 h-5 rounded bg-gray-50 border border-gray-200 shimmer-box-light" />
                  </div>
                  {/* Weather */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
                    <div className="w-14 h-3 rounded shimmer-box-light" />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* 6. Thanh Bottom Tab Bar (Mobile Floating Bar đúng 5 tab) */}
        <div 
          className="sm:hidden fixed bottom-2 left-2 right-2 max-w-md mx-auto z-40 rounded-2xl p-1 bg-white/95 border border-gray-100 backdrop-blur-xl shadow-[0_4px_24px_rgb(0,0,0,0.08)] flex items-center justify-around"
          style={{
            marginBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          {[1, 2, 3, 4, 5].map((tabIdx) => (
            <div key={tabIdx} className="flex flex-col items-center gap-1 py-1.5 px-3">
              <div className="w-4 h-4 rounded shimmer-box" />
              <div className="w-7 h-2 rounded shimmer-box-light" />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default LoadingScreen;
