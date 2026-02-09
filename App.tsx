import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TaskBoard } from './components/TaskBoard';
import { InvestmentDashboard } from './components/InvestmentDashboard';
import { StockAnalysis } from './components/StockAnalysis';
import { Login } from './components/Login';
import { AUTH_KEY } from './constants';
import { getAppData } from './services/storageService';

// Simple Dashboard Overview Component
const DashboardOverview = ({ setActiveTab }: { setActiveTab: (t: string) => void }) => {
  const [stats, setStats] = useState({ pendingTasks: 0, totalProfit: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getAppData();
        // Calc Tasks
        const pending = data.tasks.filter(t => t.status !== 'DONE').length;
        // Calc Profit
        let invested = 0;
        let current = 0;
        data.assets.forEach(a => {
          invested += a.buyPrice * a.quantity;
          current += a.currentPrice * a.quantity;
        });
        setStats({ pendingTasks: pending, totalProfit: current - invested });
      } catch (e) {
        console.error("Failed to load dashboard stats", e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 text-slate-800 bg-gray-50 min-h-full pb-24 md:pb-10">
      <h1 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900">Good Morning.</h1>
      <p className="text-slate-500 mb-8 max-w-xl text-base md:text-lg">
        Here is your daily executive summary.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl">
        <div
          onClick={() => setActiveTab('tasks')}
          className="group cursor-pointer bg-white border border-gray-200 hover:border-brand p-6 md:p-8 rounded-2xl transition-all hover:shadow-xl hover:shadow-brand/5 relative overflow-hidden active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <span className="text-4xl p-3 bg-blue-50 rounded-xl text-brand">📝</span>
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Action Required</span>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-slate-800">{stats.pendingTasks} Pending Tasks</h2>
            <p className="text-slate-500 text-sm md:text-base">You have {stats.pendingTasks} items remaining on your list today.</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('investments')}
          className="group cursor-pointer bg-white border border-gray-200 hover:border-emerald-500 p-6 md:p-8 rounded-2xl transition-all hover:shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <span className="text-4xl p-3 bg-emerald-50 rounded-xl text-emerald-600">📈</span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${stats.totalProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {stats.totalProfit >= 0 ? 'Profit' : 'Loss'}
              </span>
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(stats.totalProfit)}
            </h2>
            <p className="text-slate-500 text-sm md:text-base">Total estimated profit/loss across all portfolios.</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('stocks')}
          className="group cursor-pointer bg-white border border-gray-200 hover:border-purple-500 p-6 md:p-8 rounded-2xl transition-all hover:shadow-xl hover:shadow-purple-500/5 relative overflow-hidden active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-10 -mt-10 z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <span className="text-4xl p-3 bg-purple-50 rounded-xl text-purple-600">📊</span>
              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Analytics</span>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-slate-800">Stock Options</h2>
            <p className="text-slate-500 text-sm md:text-base">Analyze options chains with advanced filtering tools.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check session
    const auth = localStorage.getItem(AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 text-slate-800 overflow-hidden font-sans selection:bg-brand selection:text-white">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        {/* Main Content Area: Added pb-20 for mobile bottom nav space */}
        <div className="flex-1 w-full overflow-y-auto custom-scrollbar md:pb-0">
          {activeTab === 'dashboard' && <DashboardOverview setActiveTab={setActiveTab} />}
          {activeTab === 'tasks' && <TaskBoard />}
          {activeTab === 'investments' && <InvestmentDashboard />}
          {activeTab === 'stocks' && <StockAnalysis />}
        </div>
      </main>
    </div>
  );
};

export default App;