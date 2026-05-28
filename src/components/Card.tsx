import React from 'react';
import { cn } from '../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-all',
        onClick && 'cursor-pointer active:scale-[0.98] hover:shadow-md dark:hover:shadow-gray-900/50',
        className
      )}
    >
      {children}
    </div>
  );
}
