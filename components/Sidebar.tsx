import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'investments', label: 'Money', icon: '💰' },
    { id: 'stocks', label: 'Stocks Options', icon: '📈' },
  ];

  return (
    <>
      {/* --- DESKTOP SIDEBAR (Visible on md and up) --- */}
      <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col h-full transition-all duration-300 z-20 shadow-sm shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-brand rounded flex items-center justify-center text-white font-bold text-sm shadow-sm tracking-tighter">AT</div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">AT-SuperApp</span>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 font-medium ${activeTab === item.id
                ? 'bg-brand-light text-brand'
                : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
                }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <span className="text-xl">🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* --- MOBILE BOTTOM NAVIGATION (Visible below md) --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between items-center px-6 py-3 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === item.id ? 'text-brand' : 'text-slate-400'
              }`}
          >
            <span className={`text-2xl ${activeTab === item.id ? 'transform scale-110' : ''} transition-transform`}>{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-rose-500"
        >
          <span className="text-2xl">🚪</span>
          <span className="text-[10px] font-medium">Exit</span>
        </button>
      </div>
    </>
  );
};