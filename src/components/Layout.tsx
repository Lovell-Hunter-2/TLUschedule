import { ReactNode } from 'react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
}

export function Layout({ children, title, subtitle, headerAction }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#FDFCFE] text-gray-900 font-sans selection:bg-purple-100 selection:text-purple-900">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>}
            {subtitle && <p className="text-sm text-gray-500 font-medium">{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
