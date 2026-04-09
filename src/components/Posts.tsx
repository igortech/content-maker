import React, { useState, useMemo } from "react";
import { useAppStore } from "../store";
import { determinePostVariables, generatePostText, generateImagePrompt, generateImage } from "../lib/gemini";
import { Copy, Download, Loader2, Check, RefreshCw, Image as ImageIcon, X, Send, Layout, FileText, Plus, Trash2 } from "lucide-react";
import Markdown from "react-markdown";

export function Posts() {
  const { 
    contentPlan, 
    toneOfVoice, 
    niche, 
    expertName, 
    targetAudience, 
    clarification: globalClarification, 
    trendsData,
    posts,
    addPost,
    setPosts,
    removePost
  } = useAppStore();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(posts.length > 0 ? posts[0].id : null);
  const [loading, setLoading] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [clarification, setClarification] = useState("");
  const [tone, setTone] = useState("Базовый");
  const [copied, setCopied] = useState(false);
  
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({
    topic: "",
    details: "",
    style: "Базовый",
    date: new Date().toISOString().split('T')[0],
    channel: "Telegram"
  });

  const [variables, setVariables] = useState<any[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<any>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);

  const selectedPost = useMemo(() => posts.find(p => p.id === selectedPostId), [posts, selectedPostId]);

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [posts]);

  const handleGenerateSingle = async (topic: any) => {
    setCurrentTopic(topic);
    setLoading(true);
    try {
      const vars = await determinePostVariables(
        topic.title, 
        clarification, 
        [topic.channel || "Telegram"], 
        tone, 
        niche, 
        expertName, 
        targetAudience, 
        trendsData
      );
      
      if (vars && vars.length > 0) {
        setVariables(vars);
        setShowVariablesModal(true);
      } else {
        await executeGeneration(topic, {});
      }
    } catch (error) {
      console.error("Failed to determine variables:", error);
      alert("Ошибка при анализе темы");
    } finally {
      setLoading(false);
    }
  };

  const executeGeneration = async (topic: any, vals: Record<string, string>, overrideStyle?: string) => {
    setLoading(true);
    setShowVariablesModal(false);
    setShowManualModal(false);
    try {
      const channel = topic.channel || manualData.channel || "Telegram";
      const finalStyle = overrideStyle || (tone === "Базовый" ? toneOfVoice : tone === "Авто" ? "автоматически подбери лучший стиль под тему" : tone);
      
      const text = await generatePostText(
        topic.title || topic.topic, 
        topic.details || clarification, 
        channel, 
        finalStyle, 
        vals, 
        niche, 
        expertName, 
        targetAudience, 
        trendsData
      );

      const newPost = {
        id: Date.now().toString(),
        title: topic.title || topic.topic,
        content: text,
        channel,
        date: topic.date || new Date().toISOString(),
        status: 'draft' as const
      };

      addPost(newPost);
      setSelectedPostId(newPost.id);

      // Async image generation
      generateImageForPost(newPost.id, text, channel);

    } catch (error) {
      console.error("Failed to generate post:", error);
      alert("Ошибка при генерации поста");
    } finally {
      setLoading(false);
    }
  };

  const generateImageForPost = async (postId: string, text: string, channel: string) => {
    setGeneratingImageId(postId);
    try {
      const prompt = await generateImagePrompt(text, channel);
      const aspectRatio = channel === "Telegram" ? "1:1" : channel === "ВКонтакте" ? "16:9" : "4:3";
      const img = await generateImage(prompt, aspectRatio);
      
      if (img) {
        setPosts(
          posts.map(p => p.id === postId ? { ...p, imageUrl: img } : p)
        );
      } else {
        alert("Не удалось получить изображение от нейросети. Попробуйте еще раз.");
      }
    } catch (err) {
      console.error("Failed to generate image:", err);
      alert("Ошибка при генерации изображения. Возможно, запрос слишком сложный или сработали фильтры безопасности.");
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleGenerateAll = async () => {
    if (!contentPlan || contentPlan.length === 0) {
      alert("Сначала создайте контент-план");
      return;
    }

    setGeneratingAll(true);
    try {
      // Sort content plan by date chronologically
      const sortedPlan = [...contentPlan].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      const finalStyle = tone === "Базовый" ? toneOfVoice : tone === "Авто" ? "автоматически подбери лучший стиль под тему" : tone;

      for (const day of sortedPlan) {
        for (const topic of day.topics) {
          // Check if already generated (simple title check)
          if (posts.some(p => p.title === topic.title)) continue;

          const text = await generatePostText(
            topic.title,
            clarification,
            topic.channel || "Telegram",
            finalStyle,
            {},
            niche,
            expertName,
            targetAudience,
            trendsData
          );

          const newPost = {
            id: Math.random().toString(36).substr(2, 9),
            title: topic.title,
            content: text,
            channel: topic.channel || "Telegram",
            date: day.date,
            status: 'draft' as const
          };

          addPost(newPost);
          if (!selectedPostId) setSelectedPostId(newPost.id);
          
          // Generate image in background
          generateImageForPost(newPost.id, text, topic.channel || "Telegram");
        }
      }
    } catch (error) {
      console.error("Batch generation failed:", error);
    } finally {
      setGeneratingAll(false);
    }
  };

  const copyToClipboard = () => {
    if (selectedPost) {
      navigator.clipboard.writeText(selectedPost.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadTxt = () => {
    if (!selectedPost) return;
    const element = document.createElement("a");
    const file = new Blob([selectedPost.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${selectedPost.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const hasGeneratedFromPlan = useMemo(() => {
    if (!contentPlan || contentPlan.length === 0) return false;
    return contentPlan.some(day => day.topics.some((t: any) => posts.some(p => p.title === t.title)));
  }, [contentPlan, posts]);

  return (
    <div className="flex w-full h-full bg-green-50 overflow-hidden">
      {/* Left Sidebar: List of Posts */}
      <div className="w-80 bg-white border-r border-green-100 flex flex-col shadow-sm">
        <div className="p-4 border-b border-green-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-green-900">Посты</h2>
            <Layout size={20} className="text-green-600" />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAll}
              disabled={generatingAll || loading || contentPlan.length === 0}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm"
            >
              {generatingAll ? <Loader2 className="animate-spin" size={16} /> : hasGeneratedFromPlan ? <RefreshCw size={16} /> : <Plus size={16} />}
              {generatingAll ? "Генерация..." : hasGeneratedFromPlan ? "Пересоздать" : "По плану"}
            </button>
            <button
              onClick={() => setShowManualModal(true)}
              className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all shadow-sm"
              title="Добавить вручную"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Стиль текста</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-2 text-sm bg-green-50 border border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="Базовый">Базовый (из настроек)</option>
                <option value="Авто">Авто (под контент)</option>
                <option value="Дружелюбный">Дружелюбный</option>
                <option value="Экспертный">Экспертный</option>
                <option value="Провокационный">Провокационный</option>
                <option value="Юмористический">Юмористический</option>
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedPosts.length === 0 ? (
            <div className="p-8 text-center text-green-400">
              <FileText size={40} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm italic">Список постов пуст</p>
            </div>
          ) : (
            sortedPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className={`w-full text-left p-3 rounded-xl transition-all group ${
                  selectedPostId === post.id
                    ? "bg-green-100 text-green-900 shadow-sm"
                    : "hover:bg-green-50 text-green-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    {post.channel}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] opacity-40">
                      {new Date(post.date).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPostId(post.id);
                        setShowDeleteModal(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded-md transition-all"
                      title="Удалить"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium line-clamp-2 leading-snug">
                  {post.title}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Post Editor/Viewer */}
      <div className="flex-1 overflow-y-auto">
        {selectedPost ? (
          <div className="max-w-4xl mx-auto p-8">
            <div className="bg-white rounded-3xl shadow-xl border border-green-100 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-green-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h1 className="text-2xl font-bold text-green-900">{selectedPost.title}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      {selectedPost.channel}
                    </span>
                    <span className="text-xs text-green-500">
                      {new Date(selectedPost.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all"
                    title="Копировать"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                  <button
                    onClick={downloadTxt}
                    className="p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all"
                    title="Скачать"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 space-y-8">
                {!selectedPost.imageUrl ? (
                  <div className="rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 p-12 flex flex-col items-center justify-center gap-4 group hover:border-green-400 transition-colors">
                    <div className="p-4 bg-white rounded-full text-green-300 group-hover:text-green-500 transition-colors shadow-sm">
                      <ImageIcon size={48} />
                    </div>
                    <div className="text-center">
                      <p className="text-green-800 font-medium">Изображение не сгенерировано</p>
                      <p className="text-sm text-green-600/60">Нажмите кнопку ниже, чтобы создать иллюстрацию</p>
                    </div>
                    <button
                      onClick={() => generateImageForPost(selectedPost.id, selectedPost.content, selectedPost.channel)}
                      disabled={generatingImageId === selectedPost.id}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all shadow-md disabled:opacity-50"
                    >
                      {generatingImageId === selectedPost.id ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                      {generatingImageId === selectedPost.id ? "Генерируем..." : "Сгенерировать фото"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden border border-green-100 shadow-inner group relative">
                    <img 
                      src={selectedPost.imageUrl} 
                      alt="Post illustration" 
                      className="w-full h-auto object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => generateImageForPost(selectedPost.id, selectedPost.content, selectedPost.channel)}
                        disabled={generatingImageId === selectedPost.id}
                        className="p-3 bg-white/90 rounded-full text-green-900 shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
                      >
                        {generatingImageId === selectedPost.id ? <Loader2 className="animate-spin" size={24} /> : <RefreshCw size={24} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="prose prose-green max-w-none prose-p:leading-relaxed prose-headings:text-green-900 prose-strong:text-green-800">
                  <Markdown>{selectedPost.content}</Markdown>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-green-300">
            <Layout size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-medium">Выберите пост или сгенерируйте новый</p>
          </div>
        )}
      </div>

      {/* Manual Post Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-green-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-green-900">Новый пост вручную</h3>
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
                <label className="text-xs font-bold text-green-800 uppercase">Тема поста</label>
                <input
                  type="text"
                  value={manualData.topic}
                  onChange={(e) => setManualData({ ...manualData, topic: e.target.value })}
                  placeholder="О чем будет пост?"
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
                    <option value="Дружелюбный">Дружелюбный</option>
                    <option value="Экспертный">Экспертный</option>
                    <option value="Провокационный">Провокационный</option>
                    <option value="Юмористический">Юмористический</option>
                    <option value="Сторителлинг">Сторителлинг</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-green-800 uppercase">Дата</label>
                  <input
                    type="date"
                    value={manualData.date}
                    onChange={(e) => setManualData({ ...manualData, date: e.target.value })}
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-green-800 uppercase">Канал</label>
                <select
                  value={manualData.channel}
                  onChange={(e) => setManualData({ ...manualData, channel: e.target.value })}
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="ВКонтакте">ВКонтакте</option>
                  <option value="Instagram">Instagram</option>
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
                onClick={() => executeGeneration(manualData, {}, manualData.style)}
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

      {/* Variables Modal */}
      {showVariablesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-green-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-green-900">Уточнение данных</h3>
                <p className="text-sm text-green-600">Для более точного результата</p>
              </div>
              <button 
                onClick={() => setShowVariablesModal(false)}
                className="p-2 hover:bg-green-50 rounded-full text-green-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {variables.map((v) => (
                <div key={v.id}>
                  <label className="block text-sm font-semibold text-green-800 mb-1.5">
                    {v.label}
                  </label>
                  <input
                    type="text"
                    value={variableValues[v.id] || ""}
                    onChange={(e) => setVariableValues({ ...variableValues, [v.id]: e.target.value })}
                    placeholder={v.description}
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="p-6 bg-green-50 flex gap-3">
              <button
                onClick={() => setShowVariablesModal(false)}
                className="flex-1 py-3 bg-white border border-green-200 text-green-800 rounded-xl font-medium hover:bg-green-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => executeGeneration(currentTopic, variableValues)}
                disabled={loading}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="animate-spin" size={20} />}
                Создать пост
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
              <h3 className="text-xl font-bold text-green-900 mb-2">Удалить пост?</h3>
              <p className="text-sm text-green-600">Это действие нельзя будет отменить.</p>
            </div>
            <div className="p-6 bg-green-50 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingPostId(null);
                }}
                className="flex-1 py-3 bg-white border border-green-200 text-green-800 rounded-xl font-medium hover:bg-green-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (deletingPostId) {
                    removePost(deletingPostId);
                    if (selectedPostId === deletingPostId) setSelectedPostId(null);
                  }
                  setShowDeleteModal(false);
                  setDeletingPostId(null);
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
