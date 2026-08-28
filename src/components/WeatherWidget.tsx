import { useState, useEffect } from 'react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun } from 'lucide-react';

// WMO Weather interpretation codes (https://open-meteo.com/en/docs)
const getWeatherIcon = (code: number) => {
  if (code === 0) return <Sun className="w-4 h-4 text-orange-400" />;
  if (code === 1 || code === 2 || code === 3) return <Cloud className="w-4 h-4 text-gray-400" />;
  if (code === 45 || code === 48) return <CloudFog className="w-4 h-4 text-gray-400" />;
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return <CloudDrizzle className="w-4 h-4 text-blue-400" />;
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67 || code === 80 || code === 81 || code === 82) return <CloudRain className="w-4 h-4 text-blue-500" />;
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return <CloudSnow className="w-4 h-4 text-blue-200" />;
  if (code === 95 || code === 96 || code === 99) return <CloudLightning className="w-4 h-4 text-yellow-500" />;
  return <Sun className="w-4 h-4 text-orange-400" />;
};

const getWeatherText = (code: number) => {
  if (code === 0) return 'Trời quang';
  if (code === 1 || code === 2 || code === 3) return 'Nhiều mây';
  if (code === 45 || code === 48) return 'Có sương mù';
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return 'Mưa phùn';
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67 || code === 80 || code === 81 || code === 82) return 'Có mưa';
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'Có tuyết';
  if (code === 95 || code === 96 || code === 99) return 'Có sấm chớp';
  return 'Hà Nội';
};

export function WeatherWidget() {
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Hanoi coordinates
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,weather_code');
        const data = await res.json();
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code
        });
      } catch (error) {
        console.error("Failed to fetch weather", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !weather) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm" title={getWeatherText(weather.code)}>
      {getWeatherIcon(weather.code)}
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
        {weather.temp}°C
      </span>
    </div>
  );
}
