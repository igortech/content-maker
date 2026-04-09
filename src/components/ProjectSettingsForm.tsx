import React from "react";
import { useAppStore } from "../store";
import { User, Target, MessageSquare, Info, Briefcase } from "lucide-react";

interface ProjectSettingsFormProps {
  onComplete?: () => void;
  showTitle?: boolean;
}

export function ProjectSettingsForm({ onComplete, showTitle = true }: ProjectSettingsFormProps) {
  const { 
    niche, setNiche, 
    expertName, setExpertName, 
    targetAudience, setTargetAudience, 
    toneOfVoice, setToneOfVoice,
    clarification, setClarification,
    setSetupComplete
  } = useAppStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupComplete(true);
    if (onComplete) onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {showTitle && (
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-green-900">Настройка проекта</h2>
          <p className="text-green-700/70">Заполните информацию один раз, и мы будем использовать ее во всех инструментах</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
            <Briefcase size={16} /> Ниша или тема проекта
          </label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Например: Онлайн-школа нутрициологии"
            required
            className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
            <User size={16} /> Имя эксперта / Название бренда
          </label>
          <input
            type="text"
            value={expertName}
            onChange={(e) => setExpertName(e.target.value)}
            placeholder="Например: Анна Иванова"
            className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
            <Target size={16} /> Целевая аудитория
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Например: Мамы в декрете, которые хотят похудеть"
            className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
            <MessageSquare size={16} /> Тональность (Tone of Voice)
          </label>
          <input
            type="text"
            value={toneOfVoice}
            onChange={(e) => setToneOfVoice(e.target.value)}
            placeholder="Например: Дружелюбный, экспертный, вдохновляющий"
            className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
            <Info size={16} /> Дополнительный контекст
          </label>
          <textarea
            value={clarification}
            onChange={(e) => setClarification(e.target.value)}
            placeholder="Особенности проекта, ссылки на соцсети, основные продукты..."
            rows={3}
            className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-all shadow-md active:scale-[0.98]"
      >
        Сохранить и продолжить
      </button>
    </form>
  );
}
