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

  const startTimeRef = useRef(Date.now());
  const progressIntervalRef = useRef(null);
  const tipIntervalRef = useRef(null);
  const delayTimerRef = useRef(null);
  const doneTimerRef = useRef(null);
  const tipFadeTimerRef = useRef(null);

  // 1. Progress bar simulation (0 -> 90% over ~3s, jumps to 100% when isReady is true)
  useEffect(() => {
    if (isReady) {
      // Jump immediately to 100%
      setProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      startTimeRef.current = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const duration = 3000;
        const raw = (elapsed / duration) * 90;
        // Non-linear ease-out so it slows down near 90%
        const eased = Math.min(90, Math.round(90 * (1 - Math.pow(1 - Math.min(1, elapsed / duration), 2))));
        setProgress((prev) => {
          if (prev >= 90) return 90;
          return Math.max(prev, eased);
        });
      }, 50);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isReady]);

  // 2. Transition from Loader to Skeleton (600ms delay after progress reaches 100%)
  useEffect(() => {
    if (progress >= 100 && stage === 'loader') {
      delayTimerRef.current = setTimeout(() => {
        setStage('skeleton');
        // Once skeleton displays, signal completion after brief preview
        doneTimerRef.current = setTimeout(() => {
          if (onDone) onDone();
        }, 900);
      }, 600);
    }

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [progress, stage, onDone]);

  // 3. Rotating Tips every 4s with smooth fade
  useEffect(() => {
    tipIntervalRef.current = setInterval(() => {
      setIsTipFading(true);
      tipFadeTimerRef.current = setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
        setIsTipFading(false);
      }, 250);
    }, 4000);

    return () => {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
      if (tipFadeTimerRef.current) clearTimeout(tipFadeTimerRef.current);
    };
  }, []);

  const currentTip = TIPS[currentTipIndex];
  const statusText = getStatusText(progress);

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden select-none font-sans"
      style={{ backgroundColor: '#0d0d12', color: '#f3f4f6' }}
    >
      {/* Inline styles for keyframe shimmer and custom scrollbar */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-block {
          position: relative;
          overflow: hidden;
          background-color: rgba(255, 255, 255, 0.05);
        }
        .shimmer-block::after {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.07) 20%,
            rgba(255, 255, 255, 0.14) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmer 1.8s infinite;
          content: '';
        }
      `}</style>

      {/* STAGE 1 + 2: LOADER CONTAINER */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-between p-6 sm:p-8 transition-all duration-500 ease-out z-20 ${
          stage === 'skeleton'
            ? 'opacity-0 scale-[0.97] pointer-events-none'
            : 'opacity-100 scale-100'
        }`}
      >
        {/* Top spacer */}
        <div className="w-full h-8" />

        {/* Center: Logo & Progress */}
        <div className="flex flex-col items-center text-center max-w-sm w-full">
          {/* Logo App */}
          <div className="relative mb-5 group">
            {/* Ambient purple backlight glow */}
            <div 
              className="absolute -inset-2 rounded-3xl blur-xl opacity-60 transition-opacity"
              style={{ background: 'radial-gradient(circle, rgba(124, 111, 255, 0.4) 0%, rgba(124, 111, 255, 0) 70%)' }}
            />
            {/* Square badge with gradient */}
            <div 
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl border"
              style={{
                background: 'linear-gradient(135deg, #7c6fff 0%, #4f46e5 100%)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 12px 30px -8px rgba(124, 111, 255, 0.45)'
              }}
            >
              <span className="text-3xl font-black text-white tracking-wider">
                TL
              </span>
            </div>
          </div>

          {/* App Name */}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-6">
            TLU schedule
          </h1>

          {/* Fake Progress Bar Container */}
          <div className="w-full max-w-[280px] space-y-2.5">
            {/* Track */}
            <div 
              className="w-full h-2 rounded-full overflow-hidden p-0.5"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-200 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #7c6fff 0%, #a78bfa 100%)',
                  boxShadow: '0 0 12px rgba(124, 111, 255, 0.6)'
                }}
              />
            </div>

            {/* Status text + Percentage */}
            <div className="flex items-center justify-between text-[13px] px-0.5">
              <span 
                className="font-medium tracking-wide transition-all duration-200"
                style={{ color: progress >= 100 ? '#34d399' : '#a78bfa' }}
              >
                {statusText}
              </span>
              <span className="font-mono text-zinc-400 font-medium text-xs">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: Tip Box */}
        <div className="w-full max-w-sm mb-4">
          <div 
            className="rounded-2xl p-4 border transition-all duration-300"
            style={{
              backgroundColor: '#16161f',
              borderColor: 'rgba(255, 255, 255, 0.07)',
              boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div className="flex items-start gap-3 min-h-[46px]">
              <span className="text-xl shrink-0 select-none">
                {currentTip.icon}
              </span>
              <p 
                className={`text-[13px] leading-relaxed text-zinc-300 transition-opacity duration-250 ${
                  isTipFading ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {currentTip.text}
              </p>
            </div>

            {/* Dot Indicator */}
            <div className="flex items-center justify-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
              {TIPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentTipIndex
                      ? 'w-5'
                      : 'w-1.5'
                  }`}
                  style={{
                    backgroundColor: index === currentTipIndex ? '#7c6fff' : 'rgba(255, 255, 255, 0.2)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STAGE 3: SKELETON SCREEN */}
      <div
        className={`absolute inset-0 flex flex-col justify-between overflow-y-auto transition-opacity duration-500 z-10 ${
          stage === 'skeleton' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 80px)'
        }}
      >
        <div className="w-full max-w-5xl mx-auto px-4 py-5 space-y-6">
          {/* 1. Header Skeleton */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            {/* Left: User name & class */}
            <div className="space-y-2">
              <div className="shimmer-block w-48 sm:w-64 h-6 rounded-lg" />
              <div className="shimmer-block w-28 sm:w-36 h-4 rounded-md" />
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
              <div className="shimmer-block w-16 h-9 rounded-full hidden sm:block" />
              <div className="shimmer-block w-24 h-9 rounded-full hidden sm:block" />
              <div className="shimmer-block w-9 h-9 rounded-full" />
              <div className="shimmer-block w-9 h-9 rounded-full" />
            </div>
          </div>

          {/* 2. KPI Cards (Grid 2x2 on mobile, 4 columns on desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-4 border space-y-3"
                style={{
                  backgroundColor: '#16161f',
                  borderColor: 'rgba(255, 255, 255, 0.07)'
                }}
              >
                <div className="shimmer-block w-20 h-3.5 rounded-md" />
                <div className="shimmer-block w-14 h-8 rounded-lg" />
                <div className="shimmer-block w-24 h-3 rounded-md" />
              </div>
            ))}
          </div>

          {/* 3. Subject Cards List (3 cards with colored left border) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="shimmer-block w-32 h-4 rounded-md" />
              <div className="shimmer-block w-20 h-4 rounded-md" />
            </div>

            {[
              { color: '#7c6fff' },
              { color: '#38bdf8' },
              { color: '#34d399' }
            ].map((card, i) => (
              <div
                key={i}
                className="relative rounded-2xl p-4 border overflow-hidden flex items-center justify-between gap-4"
                style={{
                  backgroundColor: '#16161f',
                  borderColor: 'rgba(255, 255, 255, 0.07)'
                }}
              >
                {/* Left Accent Color Strip */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: card.color }}
                />

                {/* Content */}
                <div className="pl-2 space-y-2.5 flex-1 min-w-0">
                  <div className="shimmer-block w-3/4 sm:w-1/2 h-5 rounded-md" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="shimmer-block w-20 h-4 rounded-md" />
                    <div className="shimmer-block w-24 h-4 rounded-md" />
                    <div className="shimmer-block w-28 h-4 rounded-md hidden sm:block" />
                  </div>
                </div>

                {/* Right pill */}
                <div className="shimmer-block w-12 h-6 rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* 4. Bottom Tab Bar Skeleton (Fixed / Floating) */}
        <div 
          className="fixed bottom-2 left-2 right-2 max-w-md mx-auto z-40 rounded-2xl p-2 border backdrop-blur-xl shadow-2xl flex items-center justify-around"
          style={{
            backgroundColor: 'rgba(22, 22, 31, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            marginBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          {[1, 2, 3, 4, 5].map((tab) => (
            <div key={tab} className="flex flex-col items-center gap-1.5 py-1 px-3">
              <div className="shimmer-block w-5 h-5 rounded-md" />
              <div className="shimmer-block w-8 h-2.5 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
