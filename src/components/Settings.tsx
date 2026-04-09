import React, { useState } from "react";
import { useAppStore } from "../store";
import { Save, Check, Loader2, AlertCircle, Settings as SettingsIcon, Briefcase } from "lucide-react";
import axios from "axios";
import { ProjectSettingsForm } from "./ProjectSettingsForm";

export function Settings() {
  const { settings, setSettings } = useAppStore();
  
  const [didKey, setDidKey] = useState(settings.didApiKey || "");
  const [ttsProvider, setTtsProvider] = useState(settings.ttsProvider || "gemini");
  const [ttsKey, setTtsKey] = useState(settings.ttsApiKey || "");
  
  const [saved, setSaved] = useState(false);
  const [testingDid, setTestingDid] = useState(false);
  const [didStatus, setDidStatus] = useState<"idle" | "success" | "error">("idle");
  
  const handleSave = () => {
    setSettings({
      didApiKey: didKey,
      ttsProvider,
      ttsApiKey: ttsKey,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testDidConnection = async () => {
    const trimmed = didKey.trim().replace(/[^\x00-\x7F]/g, "");
    if (!trimmed) return;
    
    let authHeader = "";
    if (trimmed.toLowerCase().startsWith('basic ')) {
      authHeader = 'Basic ' + trimmed.substring(6).trim();
    } else if (trimmed.includes(':')) {
      authHeader = `Basic ${btoa(trimmed)}`;
    } else {
      try {
        const decoded = atob(trimmed);
        if (decoded.includes(':')) {
          authHeader = `Basic ${trimmed}`;
        } else {
          authHeader = `Basic ${btoa(trimmed + ':')}`;
        }
      } catch (e) {
        authHeader = `Basic ${btoa(trimmed + ':')}`;
      }
    }

    setTestingDid(true);
    setDidStatus("idle");
    try {
      await axios.get("/api/did/presenters", {
        headers: { "Authorization": authHeader },
      });
      setDidStatus("success");
    } catch (error) {
      console.error("D-id connection test failed:", error);
      setDidStatus("error");
    } finally {
      setTestingDid(false);
    }
  };

  return (
    <div className="flex-1 p-8 bg-green-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-green-900 flex items-center gap-3">
          <SettingsIcon size={32} /> Настройки
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Project Info Section */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-green-100 space-y-6">
            <h3 className="text-xl font-bold text-green-900 border-b border-green-50 pb-2 flex items-center gap-2">
              <Briefcase size={20} className="text-green-600" /> Информация о проекте
            </h3>
            <ProjectSettingsForm showTitle={false} />
          </div>

          {/* Technical Settings Section */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-green-100 space-y-8">
            <h3 className="text-xl font-bold text-green-900 border-b border-green-50 pb-2">Технические настройки</h3>
            
            {/* D-id Settings */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-green-800">Интеграция D-id</h4>
              
              <div>
                <label className="block text-sm font-medium text-green-800 mb-2">
                  API Ключ D-id <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-3">
                  <input
                    type="password"
                    value={didKey}
                    onChange={(e) => setDidKey(e.target.value)}
                    placeholder="Введите ваш API ключ D-id"
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  />
                  <button
                    onClick={testDidConnection}
                    disabled={!didKey || testingDid}
                    className="w-full px-6 py-3 bg-green-100 hover:bg-green-200 text-green-800 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testingDid ? <Loader2 className="animate-spin" size={18} /> : null}
                    Тест подключения
                  </button>
                </div>
                
                {didStatus === "success" && (
                  <p className="text-green-600 text-sm mt-2 flex items-center gap-1">
                    <Check size={16} /> Подключение успешно!
                  </p>
                )}
                {didStatus === "error" && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle size={16} /> Ошибка подключения. Проверьте ключ.
                  </p>
                )}
              </div>
            </div>

            {/* TTS Settings */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-green-800">TTS Сервис</h4>
              
              <div>
                <label className="block text-sm font-medium text-green-800 mb-2">Провайдер</label>
                <select
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value)}
                  className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                >
                  <option value="gemini">Gemini 2.5 Flash TTS (Встроенный)</option>
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="google">Google Cloud TTS</option>
                  <option value="yandex">Yandex SpeechKit</option>
                </select>
              </div>

              {ttsProvider !== "gemini" && (
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-2">
                    API Ключ {ttsProvider}
                  </label>
                  <input
                    type="password"
                    value={ttsKey}
                    onChange={(e) => setTtsKey(e.target.value)}
                    placeholder={`Введите API ключ для ${ttsProvider}`}
                    className="w-full p-3 bg-green-50 border border-green-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                  />
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-green-50">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium text-lg shadow-sm"
              >
                {saved ? <Check size={24} /> : <Save size={24} />}
                {saved ? "Сохранено" : "Сохранить ключи"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
