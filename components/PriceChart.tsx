'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PriceChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { data } = useSWR(() => `/api/chart?symbol=${symbol}`, fetcher, { refreshInterval: 15000 });

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#222'
      },
      grid: {
        vertLines: { color: '#eee' },
        horzLines: { color: '#eee' }
      }
    });
    const series: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries();
    if (data?.candles) {
      series.setData(data.candles);
    }
    const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data]);

  return <div ref={containerRef} style={{ height: 320 }} />;
}
