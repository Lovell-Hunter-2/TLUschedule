import { ReactNode } from 'react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  backgroundImage?: string;
}

const getMobileTitle = (fullTitle?: string) => {
  if (!fullTitle) return null;
  const namePart = fullTitle.replace(/\s*\(.*?\)\s*/g, '').trim();
  const words = namePart.split(' ');
  if (words.length >= 2) {
    const lastTwo = words.slice(-2);
    return (
      <span className="flex flex-col leading-tight">
        <span>{lastTwo[0]}</span>
        <span>{lastTwo[1]}</span>
      </span>
    );
  }
  return namePart;
};

export function Layout({ children, title, subtitle, headerAction, backgroundImage }: LayoutProps) {
  return (
    <div 
      className="min-h-screen bg-[#FDFCFE] dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans selection:bg-purple-100 selection:text-purple-900 dark:selection:bg-purple-900 dark:selection:text-purple-100 relative transition-colors duration-300"
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {backgroundImage && <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/70 backdrop-blur-sm z-0 transition-colors duration-300"></div>}
      
      <div className="relative z-10">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-2 sm:px-6 py-4 shadow-sm transition-colors duration-300">
          <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-4">
            <div className="flex-1 min-w-0 pl-2 sm:pl-0">
              {title && (
                <>
                  <h1 className="hidden sm:block text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 truncate">{title}</h1>
                  <h1 className="sm:hidden text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{getMobileTitle(title)}</h1>
                </>
              )}
              {subtitle && <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{subtitle}</p>}
            </div>
            <div className="shrink-0 flex items-center pr-2 sm:pr-0">
              {headerAction}
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-1 sm:px-6 py-6 sm:py-8 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
