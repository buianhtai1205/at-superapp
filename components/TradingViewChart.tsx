import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
    symbol: string;
    theme?: 'light' | 'dark';
    height?: number;
}

declare global {
    interface Window {
        TradingView: any;
    }
}

export const TradingViewChart: React.FC<TradingViewChartProps> = memo(({ 
    symbol, 
    theme = 'light',
    height = 500 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scriptLoadedRef = useRef(false);

    useEffect(() => {
        // Cleanup function to remove old widget
        const cleanup = () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };

        const initWidget = () => {
            if (!containerRef.current || !window.TradingView) return;

            cleanup();

            new window.TradingView.widget({
                autosize: true,
                symbol: symbol.toUpperCase(), // TradingView tự detect exchange
                interval: 'D',                 // Default: Daily
                timezone: 'Etc/UTC',
                theme: theme,
                style: '1',                    // Candlestick
                locale: 'en',
                toolbar_bg: theme === 'light' ? '#f1f3f6' : '#1e222d',
                enable_publishing: false,
                hide_side_toolbar: false,
                allow_symbol_change: true,
                container_id: containerRef.current.id,
                
                // Studies (indicators)
                studies: [
                    'STD;SMA',              // Simple Moving Average
                ],
                
                // Customization
                disabled_features: [
                    // 'header_symbol_search',  // Uncomment to hide search
                    // 'header_compare',        // Uncomment to hide compare
                ],
                enabled_features: [
                    'study_templates',
                    'side_toolbar_in_fullscreen_mode',
                ],
                
                // Time frames
                // available_timeframes: ['1D', '1W', '1M'],
                
                // Override default properties
                overrides: {
                    "mainSeriesProperties.candleStyle.upColor": "#26a69a",
                    "mainSeriesProperties.candleStyle.downColor": "#ef5350",
                    "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
                    "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
                    "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
                    "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350",
                },
            });
        };

        // Load TradingView script
        if (!scriptLoadedRef.current) {
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => {
                scriptLoadedRef.current = true;
                initWidget();
            };
            document.head.appendChild(script);
        } else {
            initWidget();
        }

        return cleanup;
    }, [symbol, theme]);

    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <div 
                id={`tradingview_${symbol}`} 
                ref={containerRef} 
                className="h-full w-full"
            />
        </div>
    );
});

TradingViewChart.displayName = 'TradingViewChart';