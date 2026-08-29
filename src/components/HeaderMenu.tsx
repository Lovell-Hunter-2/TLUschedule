import { useState, useRef, useEffect } from 'react';
import { Menu, Users, LogOut } from 'lucide-react';
import { Button } from './Button';

interface HeaderMenuProps {
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

import { Shield } from 'lucide-react';

export function HeaderMenu({ onSwitchWorkspace, onLogout, isAdmin, onOpenAdmin }: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setIsOpen(!isOpen)} 
        className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-2"
        title="Menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
          <button
            onClick={() => {
              setIsOpen(false);
              onSwitchWorkspace();
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <Users className="w-4 h-4" />
            <span>Change</span>
          </button>
                    {isAdmin && (
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenAdmin) onOpenAdmin();
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
            >
              <Shield className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          )}
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit GG</span>
          </button>
        </div>
      )}
    </div>
  );
}
