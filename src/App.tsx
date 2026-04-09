import React from "react";
import { LayoutDashboard, TrendingUp, Mail, Mic, Video, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useAppStore } from "./store";
import { ContentPlan } from "./components/ContentPlan";
import { TrendRadar } from "./components/TrendRadar";
import { Posts } from "./components/Posts";
import { Podcasts } from "./components/Podcasts";
import { VideoAvatar } from "./components/VideoAvatar";
import { Settings } from "./components/Settings";
import { ProjectSettingsForm } from "./components/ProjectSettingsForm";

export default function App() {
  const { activeTab, setActiveTab, isSetupComplete } = useAppStore();

  const tabs = [
    { id: "trend-radar", label: "Тренд-радар", icon: TrendingUp },
    { id: "plan", label: "Контент-план", icon: LayoutDashboard },
    { id: "posts", label: "Посты", icon: Mail },
    { id: "podcasts", label: "Видео-подкасты", icon: Mic },
    { id: "avatar", label: "Видео-аватар", icon: Video },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "trend-radar":
        return <TrendRadar />;
      case "plan":
        return <ContentPlan />;
      case "posts":
        return <Posts />;
      case "podcasts":
        return <Podcasts />;
      case "avatar":
        return <VideoAvatar />;
      case "settings":
        return <Settings />;
      default:
        return <ContentPlan />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-green-50 text-green-950 font-sans overflow-hidden relative">
      {/* Onboarding Overlay */}
      {!isSetupComplete && (
        <div className="absolute inset-0 z-50 bg-green-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-2xl">
                <Sparkles className="text-green-600" size={32} />
              </div>
              <h1 className="text-3xl font-black text-green-900">Добро пожаловать!</h1>
            </div>
            <ProjectSettingsForm />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-green-800 text-green-50 flex flex-col shadow-xl z-10">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight">AI Контент Мейкер</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === tab.id
                  ? "bg-green-700 text-white font-medium shadow-sm"
                  : "hover:bg-green-700/50 text-green-100"
              }`}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4">
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
              activeTab === "settings"
                ? "bg-green-700 text-white font-medium shadow-sm"
                : "hover:bg-green-700/50 text-green-100"
            }`}
          >
            <SettingsIcon size={20} />
            <span>Настройки</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}
