import React, { useState } from 'react';
import { StockOption, OptionsChainData } from '../types';
import { fetchOptionsData, exportToCSV } from '../services/stockService';
import { TradingViewChart } from './TradingViewChart';

export const StockAnalysis: React.FC = () => {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [optionsData, setOptionsData] = useState<OptionsChainData | null>(null);
    const [activeTab, setActiveTab] = useState<'calls' | 'puts'>('calls');
    const [selectedExpirations, setSelectedExpirations] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<keyof StockOption | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [showChart, setShowChart] = useState(false);
    const RECORDS_PER_PAGE = 20;

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
            setSelectedExpirations(data.expirationOptions.length > 0 ? [data.expirationOptions[0].date] : []);
            setCurrentPage(1);
            setSortColumn(null);
            setSortDirection('asc');
            setShowChart(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
            setOptionsData(null);
            setShowChart(false);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const toggleExpiration = (date: string) => {
        setSelectedExpirations(prev =>
            prev.includes(date)
                ? prev.filter(d => d !== date)
                : [...prev, date]
        );
        setCurrentPage(1);
    };

    const clearAllExpirations = () => {
        setSelectedExpirations([]);
        setCurrentPage(1);
    };

    const selectAllExpirations = () => {
        if (!optionsData) return;
        setSelectedExpirations(optionsData.expirationOptions.map(exp => exp.date));
        setCurrentPage(1);
    };

    const handleSort = (column: keyof StockOption) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const getFilteredData = (): StockOption[] => {
        if (!optionsData) return [];

        const data = activeTab === 'calls'
            ? optionsData.calls
            : optionsData.puts;

        if (selectedExpirations.length === 0) return [];

        let filtered = data.filter(o =>
            selectedExpirations.includes(o.expirationDate)
        );

        if (sortColumn) {
            filtered = [...filtered].sort((a, b) => {
                const aVal = a[sortColumn];
                const bVal = b[sortColumn];

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                let comparison = 0;
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    comparison = aVal.localeCompare(bVal);
                } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                    comparison = aVal - bVal;
                } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
                    comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1;
                }

                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    };

    const handleExport = () => {
        const data = getFilteredData();
        const filename = `${optionsData?.symbol}_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
        exportToCSV(data, filename);
    };

    const filteredData = getFilteredData();
    const totalPages = Math.ceil(filteredData.length / RECORDS_PER_PAGE);
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    const endIndex = startIndex + RECORDS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const formatNumber = (num: number | null, decimals = 2) =>
        num === null || num === undefined ? 'N/A' : num.toFixed(decimals);

    const formatPercent = (num: number | null) =>
        num === null || num === undefined ? 'N/A' : `${(num * 100).toFixed(2)}%`;

    const SortIcon: React.FC<{ column: keyof StockOption }> = ({ column }) => {
        if (sortColumn !== column) {
            return <span className="text-gray-400 ml-1">⇅</span>;
        }
        return (
            <span className="ml-1">
                {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
        );
    };

    return (
        <div className="p-6 bg-gray-50 min-h-full">
            <div className="max-w-7xl mx-auto">

                {/* SEARCH */}
                <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                    <div className="flex gap-3">
                        <input
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter symbol (AAPL, TSLA...)"
                            className="flex-1 border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={loading}
                        />

                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Loading</span>
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

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {/* TRADINGVIEW CHART */}
                {showChart && optionsData && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-700">Price Chart</h3>
                            <button
                                onClick={() => setShowChart(!showChart)}
                                className="text-sm text-gray-600 hover:text-gray-800"
                            >
                                {showChart ? 'Hide Chart' : 'Show Chart'}
                            </button>
                        </div>
                        <div className="p-4">
                            <TradingViewChart symbol={optionsData.symbol} height={500} />
                        </div>
                    </div>
                )}

                {optionsData && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">

                        {/* HEADER */}
                        <div className="p-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white flex justify-between items-center">
                            <div className="text-2xl font-bold">{optionsData.symbol}</div>
                            <div className="text-xl font-semibold">${formatNumber(optionsData.currentPrice)}</div>
                        </div>

                        {/* EXPIRATION FILTER - CHECKBOX TAGS */}
                        <div className="p-5 border-b bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-semibold text-gray-700">
                                    Expiration Dates
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllExpirations}
                                        disabled={selectedExpirations.length === optionsData.expirationOptions.length}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        onClick={clearAllExpirations}
                                        disabled={selectedExpirations.length === 0}
                                        className="text-xs text-gray-600 hover:text-gray-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {optionsData.expirationOptions.map(exp => {
                                    const isSelected = selectedExpirations.includes(exp.date);
                                    return (
                                        <button
                                            key={exp.date}
                                            onClick={() => toggleExpiration(exp.date)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                            }`}
                                        >
                                            {exp.label}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            <p className="text-xs text-gray-500 mt-3">
                                {selectedExpirations.length === 0 
                                    ? 'Please select at least one expiration date to view data'
                                    : `${selectedExpirations.length} expiration date(s) selected`
                                }
                            </p>
                        </div>

                        {/* TABS */}
                        <div className="flex border-b">
                            {['calls', 'puts'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => {
                                        setActiveTab(t as any);
                                        setCurrentPage(1);
                                    }}
                                    className={`flex-1 py-3 font-semibold transition-colors ${
                                        activeTab === t 
                                            ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* EXPORT */}
                        <div className="p-4 border-b bg-gray-50">
                            <button
                                onClick={handleExport}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                            >
                                <span>📊</span>
                                <span>Export to CSV</span>
                            </button>
                        </div>

                        {/* TABLE */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-r from-gray-100 to-gray-200 border-b-2 border-gray-300">
                                    <tr>
                                        <th 
                                            onClick={() => handleSort('expirationDate')}
                                            className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center">
                                                Expiration
                                                <SortIcon column="expirationDate" />
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('strike')}
                                            className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center justify-end">
                                                Strike
                                                <SortIcon column="strike" />
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('bid')}
                                            className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center justify-end">
                                                Bid
                                                <SortIcon column="bid" />
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('ask')}
                                            className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center justify-end">
                                                Ask
                                                <SortIcon column="ask" />
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('impliedVolatility')}
                                            className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center justify-end">
                                                IV
                                                <SortIcon column="impliedVolatility" />
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('inTheMoney')}
                                            className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                        >
                                            <div className="flex items-center justify-center">
                                                ITM
                                                <SortIcon column="inTheMoney" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((o, index) => (
                                        <tr 
                                            key={o.contractSymbol} 
                                            className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                            }`}
                                        >
                                            <td className="px-4 py-3 text-left border-r border-gray-200">
                                                {o.expirationDate}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium border-r border-gray-200">
                                                ${formatNumber(o.strike)}
                                            </td>
                                            <td className="px-4 py-3 text-right border-r border-gray-200">
                                                ${formatNumber(o.bid)}
                                            </td>
                                            <td className="px-4 py-3 text-right border-r border-gray-200">
                                                ${formatNumber(o.ask)}
                                            </td>
                                            <td className="px-4 py-3 text-right border-r border-gray-200">
                                                {formatPercent(o.impliedVolatility)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {o.inTheMoney ? (
                                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                                                ) : (
                                                    <span className="inline-block w-2 h-2 bg-gray-300 rounded-full"></span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* PAGINATION */}
                        {totalPages > 1 && (
                            <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} contracts
                                </div>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    
                                    <div className="flex gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                            if (
                                                page === 1 ||
                                                page === totalPages ||
                                                (page >= currentPage - 1 && page <= currentPage + 1)
                                            ) {
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                            currentPage === page
                                                                ? 'bg-blue-600 text-white'
                                                                : 'border border-gray-300 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            } else if (
                                                page === currentPage - 2 ||
                                                page === currentPage + 2
                                            ) {
                                                return <span key={page} className="px-2 py-1.5">...</span>;
                                            }
                                            return null;
                                        })}
                                    </div>
                                    
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* EMPTY STATE */}
                        {filteredData.length === 0 && selectedExpirations.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                <div className="text-lg mb-2">📅</div>
                                <div>Please select at least one expiration date above to view options data</div>
                            </div>
                        )}

                        {filteredData.length === 0 && selectedExpirations.length > 0 && (
                            <div className="p-8 text-center text-gray-500">
                                No contracts found for the selected expiration dates
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};