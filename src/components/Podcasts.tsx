import React, { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore, Slide, Podcast } from "../store";
import { generatePodcastScript, generateTTS, generatePodcastSlides, generateImage } from "../lib/gemini";
import { generateVideo, VideoGenerationProgress } from "../lib/video";
import { 
  Copy, Download, Loader2, Check, Play, Pause, RefreshCw, 
  Edit2, Mic, Presentation, ChevronLeft, ChevronRight, 
  ImageIcon, Layout, Plus, X, Settings2, FileText, 
  Video, Headphones, Film, AlertCircle, Trash2
} from "lucide-react";
import Markdown from "react-markdown";

export function Podcasts() {
  const { 
    contentPlan, 
    settings, 
    niche, 
    expertName, 
    targetAudience, 
    trendsData,
    podcasts,
    addPodcast,
    updatePodcast,
    removePodcast,
    toneOfVoice,
    setPodcasts
  } = useAppStore();

  const [sidebarTab, setSidebarTab] = useState<"text" | "video">("text");
  const [selectedPodcastId, setSelectedPodcastId] = useState<string | null>(podcasts.length > 0 ? podcasts[0].id : null);
  
  const [clarification, setClarification] = useState("");
  const [tone, setTone] = useState("Базовый");
  const [duration, setDuration] = useState("3");
  const [format, setFormat] = useState("Монолог");
  
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [regeneratingAudio, setRegeneratingAudio] = useState(false);
  const [batchVideoLoading, setBatchVideoLoading] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [voiceName, setVoiceName] = useState("Puck");
  const [copied, setCopied] = useState(false);
  
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [generatingSlideImage, setGeneratingSlideImage] = useState<number | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoGenerationProgress | null>(null);
  
  const [showManualModal, setShowManualModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPodcastId, setDeletingPodcastId] = useState<string | null>(null);
  const [manualData, setManualData] = useState({
    topic: "",
    details: "",
    style: "Базовый",
    duration: "3",
    format: "Монолог"
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const selectedPodcast = useMemo(() => 
    podcasts.find(p => p.id === selectedPodcastId) || null
  , [podcasts, selectedPodcastId]);

  const hasGeneratedFromPlan = useMemo(() => {
    if (!contentPlan || contentPlan.length === 0) return false;
    return contentPlan.some(day => day.topics.some((t: any) => podcasts.some(p => p.topic === t.title)));
  }, [contentPlan, podcasts]);

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [selectedPodcastId]);

  const safeSlideIndex = useMemo(() => {
    if (!selectedPodcast || !selectedPodcast.slides) return 0;
    return Math.min(activeSlideIndex, Math.max(0, selectedPodcast.slides.length - 1));
  }, [selectedPodcast, activeSlideIndex]);

  const handleGenerateAll = async () => {
    if (!contentPlan || contentPlan.length === 0) {
      alert("Сначала создайте контент-план");
      return;
    }

    setBatchLoading(true);
    try {
      const finalStyle = tone === "Базовый" ? toneOfVoice : tone === "Авто" ? "автоматически подбери лучший стиль под тему" : tone;
      
      for (const day of contentPlan) {
        for (const topic of day.topics) {
          // Skip if already generated
          if (podcasts.some(p => p.topic === topic.title)) continue;

          const text = await generatePodcastScript(
            topic.title, 
            clarification, 
            duration, 
            finalStyle, 
            format, 
            niche, 
            expertName, 
            targetAudience, 
            trendsData
          );

          const slides = await generatePodcastSlides(text);

          const newPodcast = {
            id: crypto.randomUUID(),
            topic: topic.title,
            script: text,
            slides: slides || [],
            date: new Date().toISOString(),
          };

          addPodcast(newPodcast);
          if (!selectedPodcastId) setSelectedPodcastId(newPodcast.id);
        }
      }
    } catch (error) {
      console.error("Failed to generate podcasts:", error);
      alert("Ошибка при генерации подкастов");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleManualGenerate = async () => {
    if (!manualData.topic) return;
    
    setLoading(true);
    setShowManualModal(false);
    try {
      const finalStyle = manualData.style === "Базовый" ? toneOfVoice : manualData.style === "Авто" ? "автоматически подбери лучший стиль под тему" : manualData.style;
      
      const text = await generatePodcastScript(
        manualData.topic, 
        manualData.details, 
        manualData.duration, 
        finalStyle, 
        manualData.format, 
        niche, 
        expertName, 
        targetAudience, 
        trendsData
      );

      const slides = await generatePodcastSlides(text);

      const newPodcast = {
        id: crypto.randomUUID(),
        topic: manualData.topic,
        script: text,
        slides: slides || [],
        date: new Date().toISOString(),
      };

      addPodcast(newPodcast);
      setSelectedPodcastId(newPodcast.id);
    } catch (error) {
      console.error("Failed to generate podcast:", error);
      alert("Ошибка при генерации подкаста");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewVoice = async () => {
    setPreviewingVoice(true);
    try {
      const sampleText = "Привет! Это проверка голоса для вашего видео-подкаста. Как я вам нравлюсь?";
      const url = await generateTTS(sampleText, voiceName);
      if (url && previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.play();
      }
    } catch (error) {
      console.error("Failed to preview voice:", error);
    } finally {
      setPreviewingVoice(false);
    }
  };

  const handleProcessAudioAll = async () => {
    const pending = podcasts.filter(p => !p.audioUrl);
    if (pending.length === 0) {
      alert("Все подкасты уже озвучены");
      return;
    }

    setProcessingAudio(true);
    try {
      for (const podcast of pending) {
        const url = await generateTTS(podcast.script, voiceName);
        if (url) {
          updatePodcast(podcast.id, { audioUrl: url });
        }
      }
    } catch (error) {
      console.error("Failed to process audio:", error);
      alert("Ошибка при озвучке");
    } finally {
      setProcessingAudio(false);
    }
  };

  const handleGenerateVideo = async (podcast: Podcast) => {
    if (!podcast.audioUrl || !podcast.slides || podcast.slides.length === 0) {
      alert("Сначала нужно создать озвучку и слайды");
      return;
    }

    updatePodcast(podcast.id, { videoStatus: "queued", videoError: undefined });
    
    let currentSlides = [...podcast.slides];
    const missingImages = currentSlides.some(s => !s.imageUrl);
    
    if (missingImages) {
      setVideoProgress({ step: "Генерация недостающих фонов..." });
      try {
        for (let i = 0; i < currentSlides.length; i++) {
          if (!currentSlides[i].imageUrl) {
            setVideoProgress({ step: `Генерация фона ${i + 1}/${currentSlides.length}...` });
            const imageUrl = await generateImage(currentSlides[i].imagePrompt, "16:9");
            if (imageUrl) {
              currentSlides[i] = { ...currentSlides[i], imageUrl };
              updatePodcast(podcast.id, { slides: currentSlides });
            }
          }
        }
      } catch (error: any) {
        console.error("Failed to generate slide images:", error);
        updatePodcast(podcast.id, { videoStatus: "failed", videoError: "Ошибка при генерации фонов: " + error.message });
        setVideoProgress(null);
        return;
      }
    }

    try {
      const videoUrl = await generateVideo(
        podcast.id,
        podcast.audioUrl,
        currentSlides,
        (progress) => {
          setVideoProgress(progress);
          updatePodcast(podcast.id, { videoStatus: "processing" });
        }
      );
      updatePodcast(podcast.id, { videoUrl, videoStatus: "done" });
    } catch (error: any) {
      console.error("Failed to generate video:", error);
      updatePodcast(podcast.id, { videoStatus: "failed", videoError: error.message });
    } finally {
      setVideoProgress(null);
    }
  };

  const handleGenerateSlideImage = async (index: number) => {
    if (!selectedPodcast || !selectedPodcast.slides) return;
    const slide = selectedPodcast.slides[index];
    
    setGeneratingSlideImage(index);
    try {
      const imageUrl = await generateImage(slide.imagePrompt, "16:9");
      if (imageUrl) {
        const updatedSlides = [...selectedPodcast.slides];
        updatedSlides[index] = { ...slide, imageUrl };
        updatePodcast(selectedPodcast.id, { slides: updatedSlides });
      }
    } catch (error) {
      console.error("Failed to generate slide image:", error);
    } finally {
      setGeneratingSlideImage(null);
    }
  };

  const copyToClipboard = () => {
    if (!selectedPodcast) return;
    navigator.clipboard.writeText(selectedPodcast.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex w-full h-full bg-green-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-green-100 flex flex-col shadow-sm">
        <div className="p-4 border-b border-green-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-green-900">Видео-подкасты</h2>
            <Video size={20} className="text-green-600" />
          </div>

          {/* Sidebar Tabs */}
          <div className="flex p-1 bg-green-50 rounded-xl mb-4">
            <button
              onClick={() => setSidebarTab("text")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                sidebarTab === "text" ? "bg-white text-green-700 shadow-sm" : "text-green-600 hover:text-green-700"
              }`}
            >
              <FileText size={14} />
              Текст
            </button>
            <button
              onClick={() => setSidebarTab("video")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                sidebarTab === "video" ? "bg-white text-green-700 shadow-sm" : "text-green-600 hover:text-green-700"
              }`}
            >
              <Video size={14} />
              Видео
            </button>
          </div>

          {sidebarTab === "text" ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateAll}
                  disabled={batchLoading || contentPlan.length === 0}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm"
                >
                  {batchLoading ? <Loader2 className="animate-spin" size={16} /> : hasGeneratedFromPlan ? <RefreshCw size={16} /> : <Plus size={16} />}
                  {batchLoading ? "Генерация..." : hasGeneratedFromPlan ? "Пересоздать" : "Создать по плану"}
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all shadow-sm"
                  title="Добавить вручную"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Стиль</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full p-2 text-sm bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="Базовый">Базовый (из настроек)</option>
                  <option value="Авто">Авто (под контент)</option>
                  <option value="Разговорный">Разговорный</option>
                  <option value="Экспертный">Экспертный</option>
                  <option value="Сторителлинг">Сторителлинг</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Уточнение</label>
                <textarea
                  value={clarification}
                  onChange={(e) => setClarification(e.target.value)}
                  placeholder="Добавьте детали..."
                  className="w-full p-2 text-sm bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Длительность</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-2 text-sm bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="1">1 мин</option>
                    <option value="3">3 мин</option>
                    <option value="5">5 мин</option>
                    <option value="10">10 мин</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Формат</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full p-2 text-sm bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="Монолог">Монолог</option>
                    <option value="Интервью">Интервью</option>
                    <option value="Лекция">Лекция</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleProcessAudioAll}
                  disabled={processingAudio || podcasts.length === 0}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-[10px] uppercase tracking-wider"
                >
                  {processingAudio ? <Loader2 className="animate-spin" size={14} /> : <Headphones size={14} />}
                  {processingAudio ? "Озвучиваем..." : "Озвучить всё"}
                </button>
                <button
                  onClick={async () => {
                    const pending = podcasts.filter(p => p.audioUrl && p.slides && !p.videoUrl);
                    if (pending.length === 0) {
                      alert("Нет подкастов, готовых к генерации видео (нужно аудио и слайды)");
                      return;
                    }
                    setBatchVideoLoading(true);
                    try {
                      for (const p of pending) {
                        await handleGenerateVideo(p);
                      }
                    } finally {
                      setBatchVideoLoading(false);
                    }
                  }}
                  disabled={podcasts.length === 0 || batchVideoLoading}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-[10px] uppercase tracking-wider"
                >
                  {batchVideoLoading ? <Loader2 className="animate-spin" size={14} /> : <Film size={14} />}
                  {batchVideoLoading ? "Создаем видео..." : "Создать видео для всех"}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Голос</label>
                <div className="flex gap-2">
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="flex-1 p-2 text-sm bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="Puck">Puck (Мужской)</option>
                    <option value="Charon">Charon (Мужской)</option>
                    <option value="Kore">Kore (Женский)</option>
                    <option value="Fenrir">Fenrir (Мужской)</option>
                    <option value="Zephyr">Zephyr (Женский)</option>
                  </select>
                  <button
                    onClick={handlePreviewVoice}
                    disabled={previewingVoice}
                    className="p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-all"
                    title="Прослушать"
                  >
                    {previewingVoice ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                  </button>
                </div>
                <audio ref={previewAudioRef} className="hidden" />
              </div>
            </div>
          )}
        </div>

        {/* Podcast List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {podcasts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-green-300 p-4 text-center">
              <FileText size={40} className="mb-2 opacity-20" />
              <p className="text-xs">Список пуст. Сгенерируйте подкасты по плану.</p>
            </div>
          ) : (
            podcasts.map((podcast) => (
              <div key={podcast.id} className="group relative">
                <button
                  onClick={() => setSelectedPodcastId(podcast.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all border ${
                    selectedPodcastId === podcast.id
                      ? "bg-green-50 border-green-200 shadow-sm"
                      : "bg-white border-transparent hover:bg-green-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-green-500 uppercase">
                      {new Date(podcast.date).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      {podcast.audioUrl && <Headphones size={10} className="text-green-600" />}
                      {podcast.slides && podcast.slides.length > 0 && <Presentation size={10} className="text-green-600" />}
                      {podcast.videoUrl && <Film size={10} className="text-green-600" />}
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-green-900 line-clamp-2 leading-tight">
                    {podcast.topic}
                  </h4>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingPodcastId(podcast.id);
                    setShowDeleteModal(true);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all shadow-sm z-10"
                  title="Удалить"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedPodcast ? (
          <div className="h-full flex flex-col items-center justify-center text-green-600/30">
            <Video size={64} className="mb-4 opacity-10" />
            <p className="text-xl font-medium">Выберите подкаст из списка</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-green-100 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-green-900">{selectedPodcast.topic}</h1>
                <p className="text-sm text-green-600">Создан {new Date(selectedPodcast.date).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-3 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all"
                  title="Редактировать"
                >
                  {isEditing ? <Check size={20} /> : <Edit2 size={20} />}
                </button>
                <button
                  onClick={copyToClipboard}
                  className="p-3 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all"
                  title="Копировать"
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>

            {sidebarTab === "text" ? (
              <>
                {/* Script */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-green-100">
              <h3 className="text-lg font-bold text-green-900 mb-4 border-b border-green-50 pb-2">Сценарий</h3>
              {isEditing ? (
                <textarea
                  value={selectedPodcast.script}
                  onChange={(e) => updatePodcast(selectedPodcast.id, { script: e.target.value })}
                  className="w-full h-96 p-4 bg-green-50 border border-green-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none resize-none font-sans leading-relaxed text-green-900"
                />
              ) : (
                <div className="prose prose-green max-w-none">
                  <Markdown>{selectedPodcast.script}</Markdown>
                </div>
              )}
            </div>
              </>
            ) : (
              <>
                {/* Slideshow */}
                {selectedPodcast.slides && selectedPodcast.slides.length > 0 && (
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-green-100 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-green-900">Слайды для видео</h3>
                      <Presentation className="text-green-600" size={20} />
                    </div>

                    <div className="space-y-6">
                      <div className="relative aspect-video bg-green-900 rounded-2xl overflow-hidden shadow-xl group">
                        {selectedPodcast.slides[safeSlideIndex]?.imageUrl ? (
                          <img 
                            src={selectedPodcast.slides[safeSlideIndex].imageUrl} 
                            alt={selectedPodcast.slides[safeSlideIndex].title}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <Presentation size={120} className="text-white" />
                          </div>
                        )}

                        <div className="absolute bottom-6 right-6 flex gap-2 z-20">
                          <button
                            onClick={() => setActiveSlideIndex(Math.max(0, safeSlideIndex - 1))}
                            disabled={safeSlideIndex === 0}
                            className="p-2 bg-black/40 hover:bg-black/60 rounded-lg text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronLeft size={24} />
                          </button>
                          <div className="px-4 flex items-center bg-black/40 rounded-lg text-white font-mono text-sm">
                            {safeSlideIndex + 1} / {selectedPodcast.slides.length}
                          </div>
                          <button
                            onClick={() => setActiveSlideIndex(Math.min(selectedPodcast.slides.length - 1, safeSlideIndex + 1))}
                            disabled={safeSlideIndex === selectedPodcast.slides.length - 1}
                            className="p-2 bg-black/40 hover:bg-black/60 rounded-lg text-white disabled:opacity-20 transition-colors"
                          >
                            <ChevronRight size={24} />
                          </button>
                        </div>

                        {!selectedPodcast.slides[safeSlideIndex]?.imageUrl && (
                          <div className="absolute inset-0 flex items-center justify-center z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                            <button
                              onClick={() => handleGenerateSlideImage(safeSlideIndex)}
                              disabled={generatingSlideImage === safeSlideIndex}
                              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium shadow-xl"
                            >
                              {generatingSlideImage === safeSlideIndex ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                              {generatingSlideImage === safeSlideIndex ? "Создаем фон..." : "Сгенерировать фон"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-6 gap-2">
                        {selectedPodcast.slides.map((slide, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveSlideIndex(i)}
                            className={`aspect-video rounded-lg border-2 transition-all overflow-hidden relative ${
                              safeSlideIndex === i ? "border-green-500 shadow-md scale-105" : "border-transparent hover:border-green-200"
                            }`}
                          >
                            {slide.imageUrl ? (
                              <img src={slide.imageUrl} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-green-100 flex items-center justify-center text-green-400">
                                <span className="text-xs font-bold">{i + 1}</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Video Section */}
            {(selectedPodcast.videoUrl || selectedPodcast.videoStatus) && (
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-green-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-green-900">Видео-подкаст</h3>
                  <Film className="text-green-600" size={20} />
                </div>

                {selectedPodcast.videoStatus === "done" && selectedPodcast.videoUrl ? (
                  <div className="space-y-4">
                    <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-xl">
                      <video 
                        src={selectedPodcast.videoUrl} 
                        controls 
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                      <div className="flex items-center gap-2 text-green-700 text-sm">
                        <Check size={16} />
                        <span>Видео готово! Ссылка действует 24 часа.</span>
                      </div>
                      <a 
                        href={selectedPodcast.videoUrl} 
                        download 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <Download size={16} />
                        Скачать MP4
                      </a>
                    </div>
                  </div>
                ) : selectedPodcast.videoStatus === "failed" ? (
                  <div className="p-8 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center text-center">
                    <AlertCircle size={48} className="text-red-500 mb-4" />
                    <h4 className="text-lg font-bold text-red-900 mb-2">Ошибка генерации</h4>
                    <pre className="text-xs text-red-600 mb-6 max-w-full overflow-x-auto text-left bg-red-100/50 p-4 rounded-lg whitespace-pre-wrap">
                      {selectedPodcast.videoError || "Неизвестная ошибка при рендеринге"}
                    </pre>
                    <button
                      onClick={() => handleGenerateVideo(selectedPodcast)}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                    >
                      <RefreshCw size={18} />
                      Попробовать снова
                    </button>
                  </div>
                ) : (
                  <div className="p-12 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center text-center">
                    <Loader2 size={48} className="text-green-600 animate-spin mb-6" />
                    <h4 className="text-xl font-bold text-green-900 mb-2">
                      {videoProgress?.step || "Подготовка к рендерингу..."}
                    </h4>
                    <p className="text-sm text-green-600 mb-6 max-w-md">
                      Мы создаем ваше видео. Это может занять от 1 до 3 минут. Пожалуйста, не закрывайте вкладку.
                    </p>
                    {videoProgress?.percent !== undefined && (
                      <div className="w-full max-w-xs h-2 bg-green-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-600 transition-all duration-500" 
                          style={{ width: `${videoProgress.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Audio Player */}
            {selectedPodcast.audioUrl && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-green-100 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-green-900">Аудио-версия</h3>
                    <Headphones className="text-green-600" size={20} />
                  </div>
                  <button
                    onClick={async () => {
                      setRegeneratingAudio(true);
                      try {
                        const url = await generateTTS(selectedPodcast.script, voiceName);
                        if (url) {
                          updatePodcast(selectedPodcast.id, { audioUrl: url });
                        }
                      } catch (error) {
                        console.error("Failed to re-generate audio:", error);
                        alert("Ошибка при переозвучке");
                      } finally {
                        setRegeneratingAudio(false);
                      }
                    }}
                    disabled={regeneratingAudio}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {regeneratingAudio ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    {regeneratingAudio ? "Озвучиваем..." : "Переозвучить"}
                  </button>
                </div>
                <audio
                  ref={audioRef}
                  src={selectedPodcast.audioUrl}
                  controls
                  className="w-full mb-4"
                />
                
                {!selectedPodcast.videoUrl && !selectedPodcast.videoStatus && (
                  <button
                    onClick={() => handleGenerateVideo(selectedPodcast)}
                    disabled={!selectedPodcast.audioUrl || !selectedPodcast.slides}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Film size={24} />
                    Сгенерировать видео-подкаст (Shotstack)
                  </button>
                )}
              </div>
            )}

                {!selectedPodcast.audioUrl && !selectedPodcast.videoUrl && !selectedPodcast.videoStatus && (
                  <div className="bg-white rounded-3xl p-12 shadow-sm border border-green-100 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-green-50 text-green-300 rounded-full flex items-center justify-center mb-6">
                      <Film size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-green-900 mb-2">Медиафайлы не созданы</h3>
                    <p className="text-green-600 max-w-md">
                      Перейдите на вкладку "Текст", проверьте сценарий и сгенерируйте фоновые изображения для слайдов. Затем нажмите "Озвучить всё" и "Создать видео" в панели слева.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Manual Podcast Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-green-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-green-900">Новый подкаст вручную</h3>
                <p className="text-sm text-green-600">Укажите тему и параметры</p>
              </div>
              <button 
                onClick={() => setShowManualModal(false)}
                className="p-2 hover:bg-green-50 rounded-full text-green-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="space-y-1">
                <label className="text-xs font-bold text-green-800 uppercase">Тема подкаста</label>
                <input
                  type="text"
                  value={manualData.topic}
                  onChange={(e) => setManualData({ ...manualData, topic: e.target.value })}
                  placeholder="О чем будет подкаст?"
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-green-800 uppercase">Детали / Контекст</label>
                <textarea
                  value={manualData.details}
                  onChange={(e) => setManualData({ ...manualData, details: e.target.value })}
                  placeholder="Дополнительные подробности..."
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-green-800 uppercase">Стиль</label>
                  <select
                    value={manualData.style}
                    onChange={(e) => setManualData({ ...manualData, style: e.target.value })}
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="Базовый">Базовый</option>
                    <option value="Авто">Авто</option>
                    <option value="Разговорный">Разговорный</option>
                    <option value="Экспертный">Экспертный</option>
                    <option value="Сторителлинг">Сторителлинг</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-green-800 uppercase">Длительность (мин)</label>
                  <select
                    value={manualData.duration}
                    onChange={(e) => setManualData({ ...manualData, duration: e.target.value })}
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="1">1 мин</option>
                    <option value="3">3 мин</option>
                    <option value="5">5 мин</option>
                    <option value="10">10 мин</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-green-800 uppercase">Формат</label>
                <select
                  value={manualData.format}
                  onChange={(e) => setManualData({ ...manualData, format: e.target.value })}
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="Монолог">Монолог</option>
                  <option value="Интервью">Интервью (с AI)</option>
                  <option value="Лекция">Лекция</option>
                </select>
              </div>
            </div>

            <div className="p-6 bg-green-50 flex gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="flex-1 py-3 bg-white border border-green-200 text-green-800 rounded-xl font-medium hover:bg-green-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleManualGenerate}
                disabled={loading || !manualData.topic}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="animate-spin" size={20} />}
                Сгенерировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-green-900 mb-2">Удалить подкаст?</h3>
              <p className="text-sm text-green-600">Это действие нельзя будет отменить.</p>
            </div>
            <div className="p-6 bg-green-50 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingPodcastId(null);
                }}
                className="flex-1 py-3 bg-white border border-green-200 text-green-800 rounded-xl font-medium hover:bg-green-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (deletingPodcastId) {
                    removePodcast(deletingPodcastId);
                    if (selectedPodcastId === deletingPodcastId) {
                      setSelectedPodcastId(null);
                      setActiveSlideIndex(0);
                    }
                  }
                  setShowDeleteModal(false);
                  setDeletingPodcastId(null);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
