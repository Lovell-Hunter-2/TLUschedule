import { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
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
      setError('Đăng nhập thất bại. Vui lòng mở bằng trình duyệt (Safari/Chrome) để đăng nhập Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md flex-1 flex flex-col justify-center"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-none mb-6 rotate-12">
            <GraduationCap className="w-10 h-10 text-white -rotate-12" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">TLU Schedule</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-2">Quản lý lịch học thông minh</p>
        </div>

        <Card className="p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 mb-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 font-medium mb-6">
                Đăng nhập bằng tài khoản Google để đồng bộ lịch học của bạn trên mọi thiết bị.
              </p>
            </div>

            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

            <Button 
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full h-12 text-lg font-bold rounded-2xl shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              {isLoading ? 'Đang kết nối...' : 'Tiếp tục với Google'}
            </Button>
          </div>
        </Card>
      </motion.div>
      
      <div className="mt-auto text-center text-sm text-gray-500 pb-4">
        Bằng việc đăng nhập, bạn đồng ý với{' '}
        <a href="/terms" className="text-blue-600 hover:underline">Điều khoản dịch vụ</a>
        {' '}và{' '}
        <a href="/privacy" className="text-blue-600 hover:underline">Chính sách bảo mật</a>
      </div>
    </div>
  );
}

