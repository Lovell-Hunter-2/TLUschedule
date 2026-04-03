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
        'bg-white rounded-2xl p-4 shadow-sm border border-gray-100 transition-all',
        onClick && 'cursor-pointer active:scale-[0.98] hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}
