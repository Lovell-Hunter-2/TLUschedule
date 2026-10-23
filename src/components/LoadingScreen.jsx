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
      }, 250);
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

      // Nếu load lâu qua 2 giây mà chưa có dữ liệu, hiện skeleton để người dùng thấy khung
      if (elapsed > 2000) {
        setStage('skeleton');
      }
    }, 40);

    // Timeout an toàn: Tối đa 3.5 giây luôn mở giao diện chính, không để người dùng bị kẹt
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
      {/* Keyframe Shimmer sáng cho giao diện nền trắng */}
      <style>{`
        @keyframes shimmerLight {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-light {
          position: relative;
          overflow: hidden;
          background-color: #f1f5f9;
        }
        .shimmer-light::after {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.7) 40%,
            rgba(255, 255, 255, 0.9) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmerLight 1.6s infinite;
          content: '';
        }
      `}</style>

      {/* GIAI ĐOẠN 1 + 2: LOADER + TIPS (NỀN TRẮNG SÁNG) */}
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
            {/* Hiệu ứng hào quang tím nhẹ nhàng trên nền trắng */}
            <div 
              className="absolute -inset-2 rounded-3xl blur-xl opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(124, 111, 255, 0.35) 0%, rgba(124, 111, 255, 0) 70%)' }}
            />
            {/* Khối logo tím nổi bật */}
            <div 
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/20 border border-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #7c6fff 50%, #9333ea 100%)',
              }}
            >
              <span className="text-3xl font-black text-white tracking-wider drop-shadow-sm">
                TL
              </span>
            </div>
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

        {/* Ô mẹo (Tip box) nền trắng thẻ bo tròn */}
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

            {/* Dot Indicator */}
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

      {/* GIAI ĐOẠN 3: SKELETON SCREEN (NỀN TRẮNG SÁNG, THẺ TRẮNG SHIMMER) */}
      <div
        className={`absolute inset-0 flex flex-col justify-between overflow-y-auto transition-opacity duration-300 z-10 bg-[#FDFCFE] ${
          stage === 'skeleton' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 80px)'
        }}
      >
        <div className="w-full max-w-5xl mx-auto px-4 py-5 space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200/80">
            <div className="space-y-2">
              <div className="shimmer-light w-48 sm:w-64 h-6 rounded-lg" />
              <div className="shimmer-light w-28 sm:w-36 h-4 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <div className="shimmer-light w-16 h-9 rounded-full hidden sm:block" />
              <div className="shimmer-light w-24 h-9 rounded-full hidden sm:block" />
              <div className="shimmer-light w-9 h-9 rounded-full" />
              <div className="shimmer-light w-9 h-9 rounded-full" />
            </div>
          </div>

          {/* 4 Thẻ KPI (Grid 2x2 trên mobile / 4 cột trên desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-4 bg-white border border-gray-200/80 shadow-xs space-y-3"
              >
                <div className="shimmer-light w-20 h-3.5 rounded-md" />
                <div className="shimmer-light w-14 h-8 rounded-lg" />
                <div className="shimmer-light w-24 h-3 rounded-md" />
              </div>
            ))}
          </div>

          {/* Danh sách 3 thẻ lớp học có thanh màu trái */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="shimmer-light w-32 h-4 rounded-md" />
              <div className="shimmer-light w-20 h-4 rounded-md" />
            </div>

            {[
              { color: '#7c6fff' },
              { color: '#0284c7' },
              { color: '#059669' }
            ].map((card, i) => (
              <div
                key={i}
                className="relative rounded-2xl p-4 bg-white border border-gray-200/80 shadow-xs overflow-hidden flex items-center justify-between gap-4"
              >
                {/* Thanh màu trái */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: card.color }}
                />
                <div className="pl-2 space-y-2.5 flex-1 min-w-0">
                  <div className="shimmer-light w-3/4 sm:w-1/2 h-5 rounded-md" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="shimmer-light w-20 h-4 rounded-md" />
                    <div className="shimmer-light w-24 h-4 rounded-md" />
                    <div className="shimmer-light w-28 h-4 rounded-md hidden sm:block" />
                  </div>
                </div>
                <div className="shimmer-light w-12 h-6 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Tab Bar Skeleton Nền Trắng */}
        <div 
          className="fixed bottom-2 left-2 right-2 max-w-md mx-auto z-40 rounded-2xl p-2 bg-white/95 border border-gray-200/80 backdrop-blur-xl shadow-lg flex items-center justify-around"
          style={{
            marginBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          {[1, 2, 3, 4, 5].map((tab) => (
            <div key={tab} className="flex flex-col items-center gap-1.5 py-1 px-3">
              <div className="shimmer-light w-5 h-5 rounded-md" />
              <div className="shimmer-light w-8 h-2.5 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
