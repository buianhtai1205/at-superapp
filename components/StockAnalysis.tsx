import React, { useState } from 'react';
import { StockOption, OptionsChainData, FilterConfig } from '../types';
import { fetchOptionsData, exportToCSV } from '../services/stockService';

export const StockAnalysis: React.FC = () => {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [optionsData, setOptionsData] = useState<OptionsChainData | null>(null);
    const [activeTab, setActiveTab] = useState<'calls' | 'puts'>('calls');
    const [filters, setFilters] = useState<FilterConfig[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const handleSearch = async () => {
        if (!symbol.trim()) {
            setError('Please enter a stock symbol');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await fetchOptionsData(symbol.trim());
            setOptionsData(data);
            setFilters([]);
            setSearchQuery('');
            setSortConfig(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
            setOptionsData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const getFilteredData = (): StockOption[] => {
        if (!optionsData) return [];

        let data = activeTab === 'calls' ? optionsData.calls : optionsData.puts;

        // Apply search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(option =>
                Object.values(option).some(val =>
                    String(val).toLowerCase().includes(query)
                )
            );
        }

        // Apply filters
        filters.forEach(filter => {
            if (filter.type === 'number' && typeof filter.value === 'object') {
                const { min, max } = filter.value as { min?: number; max?: number };
                data = data.filter(option => {
                    const val = (option as any)[filter.column];
                    if (val === null || val === undefined) return false;
                    if (min !== undefined && val < min) return false;
                    if (max !== undefined && val > max) return false;
                    return true;
                });
            } else if (filter.type === 'text') {
                data = data.filter(option =>
                    String((option as any)[filter.column]).toLowerCase().includes(String(filter.value).toLowerCase())
                );
            } else if (filter.type === 'boolean') {
                data = data.filter(option => (option as any)[filter.column] === filter.value);
            }
        });

        // Apply sorting
        if (sortConfig) {
            data = [...data].sort((a, b) => {
                const aVal = (a as any)[sortConfig.column];
                const bVal = (b as any)[sortConfig.column];

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    };

    const handleSort = (column: string) => {
        setSortConfig(prev => {
            if (!prev || prev.column !== column) {
                return { column, direction: 'asc' };
            }
            if (prev.direction === 'asc') {
                return { column, direction: 'desc' };
            }
            return null;
        });
    };

    const handleExport = () => {
        const data = getFilteredData();
        const filename = `${optionsData?.symbol}_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
        exportToCSV(data, filename);
    };

    const filteredData = getFilteredData();

    const formatNumber = (num: number | null, decimals = 2) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toFixed(decimals);
    };

    const formatPercent = (num: number | null) => {
        if (num === null || num === undefined) return 'N/A';
        return `${(num * 100).toFixed(2)}%`;
    };

    return (
        <div className="p-6 md:p-10 bg-gray-50 min-h-full">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900">Stock Options Analysis</h1>
                    <p className="text-slate-500 text-base md:text-lg">Analyze stock options with advanced filtering capabilities</p>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter stock symbol (e.g., RKLB, AAPL, TSLA)"
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-lg"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-6 py-3 bg-brand text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    <span>Loading...</span>
                                </>
                            ) : (
                                <>
                                    <span>🔍</span>
                                    <span>Analyze</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-xl mb-6">
                        <p className="font-semibold">⚠️ Error</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                )}

                {/* Results */}
                {optionsData && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Stock Info Header */}
                        <div className="bg-gradient-to-r from-brand to-blue-700 text-white p-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold">{optionsData.symbol}</h2>
                                    <p className="text-blue-100 text-sm mt-1">Expiration: {optionsData.expirationDate}</p>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm text-blue-100">Current Price:</span>
                                    <span className="text-3xl font-bold">${formatNumber(optionsData.currentPrice)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 bg-gray-50">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab('calls')}
                                    className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'calls'
                                        ? 'bg-white text-brand border-b-2 border-brand'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    📈 Calls ({optionsData.calls.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('puts')}
                                    className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'puts'
                                        ? 'bg-white text-rose-600 border-b-2 border-rose-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    📉 Puts ({optionsData.puts.length})
                                </button>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="bg-gray-50 border-b border-gray-200 p-4">
                            <div className="flex flex-col md:flex-row gap-3">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="🔍 Search all columns..."
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${showFilters
                                            ? 'bg-brand text-white'
                                            : 'bg-white border border-gray-300 text-slate-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {showFilters ? '✓' : '☰'} Filters
                                    </button>
                                    {filters.length > 0 && (
                                        <button
                                            onClick={() => setFilters([])}
                                            className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg font-medium hover:bg-rose-200 transition-colors"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                    <button
                                        onClick={handleExport}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                                    >
                                        📊 Export CSV
                                    </button>
                                </div>
                            </div>

                            {/* Active Filters Display */}
                            {filters.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {filters.map((filter, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-2 bg-brand/10 text-brand px-3 py-1 rounded-full text-sm"
                                        >
                                            <span className="font-medium">{filter.column}:</span>
                                            <span>{typeof filter.value === 'object'
                                                ? `${(filter.value as any).min ?? '∞'} - ${(filter.value as any).max ?? '∞'}`
                                                : String(filter.value)
                                            }</span>
                                            <button
                                                onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                                                className="hover:text-rose-600 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-100 border-b border-gray-200">
                                    <tr>
                                        {['Contract', 'Strike', 'Last', 'Bid', 'Ask', 'Volume', 'Open Int.', 'IV', 'ITM'].map((header, idx) => {
                                            const columnKey = ['contractSymbol', 'strike', 'lastPrice', 'bid', 'ask', 'volume', 'openInterest', 'impliedVolatility', 'inTheMoney'][idx];
                                            return (
                                                <th
                                                    key={header}
                                                    onClick={() => handleSort(columnKey)}
                                                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span>{header}</span>
                                                        {sortConfig?.column === columnKey && (
                                                            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                                                No options found matching your filters
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((option, idx) => (
                                            <tr
                                                key={option.contractSymbol}
                                                className={`hover:bg-gray-50 transition-colors ${option.inTheMoney ? 'bg-emerald-50/50' : ''
                                                    }`}
                                            >
                                                <td className="px-4 py-3 text-xs font-mono text-slate-700">
                                                    {option.contractSymbol}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-900">
                                                    ${formatNumber(option.strike)}
                                                </td>
                                                <td className="px-4 py-3 text-slate-800">
                                                    ${formatNumber(option.lastPrice)}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {option.bid !== null ? `$${formatNumber(option.bid)}` : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {option.ask !== null ? `$${formatNumber(option.ask)}` : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {option.volume !== null ? option.volume.toLocaleString() : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {option.openInterest !== null ? option.openInterest.toLocaleString() : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {formatPercent(option.impliedVolatility)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-block w-3 h-3 rounded-full ${option.inTheMoney ? 'bg-emerald-500' : 'bg-gray-300'
                                                        }`}></span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 text-sm text-slate-600">
                            Showing {filteredData.length} of {activeTab === 'calls' ? optionsData.calls.length : optionsData.puts.length} contracts
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
