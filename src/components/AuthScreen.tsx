import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { GraduationCap, Sparkles, Smartphone, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  signInAnonymously,
  updateProfile,
  getRedirectResult
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'google' | 'anonymous' | null>(null);
  const [isIOSStandalone, setIsIOSStandalone] = useState(false);

  useEffect(() => {
    // Check if running as iOS Standalone PWA
    const isStandalone = (window.navigator as any).standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isStandalone || isIOS) {
      setIsIOSStandalone(true);
    }

    // Catch any pending redirect results
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          onLoginSuccess();
        }
      })
      .catch((err) => {
        console.warn("Redirect result handler:", err);
      });
  }, [onLoginSuccess]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setLoadingType('google');
      setError('');
      
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isWebview = (userAgent.indexOf('FBAV') > -1) || (userAgent.indexOf('Instagram') > -1) || (userAgent.indexOf('Zalo') > -1);

      if (isWebview) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('missing initial state') || isIOSStandalone) {
        setError('Trên màn hình chính iPhone (PWA), Apple giới hạn mở popup Google. Vui lòng bấm "⚡ Đăng nhập nhanh" bên dưới để vào ứng dụng ngay!');
      } else {
        setError(err.message || 'Đăng nhập Google thất bại. Vui lòng thử nút "Đăng nhập nhanh" bên dưới.');
      }
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleQuickLogin = async () => {
    try {
      setIsLoading(true);
      setLoadingType('anonymous');
      setError('');
      
      const cred = await signInAnonymously(auth);
      if (cred?.user) {
        await updateProfile(cred.user, { displayName: 'Sinh viên TLU' });
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error("Quick login error:", err);
      setError('Không thể đăng nhập nhanh: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md flex-1 flex flex-col justify-center"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-18 h-18 sm:w-20 sm:h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-none mb-4 rotate-12">
            <GraduationCap className="w-9 h-9 sm:w-10 sm:h-10 text-white -rotate-12" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">TLU Schedule</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-xs sm:text-sm mt-1">Quản lý lịch học & lịch thi thông minh</p>
        </div>

        <Card className="p-6 sm:p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95 mb-6 rounded-3xl">
          <div className="flex flex-col gap-4">
            <div className="text-center mb-1">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Bắt đầu sử dụng</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Chọn phương thức thuận tiện nhất để lưu lịch học trên thiết bị của bạn
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium text-center">
                {error}
              </div>
            )}

            {/* Quick 1-Click Login Button */}
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleQuickLogin}
                disabled={isLoading}
                className="w-full h-13 text-sm sm:text-base font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white border-none transition-all cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 shrink-0" />
                <span>{isLoading && loadingType === 'anonymous' ? 'Đang chuẩn bị...' : '⚡ Đăng nhập nhanh (Vào ngay)'}</span>
              </Button>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium text-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Hoạt động 100% trên Màn hình chính iPhone (PWA) & máy tính</span>
              </div>
            </div>

            <div className="relative flex items-center justify-center my-1.5">
              <div className="border-t border-gray-200 dark:border-gray-700 w-full"></div>
              <span className="bg-white dark:bg-gray-800 px-3 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
                Hoặc
              </span>
            </div>

            {/* Google Sign In Button */}
            <Button 
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full h-12 text-sm sm:text-base font-bold rounded-2xl shadow-sm flex items-center justify-center gap-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>{isLoading && loadingType === 'google' ? 'Đang kết nối...' : 'Tiếp tục với Google'}</span>
            </Button>

            {isIOSStandalone && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-2xl flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
                <Smartphone className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <span>
                  <strong>Khuyên dùng:</strong> Khi dùng icon app ngoài màn hình chính, nhấn <strong>"⚡ Đăng nhập nhanh"</strong> để vào ngay lập tức mà không gặp bất kỳ xung đột Safari nào!
                </span>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
      
      <div className="mt-auto text-center text-xs text-gray-400 pb-2">
        Bằng việc tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của TLU Schedule.
      </div>
    </div>
  );
}


