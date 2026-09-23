import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { GraduationCap, Mail, Lock, User, ArrowRight, KeyRound, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  getRedirectResult
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'google' | 'email_login' | 'email_signup' | 'forgot_password'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIOSStandalone, setIsIOSStandalone] = useState(false);

  useEffect(() => {
    // Check if running as iOS Standalone PWA
    const isStandalone = (window.navigator as any).standalone === true || 
                         window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isStandalone && isIOS) {
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
      setError('');
      setInfoMessage('');
      
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
      if (err.code === 'auth/popup-blocked' || isIOSStandalone) {
        setError('Trên màn hình chính iPhone (PWA), Apple giới hạn mở popup Google. Bạn vui lòng sử dụng Đăng nhập bằng Email/Mật khẩu bên dưới để vào ứng dụng mượt mà nhất!');
        setAuthMode('email_login');
      } else {
        setError(err.message || 'Đăng nhập Google thất bại. Vui lòng thử lại hoặc đăng nhập bằng Email.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    try {
      setIsLoading(true);
      if (authMode === 'email_login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onLoginSuccess();
      } else if (authMode === 'email_signup') {
        if (password.length < 6) {
          setError('Mật khẩu phải có ít nhất 6 ký tự.');
          setIsLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error("Email auth error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Email hoặc mật khẩu không chính xác. Nếu chưa có tài khoản, hãy nhấn "Đăng ký tài khoản".');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email này đã được đăng ký. Vui lòng chuyển sang "Đăng nhập".');
      } else if (err.code === 'auth/invalid-email') {
        setError('Địa chỉ email không hợp lệ.');
      } else if (err.code === 'auth/weak-password') {
        setError('Mật khẩu quá yếu (cần tối thiểu 6 ký tự).');
      } else {
        setError(err.message || 'Xác thực không thành công. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập email để nhận liên kết đặt lại mật khẩu.');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMessage('Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hộp thư đến (và thư mục Spam).');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('Không tìm thấy tài khoản với email này.');
      } else {
        setError('Không thể gửi email khôi phục. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md flex-1 flex flex-col justify-center"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-none mb-4 rotate-12">
            <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-white -rotate-12" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">TLU Schedule</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-xs sm:text-sm mt-1">Quản lý lịch học & lịch thi thông minh</p>
        </div>

        {isIOSStandalone && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>iPhone PWA:</strong> Đăng nhập bằng <strong>Email/Mật khẩu</strong> bên dưới hoạt động mượt mà 100% không bị giới hạn Safari!
            </span>
          </div>
        )}

        <Card className="p-6 sm:p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border-white/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95 mb-6 rounded-3xl">
          <div className="flex flex-col gap-5">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium text-center">
                {error}
              </div>
            )}
            {infoMessage && (
              <div className="p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 rounded-xl text-xs text-green-600 dark:text-green-400 font-medium text-center">
                {infoMessage}
              </div>
            )}

            {/* Google Sign In Button */}
            <Button 
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full h-12 text-sm sm:text-base font-bold rounded-2xl shadow-sm flex items-center justify-center gap-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
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
              {isLoading && authMode === 'google' ? 'Đang kết nối...' : 'Tiếp tục với Google'}
            </Button>

            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-gray-200 dark:border-gray-700 w-full"></div>
              <span className="bg-white dark:bg-gray-800 px-3 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
                Hoặc bằng Email
              </span>
            </div>

            {/* Email Form Modes */}
            <AnimatePresence mode="wait">
              {authMode === 'forgot_password' ? (
                <motion.form 
                  key="forgot"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  onSubmit={handleResetPassword} 
                  className="flex flex-col gap-3.5"
                >
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Nhập email của bạn để nhận liên kết khôi phục mật khẩu.
                  </p>
                  <Input 
                    type="email"
                    label="Email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail className="w-4 h-4" />}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                  >
                    {isLoading ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('email_login'); setError(''); setInfoMessage(''); }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-center font-medium mt-1"
                  >
                    Quay lại Đăng nhập
                  </button>
                </motion.form>
              ) : (
                <motion.form 
                  key={authMode}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  onSubmit={handleEmailAuth} 
                  className="flex flex-col gap-3.5"
                >
                  {authMode === 'email_signup' && (
                    <Input 
                      type="text"
                      label="Họ và tên"
                      placeholder="Nguyễn Văn A"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      icon={<User className="w-4 h-4" />}
                      required
                    />
                  )}

                  <Input 
                    type="email"
                    label="Email"
                    placeholder="sv@thanglong.edu.vn hoặc email cá nhân"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail className="w-4 h-4" />}
                    required
                  />

                  <div>
                    <Input 
                      type="password"
                      label="Mật khẩu"
                      placeholder={authMode === 'email_signup' ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      icon={<Lock className="w-4 h-4" />}
                      required
                    />
                    {authMode === 'email_login' && (
                      <div className="flex justify-end mt-1">
                        <button
                          type="button"
                          onClick={() => { setAuthMode('forgot_password'); setError(''); setInfoMessage(''); }}
                          className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                        >
                          Quên mật khẩu?
                        </button>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 mt-1"
                  >
                    {isLoading ? (
                      'Đang xử lý...'
                    ) : authMode === 'email_login' ? (
                      <>Đăng nhập <ArrowRight className="w-4 h-4" /></>
                    ) : (
                      <>Tạo tài khoản <Sparkles className="w-4 h-4" /></>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {authMode === 'email_login' ? (
                      <>
                        <span>Chưa có tài khoản?</span>
                        <button
                          type="button"
                          onClick={() => { setAuthMode('email_signup'); setError(''); setInfoMessage(''); }}
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Đăng ký ngay
                        </button>
                      </>
                    ) : (
                      <>
                        <span>Đã có tài khoản?</span>
                        <button
                          type="button"
                          onClick={() => { setAuthMode('email_login'); setError(''); setInfoMessage(''); }}
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Đăng nhập
                        </button>
                      </>
                    )}
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>
      
      <div className="mt-auto text-center text-xs text-gray-400 pb-2">
        Bằng việc tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của TLU Schedule.
      </div>
    </div>
  );
}


