import React, { useState, useEffect, useMemo } from 'react';
import { Asset, AssetType, UserSettings } from '../types';
import { addAsset, getAppData, removeAsset, updateAssetPrice } from '../services/storageService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

// Filter Modes (Reused concept from TaskBoard)
type FilterMode = 'day' | 'week' | 'month' | 'year' | 'all';

// Constants for API
const USDT_VND_RATE = 25500; // Hardcoded rate, could be dynamic later

export const InvestmentDashboard: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [settings, setSettings] = useState<UserSettings>({ investmentGoal: 0, targetYear: 0 });
  
  // Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [referenceDate, setReferenceDate] = useState(new Date());

  // UI States
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  // New Asset State
  const [newSymbol, setNewSymbol] = useState('');
  const [newType, setNewType] = useState<AssetType>(AssetType.CRYPTO);
  const [newQty, setNewQty] = useState('');
  const [newBuyPrice, setNewBuyPrice] = useState('');
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
        const data = await getAppData();
        setAssets(data.assets.sort((a, b) => b.createdAt - a.createdAt));
        setSettings(data.settings);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingData(false);
    }
  };

  // --- Date Logic Helpers (Similar to TaskBoard) ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
  };
  
  const getEndOfWeek = (date: Date) => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
  };

  const handlePrevPeriod = () => {
    const newDate = new Date(referenceDate);
    switch (filterMode) {
      case 'day': newDate.setDate(newDate.getDate() - 1); break;
      case 'week': newDate.setDate(newDate.getDate() - 7); break;
      case 'month': newDate.setMonth(newDate.getMonth() - 1); break;
      case 'year': newDate.setFullYear(newDate.getFullYear() - 1); break;
    }
    setReferenceDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(referenceDate);
    switch (filterMode) {
      case 'day': newDate.setDate(newDate.getDate() + 1); break;
      case 'week': newDate.setDate(newDate.getDate() + 7); break;
      case 'month': newDate.setMonth(newDate.getMonth() + 1); break;
      case 'year': newDate.setFullYear(newDate.getFullYear() + 1); break;
    }
    setReferenceDate(newDate);
  };

  const getFilterLabel = () => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    switch (filterMode) {
      case 'day': return referenceDate.toLocaleDateString('en-US', { ...options, weekday: 'short' });
      case 'week':
        const start = getStartOfWeek(referenceDate);
        const end = getEndOfWeek(referenceDate);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month': return referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year': return referenceDate.getFullYear().toString();
      case 'all': return 'All Time';
      default: return '';
    }
  };

  const filteredAssets = useMemo(() => {
    if (filterMode === 'all') return assets;

    return assets.filter(a => {
      // Use createdAt if available, otherwise assume it's valid (fallback)
      const date = new Date(a.createdAt || Date.now());
      date.setHours(0,0,0,0);
      const ref = new Date(referenceDate);
      ref.setHours(0,0,0,0);

      switch (filterMode) {
        case 'day': return date.getTime() === ref.getTime();
        case 'week':
            const startW = getStartOfWeek(ref); startW.setHours(0,0,0,0);
            const endW = getEndOfWeek(ref); endW.setHours(23,59,59,999);
            return date >= startW && date <= endW;
        case 'month': return date.getMonth() === ref.getMonth() && date.getFullYear() === ref.getFullYear();
        case 'year': return date.getFullYear() === ref.getFullYear();
        default: return true;
      }
    });
  }, [assets, filterMode, referenceDate]);

  // --- API Logic: Binance (Crypto) & VNDirect via Proxy (Stocks/ETF) ---
  const fetchMarketPrices = async () => {
    setIsRefreshing(true);
    
    // We update local state first to show immediate change if we wanted, 
    // but here we want to update the DB with new prices too.
    const updatedAssets = await Promise.all(assets.map(async (asset) => {
      const symbol = asset.symbol.toUpperCase();
      let newPrice = asset.currentPrice;

      // 1. CRYPTO - BINANCE API
      if (asset.type === AssetType.CRYPTO) {
        try {
          // Binance expects pairs like BTCUSDT
          const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
          const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
          if (response.ok) {
              const data = await response.json();
              newPrice = parseFloat(data.price) * USDT_VND_RATE;
          }
        } catch (error) {
          console.warn(`[Crypto] Failed to fetch price for ${symbol}`, error);
        }
      } 
      
      // 2. STOCK & ETF - VNDIRECT API (via CORS Proxy)
      else if (asset.type === AssetType.STOCK || asset.type === AssetType.ETF) {
        try {
           const targetUrl = `https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${symbol}&size=1`;
           const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
           const response = await fetch(proxyUrl);
           if (response.ok) {
             const json = await response.json();
             if (json && json.data && json.data.length > 0) {
                newPrice = json.data[0].close * 1000;
             }
           }
        } catch (error) {
          console.warn(`[Stock] Failed to fetch price for ${symbol}`, error);
        }
      }

      // If price changed, update backend
      if (newPrice !== asset.currentPrice) {
          await updateAssetPrice(asset.id, newPrice);
      }
      
      return { ...asset, currentPrice: newPrice };
    }));
    
    // In a real app, we might rely on re-fetching from DB, but passing local result is faster
    setAssets(updatedAssets);
    setIsRefreshing(false);
  };

  // --- Actions ---

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newQty || !newBuyPrice) return;

    let currentPrice = parseFloat(newBuyPrice);
    const upperSymbol = newSymbol.toUpperCase();

    // Try to auto-fetch price immediately upon adding
    try {
        if (newType === AssetType.CRYPTO) {
            const pair = upperSymbol.endsWith('USDT') ? upperSymbol : `${upperSymbol}USDT`;
            const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
            if (response.ok) {
                const data = await response.json();
                currentPrice = parseFloat(data.price) * USDT_VND_RATE;
            }
        } else {
             // Fetch Stock Price
             const targetUrl = `https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${upperSymbol}&size=1`;
             const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
             const response = await fetch(proxyUrl);
             if (response.ok) {
                 const json = await response.json();
                 if (json.data && json.data.length > 0) {
                     currentPrice = json.data[0].close * 1000;
                 }
             }
        }
    } catch (e) {
        console.log("Could not fetch initial price, using buy price as default.");
    }

    const newAsset: Asset = {
      id: Date.now().toString(),
      symbol: upperSymbol,
      type: newType,
      quantity: parseFloat(newQty),
      buyPrice: parseFloat(newBuyPrice),
      currentPrice: currentPrice,
      createdAt: Date.now(),
    };

    await addAsset(newAsset);
    await fetchData();
    
    // Reset form
    setNewSymbol('');
    setNewQty('');
    setNewBuyPrice('');
  };

  const confirmDelete = async () => {
    if (assetToDelete) {
        await removeAsset(assetToDelete.id);
        await fetchData();
        setAssetToDelete(null);
    }
  };

  // --- Calculations ---
  const calculations = useMemo(() => {
    // Note: Summary stats usually show Global status, not just filtered view, 
    // but for a tracker dashboard, let's base it on "What am I looking at?" (Filtered)
    // However, Goal progress should likely be GLOBAL. 
    // Let's do: Summary Cards = Global. Table = Filtered.
    
    let totalInvested = 0;
    let currentValue = 0;
    
    // Calculate Global Stats for the Goal Chart
    assets.forEach(a => {
        totalInvested += a.buyPrice * a.quantity;
        currentValue += a.currentPrice * a.quantity;
    });

    const totalProfit = currentValue - totalInvested;
    // Cap at 100% for chart visualization logic, but store real % for display
    const rawPercent = (totalProfit / settings.investmentGoal) * 100;
    const progressPercent = Math.min(100, Math.max(0, rawPercent));

    return { totalInvested, currentValue, totalProfit, progressPercent, rawPercent };
  }, [assets, settings.investmentGoal]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
  };

  // Chart Data: Global Assets
  const radialData = [
    {
      name: 'Goal',
      uv: calculations.progressPercent,
      fill: calculations.totalProfit >= 0 ? '#10b981' : '#f43f5e',
    }
  ];

  if (isLoadingData) {
    return (
        <div className="h-full flex items-center justify-center bg-gray-50">
             <div className="flex flex-col items-center gap-2">
                 <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-slate-400 text-sm">Loading portfolio...</span>
             </div>
        </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 pb-20 md:pb-0">
       {/* Header with Filter */}
      <header className="px-4 py-4 md:px-8 md:py-6 border-b border-gray-200 bg-white shrink-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Investments</h1>
                <p className="text-slate-500 text-sm">Track your portfolio performance.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                 {/* Refresh Button */}
                <button 
                    onClick={fetchMarketPrices}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 text-xs md:text-sm font-medium text-brand hover:text-brand-hover bg-brand-light/50 hover:bg-brand-light px-3 py-2 md:px-4 md:py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                    <span className={`text-base md:text-lg ${isRefreshing ? 'animate-spin' : ''}`}>↻</span>
                    {isRefreshing ? 'Updating...' : 'Sync Prices'}
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                    <div className="bg-gray-100 p-1 rounded-lg flex shrink-0">
                        {(['all', 'year', 'month', 'week', 'day'] as const).map((m) => (
                            <button
                            key={m}
                            onClick={() => setFilterMode(m)}
                            className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all capitalize whitespace-nowrap ${
                                filterMode === m ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-900'
                            }`}
                            >
                            {m}
                            </button>
                        ))}
                    </div>

                    {filterMode !== 'all' && (
                        <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-1 gap-1 shrink-0">
                            <button onClick={handlePrevPeriod} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-slate-500">‹</button>
                            <div className="px-2 min-w-[80px] md:min-w-[120px] text-center font-semibold text-slate-700 text-xs md:text-sm select-none truncate">{getFilterLabel()}</div>
                            <button onClick={handleNextPeriod} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-slate-500">›</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        
        {/* Goal Section & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
            {/* Goal Radial Chart */}
            <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden min-h-[250px]">
                <h3 className="absolute top-6 left-6 font-bold text-slate-700 text-sm uppercase tracking-wide">Goal 2026</h3>
                <div className="relative w-full h-[180px] md:h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart 
                            innerRadius="70%" 
                            outerRadius="100%" 
                            barSize={20} 
                            data={radialData} 
                            startAngle={180} 
                            endAngle={0}
                            cy="80%"
                        >
                            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                            <RadialBar
                                background
                                dataKey="uv"
                                cornerRadius={10}
                                label={false}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 pointer-events-none">
                        <span className={`text-4xl font-bold ${calculations.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {calculations.rawPercent.toFixed(1)}%
                        </span>
                        <span className="text-slate-400 text-xs mt-1">of 100M VND Target</span>
                    </div>
                </div>
                <div className="w-full mt-2 text-center">
                    <p className="text-slate-500 text-sm">
                        Profit: <span className="font-bold text-slate-800">{formatCurrency(calculations.totalProfit)}</span>
                    </p>
                </div>
            </div>

            {/* Numeric Stats */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg text-2xl">💰</div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Current Valuation</p>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900 ml-1">{formatCurrency(calculations.currentValue)}</p>
                    <p className="text-xs text-slate-400 ml-1 mt-2">Total assets market value</p>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg text-2xl">📥</div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Total Invested</p>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-slate-900 ml-1">{formatCurrency(calculations.totalInvested)}</p>
                    <p className="text-xs text-slate-400 ml-1 mt-2">Initial capital deployed</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            {/* Table Section */}
            <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">Portfolio Assets</h3>
                    <span className="text-xs font-semibold bg-gray-100 text-slate-500 px-2 py-1 rounded">
                        {filteredAssets.length} Items
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 min-w-[600px]">
                    <thead className="bg-gray-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                        <th className="px-6 py-4">Asset</th>
                        <th className="px-6 py-4 text-right">Holdings</th>
                        <th className="px-6 py-4 text-right">Avg Buy</th>
                        <th className="px-6 py-4 text-right">Market Price</th>
                        <th className="px-6 py-4 text-right">Profit/Loss</th>
                        <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredAssets.map((asset) => {
                        const profit = (asset.currentPrice - asset.buyPrice) * asset.quantity;
                        const percent = asset.buyPrice > 0 ? ((asset.currentPrice - asset.buyPrice) / asset.buyPrice) * 100 : 0;
                        return (
                            <tr key={asset.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0
                                        ${asset.type === AssetType.CRYPTO ? 'bg-orange-500' : asset.type === AssetType.STOCK ? 'bg-blue-500' : 'bg-purple-500'}
                                    `}>
                                        {asset.symbol[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">{asset.symbol}</div>
                                        <div className="text-[10px] uppercase text-slate-400">{asset.type} • {new Date(asset.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right font-medium">{asset.quantity}</td>
                            <td className="px-6 py-4 text-right">{formatCurrency(asset.buyPrice)}</td>
                            <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatCurrency(asset.currentPrice)}</td>
                            <td className="px-6 py-4 text-right">
                                <div className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                                </div>
                                <div className={`text-xs ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {percent.toFixed(2)}%
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button 
                                    onClick={() => setAssetToDelete(asset)} 
                                    className="md:opacity-0 md:group-hover:opacity-100 text-slate-300 hover:text-rose-600 transition-all font-bold text-lg px-2"
                                    title="Remove Asset"
                                >
                                    ×
                                </button>
                            </td>
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                    {filteredAssets.length === 0 && (
                        <div className="p-12 text-center">
                            <p className="text-slate-400 mb-2">No assets found for this period.</p>
                            <button onClick={() => setFilterMode('all')} className="text-brand text-sm font-medium hover:underline">View All</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar: Add Asset Form */}
            <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm h-fit">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="bg-brand text-white w-6 h-6 rounded flex items-center justify-center text-sm">+</span> 
                    Add New Asset
                </h3>
                <form onSubmit={handleAddAsset} className="space-y-5">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Asset Symbol</label>
                        <input 
                            type="text" 
                            value={newSymbol} 
                            onChange={e => setNewSymbol(e.target.value)} 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all uppercase placeholder:normal-case" 
                            placeholder="e.g. BTC, ETH, HPG" 
                        />
                        <p className="text-[10px] text-slate-400 mt-1">For Crypto, we'll try to fetch price from Binance.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">For Stock/ETF, we'll try to fetch from Vietnam Market.</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Type</label>
                        <select 
                            value={newType} 
                            onChange={e => setNewType(e.target.value as AssetType)} 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        >
                            {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        </div>
                        <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Quantity</label>
                        <input 
                            type="number" 
                            step="any" 
                            value={newQty} 
                            onChange={e => setNewQty(e.target.value)} 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" 
                            placeholder="0.00"
                        />
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Buy Price (VND)</label>
                        <input 
                            type="number" 
                            value={newBuyPrice} 
                            onChange={e => setNewBuyPrice(e.target.value)} 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" 
                            placeholder="e.g. 50000000"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-brand hover:bg-brand-hover text-white py-3 rounded-lg font-bold shadow-lg shadow-brand/20 transition-all active:scale-[0.98] mt-2"
                    >
                        Add to Portfolio
                    </button>
                </form>
            </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {assetToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-100">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <h3 className="text-lg font-bold text-slate-900">Remove Asset?</h3>
            </div>
            
            <p className="text-slate-600 mb-6">
              Are you sure you want to remove <strong>"{assetToDelete.symbol}"</strong>? This will affect your profit calculations.
            </p>
            
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button 
                onClick={() => setAssetToDelete(null)}
                className="px-4 py-2 text-slate-500 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-rose-700 shadow-sm transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};