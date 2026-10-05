import React from 'react';
import { 
  FileText, 
  Award, 
  Settings, 
  LogOut, 
  Sun, 
  Moon,
  Home,
  Mail,
  Receipt
} from 'lucide-react';
import { CompanySettings } from '../../types';
import companyLogo from '../../../only_logo-removebg-preview.png';

interface NavbarProps {
  path: string;
  navigate: (toPath: string) => void;
  settings: CompanySettings;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onLogout: () => void;
}

export default function Navbar({ 
  path, 
  navigate, 
  settings, 
  darkMode, 
  setDarkMode, 
  onLogout 
}: NavbarProps) {
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/invoice/old', label: 'Invoices', icon: FileText },
    { path: '/certificate/old', label: 'Certificates', icon: Award },
    { path: '/letter/old', label: 'Letters', icon: Mail },
    { path: '/payslip/old', label: 'Payslips', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          
          {/* Logo & Tagline */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex h-15 w-auto max-w-[180px] items-center justify-center overflow-hidden py-0.5">
              <img 
                src={companyLogo} 
                alt={settings.name} 
                className="h-full max-h-14 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                {settings.name} <span className="text-xs font-semibold text-[#078EDB] dark:text-[#45D8F5] bg-[#EAFCFF] dark:bg-[#062B4B] px-2 py-0.5 rounded-md ml-1.5 border border-[#00B9E8]/30">Studio</span>
              </span>
              <p className="text-xxs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase" style={{ fontSize: '9px' }}>
                {settings.tagline}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              // Active check: exact match, or checking sub-paths like /invoice/new vs /invoice/old
              const isActive = path === item.path || 
                               (item.path === '/invoice/old' && path.startsWith('/invoice')) ||
                               (item.path === '/certificate/old' && path.startsWith('/certificate')) ||
                               (item.path === '/letter/old' && path.startsWith('/letter')) ||
                               (item.path === '/payslip/old' && path.startsWith('/payslip'));
                               
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#078EDB]/10 text-[#07547E] dark:text-[#45D8F5] border-b-2 border-[#078EDB]'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#078EDB] dark:text-[#45D8F5]' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Utilities */}
          <div className="flex items-center space-x-4">
            
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun className="h-5 w-5 text-[#45D8F5]" /> : <Moon className="h-5 w-5 text-[#07547E]" />}
            </button>

            {/* Profile Dropdown */}
            <div className="flex items-center space-x-3 border-l border-gray-200 dark:border-slate-800 pl-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-900 dark:text-white">Admin Portal</span>
                <span className="text-xxs text-gray-500 dark:text-gray-400" style={{ fontSize: '10px' }}>admin@lihatech.com</span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors duration-200 cursor-pointer"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            
          </div>

        </div>
      </div>
      
      {/* Mobile Nav Subbar */}
      <div className="lg:hidden flex items-center justify-start overflow-x-auto border-t border-gray-100 dark:border-slate-800 py-2 px-4 space-x-2 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.path || 
                           (item.path === '/invoice/old' && path.startsWith('/invoice')) ||
                           (item.path === '/certificate/old' && path.startsWith('/certificate')) ||
                           (item.path === '/letter/old' && path.startsWith('/letter')) ||
                           (item.path === '/payslip/old' && path.startsWith('/payslip'));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#078EDB] text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
