import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../store";
import { generateVideoAvatarScript } from "../lib/gemini";
import { Copy, Download, Loader2, Check, Video, Edit2, RefreshCw } from "lucide-react";
import Markdown from "react-markdown";
import axios from "axios";

export function VideoAvatar() {
  const { contentPlan, settings, podcasts, niche, expertName, targetAudience, trendsData } = useAppStore();
  const [sourceType, setSourceType] = useState<"topic" | "podcast">("topic");
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [clarification, setClarification] = useState("");
  const [selectedPodcastId, setSelectedPodcastId] = useState("");
  const [duration, setDuration] = useState("30");
  
  const [loadingScript, setLoadingScript] = useState(false);
  const [script, setScript] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  
  const [avatars, setAvatars] = useState<any[]>([
    { id: "amy-aq6978un6t", name: "Amy", image_url: "https://create-images-results.d-id.com/DefaultAssets/image_01.png" },
    { id: "will-m7p6q5n8v9", name: "Will", image_url: "https://create-images-results.d-id.com/DefaultAssets/image_02.png" },
  ]);
  const [voices, setVoices] = useState<any[]>([
    { id: "ru-RU-DmitryNeural", name: "Dmitry (RU)", gender: "Male" },
    { id: "ru-RU-SvetlanaNeural", name: "Svetlana (RU)", gender: "Female" },
  ]);
  const [selectedAvatar, setSelectedAvatar] = useState("amy-aq6978un6t");
  const [selectedVoice, setSelectedVoice] = useState("ru-RU-DmitryNeural");
  const [avatarSearch, setAvatarSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [themeFilter, setThemeFilter] = useState("all");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [avatarPage, setAvatarPage] = useState(0);
  const AVATARS_PER_PAGE = 6;

  const filteredAvatars = useMemo(() => {
    const base = avatars.length > 0 ? avatars : [
      { id: "amy-aq6978un6t", name: "Amy", image_url: "https://create-images-results.d-id.com/DefaultAssets/image_01.png", gender: "female", tags: ["young"] },
      { id: "will-m7p6q5n8v9", name: "Will", image_url: "https://create-images-results.d-id.com/DefaultAssets/image_02.png", gender: "male", tags: ["business"] },
    ];
    let filtered = base;

    // Apply Gender Filter
    if (genderFilter !== "all") {
      filtered = filtered.filter(a => a.gender === genderFilter);
    }

    // Apply Theme Filter
    if (themeFilter !== "all") {
      filtered = filtered.filter(a => a.tags?.includes(themeFilter));
    }

    // Apply Search Filter
    if (avatarSearch) {
      const lower = avatarSearch.toLowerCase();
      filtered = filtered.filter(a => (a.name || a.id).toLowerCase().includes(lower));
    }
    return filtered;
  }, [avatars, avatarSearch, genderFilter, themeFilter]);

  const allThemes = useMemo(() => {
    const themes = new Set<string>();
    avatars.forEach(a => {
      a.tags?.forEach((t: string) => themes.add(t));
    });
    return Array.from(themes).sort();
  }, [avatars]);

  const paginatedAvatars = useMemo(() => {
    const start = avatarPage * AVATARS_PER_PAGE;
    return filteredAvatars.slice(start, start + AVATARS_PER_PAGE);
  }, [filteredAvatars, avatarPage]);

  const totalPages = Math.ceil(filteredAvatars.length / AVATARS_PER_PAGE);

  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleVoicePreview = async () => {
    if (!selectedVoice) return;
    setPreviewLoading(true);
    try {
      const gender = selectedVoice.toLowerCase().includes("female") || selectedVoice.toLowerCase().includes("svetlana") ? "female" : "male";
      // Map to supported Gemini voices: 'Charon' (Male), 'Kore' (Female)
      const geminiVoice = gender === "female" ? "Kore" : "Charon";

      const { generateTTS } = await import("../lib/gemini");
      const url = await generateTTS("Привет! Это пример того, как я буду звучать в вашем видео.", geminiVoice);
      if (url) {
        const audio = new Audio(url);
        audio.play();
      }
    } catch (error) {
      console.error("Failed to preview voice:", error);
      // Fallback to browser TTS if Gemini fails
      const utterance = new SpeechSynthesisUtterance("Привет! Это пример моего голоса.");
      utterance.lang = "ru-RU";
      window.speechSynthesis.speak(utterance);
    } finally {
      setPreviewLoading(false);
    }
  };

  const allTopics = useMemo(() => {
    const topics: string[] = [];
    contentPlan.forEach((day) => {
      day.topics?.forEach((t: any) => {
        if (t.title && !topics.includes(t.title)) {
          topics.push(t.title);
        }
      });
    });
    return topics;
  }, [contentPlan]);

  useEffect(() => {
    if (settings.didApiKey) {
      fetchAvatarsAndVoices();
    }
  }, [settings.didApiKey]);

  const getDidAuthHeader = (key: string) => {
    const trimmed = key.trim().replace(/[^\x00-\x7F]/g, "");
    if (!trimmed) return "";
    
    // Case-insensitive check for Basic prefix
    if (trimmed.toLowerCase().startsWith('basic ')) {
      return 'Basic ' + trimmed.substring(6).trim();
    }
    
    // If it contains a colon, it's likely raw id:secret
    if (trimmed.includes(':')) {
      return `Basic ${btoa(trimmed)}`;
    }
    
    // Check if it's already a valid base64 string containing a colon when decoded
    try {
      const decoded = atob(trimmed);
      if (decoded.includes(':')) {
        return `Basic ${trimmed}`;
      }
    } catch (e) {
      // Not a valid base64 or doesn't contain a colon
    }
    
    // Default: treat as raw API key (username) with empty password
    return `Basic ${btoa(trimmed + ':')}`;
  };

  const fetchAvatarsAndVoices = async () => {
    try {
      const authHeader = getDidAuthHeader(settings.didApiKey || "");
      if (!authHeader) return;
      
      const response = await axios.get("/api/did/presenters", {
        headers: { "Authorization": authHeader }
      });
      
      const presenters = response.data?.presenters || response.data || [];
      if (Array.isArray(presenters) && presenters.length > 0) {
        const formatted = presenters.map((p: any) => ({
          id: p.presenter_id || p.id,
          name: p.name || p.presenter_id || p.id,
          image_url: p.image_url || p.thumbnail_url || p.picture_url,
          gender: p.gender || "unknown",
          tags: p.tags || []
        }));
        setAvatars(formatted);
        if (formatted.length > 0 && !formatted.find(a => a.id === selectedAvatar)) {
          setSelectedAvatar(formatted[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch D-id data:", error);
    }
  };

  const handleGenerateScript = async () => {
    let finalTopic = "";
    let podcastText = "";

    if (sourceType === "topic") {
      finalTopic = topic === "custom" ? customTopic : topic;
      if (!finalTopic) return;
    } else {
      const selectedPodcast = podcasts.find(p => p.id === selectedPodcastId);
      if (!selectedPodcast) return;
      finalTopic = selectedPodcast.topic;
      podcastText = selectedPodcast.script;
    }

    setLoadingScript(true);
    try {
      const text = await generateVideoAvatarScript(finalTopic, clarification, duration, podcastText, niche, expertName, targetAudience, trendsData);
      setScript(text);
      setVideoUrl(null);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to generate script:", error);
      alert("Ошибка при генерации сценария");
    } finally {
      setLoadingScript(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!script || !settings.didApiKey) {
      if (!settings.didApiKey) alert("Пожалуйста, добавьте API ключ D-id в настройках");
      return;
    }
    
    setLoadingVideo(true);
    setVideoStatus("Отправка запроса...");
    try {
      const authHeader = getDidAuthHeader(settings.didApiKey || "");
      if (!authHeader) throw new Error("Missing D-id API Key");

      const payload = {
        script: {
          type: "text",
          input: script,
          provider: {
            type: "microsoft",
            voice_id: selectedVoice || "ru-RU-DmitryNeural"
          }
        },
        source_url: avatars.find(a => a.id === selectedAvatar)?.image_url || "https://create-images-results.d-id.com/DefaultAssets/image_01.png"
      };

      const response = await axios.post("/api/did/talks", payload, {
        headers: { "Authorization": authHeader }
      });
      
      const talkId = response.data?.id;
      if (!talkId) throw new Error("No talk ID returned");

      pollVideoStatus(talkId);
    } catch (error) {
      console.error("Failed to generate video:", error);
      alert("Ошибка при генерации видео");
      setLoadingVideo(false);
    }
  };

  const pollVideoStatus = async (id: string) => {
    const authHeader = getDidAuthHeader(settings.didApiKey || "");
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/did/talks/${id}`, {
          headers: { "Authorization": authHeader }
        });
        
        const status = response.data?.status;
        if (status === "done") {
          clearInterval(interval);
          setVideoUrl(response.data.result_url);
          setLoadingVideo(false);
          setVideoStatus("");
        } else if (status === "error") {
          clearInterval(interval);
          alert("Ошибка генерации видео в D-id");
          setLoadingVideo(false);
          setVideoStatus("");
        } else {
          setVideoStatus(`Видео генерируется... (${status || 'processing'})`);
        }
      } catch (error) {
        console.error("Error polling status:", error);
      }
    }, 5000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGenerateScriptDisabled = loadingScript || 
    (sourceType === "topic" && (!topic || (topic === "custom" && !customTopic))) ||
    (sourceType === "podcast" && !selectedPodcastId);

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Parameters Panel */}
      <div className="w-1/3 min-w-[320px] max-w-md p-6 bg-white border-r border-green-100 flex flex-col overflow-y-auto">
        <h2 className="text-2xl font-bold text-green-900 mb-6">Видео-аватар</h2>

        <div className="space-y-6">
          {/* Source Toggle */}
          <div className="flex p-1 bg-green-50 rounded-xl">
            <button
              onClick={() => setSourceType("topic")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                sourceType === "topic" ? "bg-white text-green-900 shadow-sm" : "text-green-700 hover:text-green-900"
              }`}
            >
              По теме
            </button>
            <button
              onClick={() => setSourceType("podcast")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                sourceType === "podcast" ? "bg-white text-green-900 shadow-sm" : "text-green-700 hover:text-green-900"
              }`}
            >
              Из подкаста
            </button>
          </div>

          {sourceType === "topic" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-green-800 mb-1">Тема</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                >
                  <option value="">Выберите тему...</option>
                  {allTopics.map((t, i) => (
                    <option key={i} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="custom">Своя тема...</option>
                </select>
              </div>

              {topic === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-1">Своя тема</label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-green-800 mb-1">Уточнение (опционально)</label>
                <textarea
                  value={clarification}
                  onChange={(e) => setClarification(e.target.value)}
                  placeholder="Что обязательно упомянуть?"
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all resize-none h-24"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-green-800 mb-1">Выберите подкаст</label>
              {podcasts.length > 0 ? (
                <select
                  value={selectedPodcastId}
                  onChange={(e) => setSelectedPodcastId(e.target.value)}
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                >
                  <option value="">Выберите сохраненный подкаст...</option>
                  {podcasts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.topic} ({new Date(p.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200 text-sm text-center">
                  У вас пока нет сохраненных подкастов. Сначала создайте подкаст в соответствующем разделе.
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">Длительность</label>
            <div className="grid grid-cols-3 gap-2">
              {["5", "10", "15", "30", "45", "60"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                    duration === d
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                  }`}
                >
                  {d} сек
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateScript}
            disabled={isGenerateScriptDisabled}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loadingScript ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
            {loadingScript ? "Генерация..." : "Сгенерировать сценарий"}
          </button>
          
          {/* D-id Settings in Left Panel */}
          <div className="pt-6 border-t border-green-100">
            <h3 className="text-lg font-bold text-green-900 mb-4">Настройки D-id</h3>
            
            {!settings.didApiKey ? (
              <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200 text-sm">
                Для создания видео необходимо указать API ключ D-id в настройках.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-green-800">Аватар</label>
                    <button 
                      onClick={() => settings.didApiKey && fetchAvatarsAndVoices()}
                      className="text-green-600 hover:text-green-700 transition-colors"
                      title="Обновить список аватаров"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  {avatars.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <select 
                          value={genderFilter}
                          onChange={(e) => {
                            setGenderFilter(e.target.value);
                            setAvatarPage(0);
                          }}
                          className="p-2 bg-white border border-green-200 rounded-lg text-xs focus:ring-2 focus:ring-green-500 outline-none"
                        >
                          <option value="all">Все полы</option>
                          <option value="male">Мужчины</option>
                          <option value="female">Женщины</option>
                        </select>
                        <select 
                          value={themeFilter}
                          onChange={(e) => {
                            setThemeFilter(e.target.value);
                            setAvatarPage(0);
                          }}
                          className="p-2 bg-white border border-green-200 rounded-lg text-xs focus:ring-2 focus:ring-green-500 outline-none"
                        >
                          <option value="all">Все темы</option>
                          {allThemes.map(theme => (
                            <option key={theme} value={theme}>{theme}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Поиск аватара..."
                        value={avatarSearch}
                        onChange={(e) => {
                          setAvatarSearch(e.target.value);
                          setAvatarPage(0);
                        }}
                        className="w-full p-2 bg-white border border-green-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                      <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto p-3 bg-green-50/30 rounded-xl border border-green-100 min-h-[200px]">
                        {paginatedAvatars.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelectedAvatar(a.id)}
                            className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all bg-white shadow-sm ${
                              selectedAvatar === a.id
                                ? "border-green-600 ring-8 ring-green-500/10"
                                : "border-transparent hover:border-green-200"
                            }`}
                            title={a.name || a.id}
                          >
                            <img
                              src={a.image_url || a.id}
                              alt={a.name || a.id}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.includes('ui-avatars.com')) {
                                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name || 'A')}&background=random&size=200`;
                                }
                              }}
                            />
                            {selectedAvatar === a.id && (
                              <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center">
                                <div className="bg-green-600 text-white rounded-full p-2 shadow-xl scale-110">
                                  <Check size={24} />
                                </div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 px-2">
                          <button
                            onClick={() => setAvatarPage(p => Math.max(0, p - 1))}
                            disabled={avatarPage === 0}
                            className="p-2 text-green-700 hover:bg-green-100 rounded-lg disabled:opacity-30 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                          </button>
                          <span className="text-xs font-medium text-green-800">
                            Страница {avatarPage + 1} из {totalPages}
                          </span>
                          <button
                            onClick={() => setAvatarPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={avatarPage === totalPages - 1}
                            className="p-2 text-green-700 hover:bg-green-100 rounded-lg disabled:opacity-30 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </button>
                        </div>
                      )}

                      <p className="text-sm font-semibold text-green-700 text-center mt-2">
                        Выбран: {avatars.find(a => a.id === selectedAvatar)?.name || "Amy"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-xl border border-dashed border-green-200 text-green-600">
                      <Loader2 className="animate-spin mb-2" size={32} />
                      <p className="text-sm">Загрузка аватаров...</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-2">Голос (Русский)</label>
                  <div className="flex gap-2">
                    {voices.length > 0 ? (
                      <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="flex-1 p-3 bg-white border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      >
                        {voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name || v.id} ({v.gender})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        placeholder="ID голоса (напр. ru-RU-DmitryNeural)"
                        className="flex-1 p-3 bg-white border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      />
                    )}
                    <button
                      onClick={handleVoicePreview}
                      disabled={previewLoading}
                      className="p-3 bg-green-100 text-green-700 hover:bg-green-200 rounded-xl transition-colors disabled:opacity-50"
                      title="Прослушать пример"
                    >
                      {previewLoading ? (
                        <Loader2 className="animate-spin" size={24} />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleGenerateVideo}
                  disabled={loadingVideo || !script || !settings.didApiKey}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 text-lg shadow-sm mt-4"
                >
                  {loadingVideo ? <Loader2 className="animate-spin" size={24} /> : <Video size={24} />}
                  {loadingVideo ? videoStatus || "Создание видео..." : "Создать аватар"}
                </button>
                {!script && (
                  <p className="text-xs text-center text-green-600/70 mt-2">
                    Сначала сгенерируйте сценарий
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result Panel */}
      <div className="flex-1 p-6 bg-green-50 overflow-y-auto">
        {!script && !loadingScript ? (
          <div className="h-full flex items-center justify-center text-green-600/50">
            <p className="text-lg">Заполните параметры и нажмите "Сгенерировать сценарий"</p>
          </div>
        ) : loadingScript ? (
          <div className="h-full flex flex-col items-center justify-center text-green-600/50 space-y-4">
            <Loader2 className="animate-spin" size={48} />
            <p className="text-lg">Пишем сценарий для видео...</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto pb-12 space-y-6">
            
            {/* Video Player Section */}
            {videoUrl && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 flex flex-col items-center">
                <h3 className="text-xl font-bold text-green-900 mb-4">Готовое видео</h3>
                <video
                  src={videoUrl}
                  controls
                  className="w-full max-w-md rounded-xl mb-6 shadow-md"
                />
                <a
                  href={videoUrl}
                  download="avatar-video.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium"
                >
                  <Download size={20} />
                  Скачать .mp4
                </a>
              </div>
            )}

            {/* Script Section */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-green-100">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-green-50">
                <h3 className="text-xl font-bold text-green-900">Сценарий</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 hover:bg-green-200 rounded-lg transition-colors font-medium text-sm"
                  >
                    <Edit2 size={16} />
                    {isEditing ? "Сохранить" : "Редактировать"}
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 hover:bg-green-200 rounded-lg transition-colors font-medium text-sm"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full h-64 p-4 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all resize-y font-sans leading-relaxed text-green-900"
                />
              ) : (
                <div className="prose prose-green max-w-none prose-p:leading-relaxed prose-headings:text-green-900">
                  <Markdown>{script}</Markdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
