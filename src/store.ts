import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";

// Custom storage for IndexedDB
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface Settings {
  didApiKey: string;
  ttsProvider: string;
  ttsApiKey: string;
}

export interface Slide {
  title: string;
  content: string[];
  imagePrompt: string;
  imageUrl?: string;
}

export interface Podcast {
  id: string;
  topic: string;
  script: string;
  date: string;
  audioUrl?: string;
  slides?: Slide[];
  videoUrl?: string;
  videoStatus?: "queued" | "processing" | "done" | "failed";
  videoError?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  channel: string;
  date: string;
  imageUrl?: string | null;
  status: 'draft' | 'published';
}

interface AppState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: Settings;
  setSettings: (settings: Partial<Settings>) => void;
  niche: string;
  setNiche: (niche: string) => void;
  expertName: string;
  setExpertName: (name: string) => void;
  targetAudience: string;
  setTargetAudience: (audience: string) => void;
  toneOfVoice: string;
  setToneOfVoice: (tone: string) => void;
  clarification: string;
  setClarification: (clarification: string) => void;
  isSetupComplete: boolean;
  setSetupComplete: (complete: boolean) => void;
  contentPlan: any[];
  setContentPlan: (plan: any[]) => void;
  trendsData: any | null;
  setTrendsData: (trends: any | null) => void;
  podcasts: Podcast[];
  setPodcasts: (podcasts: Podcast[]) => void;
  addPodcast: (podcast: Podcast) => void;
  updatePodcast: (id: string, updates: Partial<Podcast>) => void;
  removePodcast: (id: string) => void;
  posts: Post[];
  setPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  removePost: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: "trend-radar",
      setActiveTab: (tab) => set({ activeTab: tab }),
      settings: {
        didApiKey: "",
        ttsProvider: "gemini",
        ttsApiKey: "",
      },
      setSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      niche: "Онлайн-школа нутрициологии",
      setNiche: (niche) => set({ niche }),
      expertName: "",
      setExpertName: (expertName) => set({ expertName }),
      targetAudience: "",
      setTargetAudience: (targetAudience) => set({ targetAudience }),
      toneOfVoice: "Профессиональный, но доступный",
      setToneOfVoice: (toneOfVoice) => set({ toneOfVoice }),
      clarification: "",
      setClarification: (clarification) => set({ clarification }),
      isSetupComplete: false,
      setSetupComplete: (isSetupComplete) => set({ isSetupComplete }),
      contentPlan: [],
      setContentPlan: (plan) => set({ contentPlan: plan }),
      trendsData: null,
      setTrendsData: (trendsData) => set({ trendsData }),
      podcasts: [],
      setPodcasts: (podcasts) => set({ podcasts }),
      addPodcast: (podcast) => set((state) => ({ podcasts: [podcast, ...state.podcasts] })),
      updatePodcast: (id, updates) => set((state) => ({
        podcasts: state.podcasts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      })),
      removePodcast: (id) => set((state) => ({
        podcasts: state.podcasts.filter((p) => p.id !== id),
      })),
      posts: [],
      setPosts: (posts) => set({ posts }),
      addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
      removePost: (id) => set((state) => ({
        posts: state.posts.filter((p) => p.id !== id),
      })),
    }),
    {
      name: "ai-content-maker-storage",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ 
        settings: state.settings, 
        activeTab: state.activeTab, 
        podcasts: state.podcasts,
        posts: state.posts,
        niche: state.niche,
        expertName: state.expertName,
        targetAudience: state.targetAudience,
        toneOfVoice: state.toneOfVoice,
        clarification: state.clarification,
        isSetupComplete: state.isSetupComplete,
        contentPlan: state.contentPlan,
        trendsData: state.trendsData
      }),
    }
  )
);
