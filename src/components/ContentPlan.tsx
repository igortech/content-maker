import React, { useState } from "react";
import { useAppStore } from "../store";
import { generateContentPlan } from "../lib/gemini";
import { Copy, Loader2, Check, Edit3, Briefcase, User, Target, MessageSquare } from "lucide-react";
import { Modal } from "./Modal";
import { ProjectSettingsForm } from "./ProjectSettingsForm";

export function ContentPlan() {
  const { 
    contentPlan, setContentPlan, 
    niche, expertName, targetAudience, toneOfVoice, clarification, trendsData
  } = useAppStore();
  
  const [channels, setChannels] = useState<string[]>(["Telegram"]);
  const [period, setPeriod] = useState("На неделю");
  const [loading, setLoading] = useState(false);
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleGenerate = async () => {
    if (channels.length === 0) return;
    
    setLoading(true);
    try {
      const result = await generateContentPlan(niche, expertName, targetAudience, toneOfVoice, clarification, channels, period, trendsData);
      if (result && result.plan) {
        setContentPlan(result.plan);
      } else {
        throw new Error("Неверный формат ответа от AI");
      }
    } catch (error: any) {
      console.error("Failed to generate plan:", error);
      alert(`Ошибка при генерации контент-плана: ${error.message || "Неизвестная ошибка"}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTopic(text);
    setTimeout(() => setCopiedTopic(null), 2000);
  };

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Parameters Panel */}
      <div className="w-1/3 min-w-[320px] max-w-md p-6 bg-white border-r border-green-100 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-green-900">Контент-план</h2>
        </div>
        
        <div className="space-y-6">
          {/* Project Info Summary */}
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100 relative group">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="absolute top-3 right-3 p-2 bg-white rounded-lg shadow-sm text-green-600 hover:text-green-800 transition-colors opacity-0 group-hover:opacity-100"
              title="Редактировать информацию о проекте"
            >
              <Edit3 size={16} />
            </button>
            <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">Информация о проекте</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Briefcase size={14} className="text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm font-bold text-green-900 line-clamp-1">{niche}</p>
              </div>
              {expertName && (
                <div className="flex items-start gap-2">
                  <User size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-800 line-clamp-1">{expertName}</p>
                </div>
              )}
              {targetAudience && (
                <div className="flex items-start gap-2">
                  <Target size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-800 line-clamp-1">{targetAudience}</p>
                </div>
              )}
              {toneOfVoice && (
                <div className="flex items-start gap-2">
                  <MessageSquare size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-800 line-clamp-1">{toneOfVoice}</p>
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="w-full mt-4 py-2 bg-white text-green-700 text-xs font-bold rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
            >
              Изменить данные
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">Каналы</label>
            <div className="flex flex-wrap gap-2">
              {["Telegram", "ВКонтакте", "Max"].map((c) => (
                <button
                  key={c}
                  onClick={() => toggleChannel(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    channels.includes(c)
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">Период</label>
            <div className="grid grid-cols-2 gap-2">
              {["На сегодня", "На 3 дня", "На 5 дней", "На неделю"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    period === p
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || channels.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
            {loading ? "Генерация..." : "Сгенерировать план"}
          </button>
        </div>
      </div>

      {/* Result Panel */}
      <div className="flex-1 p-6 bg-green-50 overflow-y-auto">
        {contentPlan.length === 0 ? (
          <div className="h-full flex items-center justify-center text-green-600/50">
            <p className="text-lg">Нажмите "Сгенерировать план" для получения идей</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {contentPlan.map((day, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-green-100">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-green-50">
                  <h3 className="text-lg font-bold text-green-900">{day.date}</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {day.channel}
                  </span>
                </div>
                <div className="space-y-4">
                  {day.topics?.map((topic: any, tIdx: number) => (
                    <div key={tIdx} className="flex items-start justify-between group p-3 hover:bg-green-50 rounded-xl transition-colors">
                      <div>
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded mb-2">
                          {topic.time}
                        </span>
                        <p className="text-green-900 font-medium">{topic.title}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(topic.title)}
                        className="p-2 text-green-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Копировать тему"
                      >
                        {copiedTopic === topic.title ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Редактировать информацию о проекте"
      >
        <ProjectSettingsForm onComplete={() => setIsEditModalOpen(false)} showTitle={false} />
      </Modal>
    </div>
  );
}
