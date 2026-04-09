import axios from "axios";
import { Slide } from "../store";
import { safeFetch, handleError, Logger } from "./utils";

export interface VideoGenerationProgress {
  step: string;
  percent?: number;
}

export async function uploadToStorage(data: string, mimeType: string, filename: string): Promise<string> {
  const response = await axios.post("/api/storage/upload", {
    data,
    mimeType,
    filename
  }, {
    timeout: 30000, // 30 seconds timeout
    validateStatus: (status) => status >= 200 && status < 300
  });
  return response.data.url;
}

export async function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = url;
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    audio.onerror = (e) => {
      reject(new Error("Failed to load audio metadata"));
    };
  });
}

export async function generateVideo(
  podcastId: string,
  audioUrl: string,
  slides: Slide[],
  onProgress: (progress: VideoGenerationProgress) => void
): Promise<string> {
  try {
    onProgress({ step: "Анализируем аудио..." });
    let duration = 12 * slides.length;
    try {
      duration = await getAudioDuration(audioUrl);
    } catch (e) {
      console.warn("Failed to get audio duration, using default", e);
    }
    
    onProgress({ step: "Подготавливаем аудио..." });
    // Force re-upload of audio to ensure it's served by our server with correct headers
    const audioResponse = await safeFetch(audioUrl);
    const audioBlob = await audioResponse.blob();
    const audioReader = new FileReader();
    const audioBase64 = await new Promise<string>((resolve) => {
      audioReader.onloadend = () => resolve((audioReader.result as string).split(",")[1]);
      audioReader.readAsDataURL(audioBlob);
    });
    const audioExtension = audioBlob.type.split('/')[1] || 'wav';
    const audioSignedUrl = await uploadToStorage(audioBase64, audioBlob.type, `podcasts/${podcastId}/audio.${audioExtension}`);

    onProgress({ step: "Загружаем изображения..." });
    const SLIDE_DURATION = duration > 0 ? duration / slides.length : 12; // Dynamic or 12 seconds per slide
    const slideUrls: string[] = [];
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (!slide.imageUrl) continue;
      
      onProgress({ step: `Загружаем слайд ${i + 1}/${slides.length}...` });
      const response = await safeFetch(slide.imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      const extension = blob.type.split('/')[1] || 'jpg';
      const signedUrl = await uploadToStorage(base64, blob.type, `podcasts/${podcastId}/slide_${i.toString().padStart(3, "0")}.${extension}`);
      slideUrls.push(signedUrl);
    }

    onProgress({ step: "Отправляем на рендер..." });
    const clips = slideUrls.map((url, index) => ({
      asset: {
        type: "image",
        src: url
      },
      start: index * SLIDE_DURATION,
      length: SLIDE_DURATION,
      transition: {
        in: "fade",
        out: "fade"
      }
    }));

    const payload = {
      timeline: {
        soundtrack: {
          src: audioSignedUrl,
          effect: "fadeOut"
        },
        tracks: [
          {
            clips
          }
        ]
      },
      output: {
        format: "mp4",
        resolution: "hd",
        aspectRatio: "16:9"
      }
    };

    const renderResponse = await axios.post("/api/shotstack/render", payload);
    const renderId = renderResponse.data.response.id;

    onProgress({ step: "Рендеринг видео... (это может занять 1-3 минуты)" });
    
    // Polling
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const statusResponse = await axios.get(`/api/shotstack/status/${renderId}`);
      const { status, url, error } = statusResponse.data.response;
      
      if (status === "done") {
        return url;
      } else if (status === "failed") {
        throw new Error(`Render failed: ${error}`);
      }
      
      onProgress({ step: `Рендеринг... (${status})`, percent: Math.min(99, attempts * 2) });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    throw new Error("Render timed out");
  } catch (error: any) {
    console.error("Video generation error:", error);
    if (error.response?.data) {
      throw new Error(`Shotstack render error: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}
