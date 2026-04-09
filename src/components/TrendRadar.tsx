import React, { useState } from "react";
import { TrendingUp, RefreshCw, Loader2, ExternalLink, Lightbulb } from "lucide-react";
import axios from "axios";
import { analyzeTrends } from "../lib/gemini";
import { useAppStore } from "../store";

export function TrendRadar() {
  const { niche, expertName, targetAudience, toneOfVoice, clarification, trendsData, setTrendsData } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [trends, setTrends] = useState<any>(trendsData);
  const [error, setError] = useState<string | null>(null);

  const fetchAndAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const sources = [
        { name: "Google Trends (RU)", url: "https://trends.google.com/trends/trendingsearches/daily/rss?geo=RU" },
        { name: "Google Trends (US)", url: "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US" },
        { name: "Google News (Niche)", url: `https://news.google.com/rss/search?q=${encodeURIComponent(niche)}&hl=ru&gl=RU&ceid=RU:ru` },
        { name: "Medium AI", url: "https://medium.com/feed/tag/artificial-intelligence" },
        { name: "Medium Startup", url: "https://medium.com/feed/tag/startup" },
      ];

      const rssData = await Promise.all(
        sources.map(async (source) => {
          try {
            const response = await axios.get(`/api/rss-proxy?url=${encodeURIComponent(source.url)}`, { timeout: 15000 });
            
            // Handle the new proxy error format
            if (response.data.error) {
              console.warn(`Source ${source.name} unavailable (${response.data.status || "Error"})`);
              return "";
            }

            const parser = new DOMParser();
            // If the proxy returns JSON (the error object), this will fail, but we handled it above
            const xmlDoc = parser.parseFromString(response.data, "text/xml");
            
            const parseError = xmlDoc.getElementsByTagName("parsererror");
            if (parseError.length > 0) return "";

            const items = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 10);
            const titles = items.map(item => item.querySelector("title")?.textContent).filter(Boolean);

            return titles.length > 0 ? `Source: ${source.name}\nTrends: ${titles.join("; ")}` : "";
          } catch (e: any) {
            console.warn(`Failed to fetch ${source.name}:`, e.message);
            return "";
          }
        })
      );

      const combinedData = rssData.filter(data => data && data.length > 10).join("\n\n");
      
      // If RSS fails, we still proceed but warn the user that we're using AI Search fallback
      if (!combinedData || combinedData.length < 30) {
        setAnalyzing(true);
      }

      setAnalyzing(true);
      const analysis = await analyzeTrends(combinedData, niche, expertName, targetAudience, toneOfVoice, clarification);
      setTrends(analysis);
      setTrendsData(analysis);
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при анализе трендов");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      <div className="p-8 border-b border-green-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-green-900 flex items-center gap-3">
            <TrendingUp className="text-green-600" size={32} /> Тренд-радар
          </h2>
          <p className="text-green-700/70 mt-1">Мониторинг актуальных трендов и их адаптация под вашу нишу</p>
        </div>
        <button
          onClick={fetchAndAnalyze}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-green-200 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
          {loading ? (analyzing ? "Анализируем..." : "Загружаем...") : "Обновить тренды"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-green-50/30">
        {error && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-700 mb-6">
            {error}
          </div>
        )}

        {!trends && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <TrendingUp size={40} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-900 mb-2">Готовы найти тренды?</h3>
            <p className="text-green-700/70">
              Нажмите кнопку выше, чтобы собрать актуальные новости из Google Trends, Google News и Medium для вашей ниши: 
              <span className="font-bold text-green-800"> {niche}</span>
            </p>
          </div>
        )}

        {loading && (
          <div className="h-full flex flex-col items-center justify-center space-y-6 text-center max-w-sm mx-auto">
            <div className="relative">
              <Loader2 className="animate-spin text-green-600" size={64} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-green-900 font-bold text-lg">
                {analyzing ? "Gemini 3.1 анализирует данные..." : "Собираем свежие тренды..."}
              </p>
              <p className="text-green-700/60 text-sm leading-relaxed">
                {analyzing 
                  ? "Мы используем поиск Google в реальном времени, чтобы найти самые актуальные новости для вашей ниши." 
                  : "Опрашиваем Google Trends, Google News и Medium. Это может занять до 15 секунд."}
              </p>
            </div>
          </div>
        )}

        {trends && !loading && (
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
              <h4 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
                <Lightbulb className="text-amber-500" size={20} /> Резюме дня
              </h4>
              <p className="text-green-800 leading-relaxed italic">"{trends.summary}"</p>
            </div>

            <div className="grid gap-6">
              {trends.trends.map((trend: any, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        {trend.source}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-green-900 mb-3">{trend.title}</h3>
                    <p className="text-green-800/80 text-sm mb-4">{trend.relevance}</p>
                    
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Идеи для контента:</p>
                      {trend.contentIdeas.map((idea: any, i: number) => (
                        <div key={i} className="bg-green-50/50 p-4 rounded-xl border border-green-100/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-green-900">{idea.title}</span>
                            <span className="text-[10px] font-medium text-green-600 bg-white px-2 py-0.5 rounded border border-green-100 uppercase">
                              {idea.format}
                            </span>
                          </div>
                          <p className="text-sm text-green-800/70">{idea.angle}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
