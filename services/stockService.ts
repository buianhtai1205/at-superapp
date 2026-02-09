import { OptionsChainData, StockApiError } from '../types';

const API_BASE_URL = import.meta.env?.DEV ? 'http://localhost:8000' : '';

export async function fetchOptionsData(
    symbol: string,
    expiration?: string
): Promise<OptionsChainData> {
    try {
        const endpoint = import.meta.env?.DEV ? '/stock-options' : '/api/stock-options';
        const params = new URLSearchParams({ symbol });

        // Add expiration if specified
        if (expiration) {
            params.append('expiration', expiration);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}?${params}`);

        if (!response.ok) {
            const errorData: StockApiError = await response.json();
            throw new Error(errorData.error || `Failed to fetch options data: ${response.statusText}`);
        }

        const data: OptionsChainData = await response.json();
        return data;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unknown error occurred while fetching stock options');
    }
}

export function exportToCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}