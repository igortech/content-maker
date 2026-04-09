import { GoogleGenAI, Type } from "@google/genai";
import { 
  SYSTEM_PROMPTS, 
  MODEL_NAME, 
  GEMMA_MODEL_NAME,
  IMAGE_MODEL_NAME,
  compilePrompt, 
  calculateWordCount, 
  calculateShortWordCount, 
  validateGeneratedText 
} from "../../prompts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeTrends(rssData: string, niche: string, expertName: string, targetAudience: string, toneOfVoice: string, clarification: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.TREND_RADAR;
  
  const prompt = compilePrompt(config.userTemplate, {
    rssData: rssData || "Данные из RSS-лент отсутствуют или неполные. Пожалуйста, используй свои инструменты поиска Google Search для получения актуальной информации.",
    niche,
    expertName,
    targetAudience,
    toneOfVoice,
    clarification
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      },
    });

    let jsonText = response.text || "{}";
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error in analyzeTrends:", error);
    throw error;
  }
}

export async function generatePodcastSlides(script: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.PODCAST_SLIDES;
  
  const prompt = compilePrompt(config.userTemplate, { script });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
        responseMimeType: "application/json",
      }
    });

    let jsonText = response.text || "{}";
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    
    return JSON.parse(jsonText).slides || [];
  } catch (error) {
    console.error("Error in generatePodcastSlides:", error);
    throw error;
  }
}

export async function generateContentPlan(niche: string, expertName: string, targetAudience: string, toneOfVoice: string, clarification: string, channels: string[], period: string, trendsData: any = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.CONTENT_PLAN;
  
  const match = period.match(/(\d+)/);
  let periodDays = match ? parseInt(match[1]) : 7;
  if (period.toLowerCase().includes("сегодня")) periodDays = 1;
  if (period.toLowerCase().includes("неделю")) periodDays = 7;
  if (period.toLowerCase().includes("месяц")) periodDays = 30;
  
  const prompt = compilePrompt(config.userTemplate, {
    niche,
    expertName,
    targetAudience,
    toneOfVoice,
    clarification,
    trendsData: trendsData ? JSON.stringify(trendsData) : "Нет актуальных данных о трендах. Используй общие знания о нише.",
    channels: channels.join(", "),
    period,
    periodDays,
    currentDate: new Date().toISOString().split("T")[0],
    excludedDates: "Нет",
    maxPostsPerDay: 2
  });

  try {
    console.log("Generating content plan for:", niche);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    let jsonText = response.text;
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    
    const errors = validateGeneratedText(jsonText, config.validationRules);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
    }
    
    const data = JSON.parse(jsonText);
    console.log("Content plan generated successfully");
    return data;
  } catch (error) {
    console.error("Error in generateContentPlan:", error);
    throw error;
  }
}

export async function determinePostVariables(topic: string, clarification: string, channels: string[], tone: string, niche: string, expertName: string, targetAudience: string, trendsData: any = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.POST_VARIABLES;
  
  const prompt = compilePrompt(config.userTemplate, {
    topic,
    clarification,
    trendsData: trendsData ? JSON.stringify(trendsData) : "Нет актуальных данных о трендах.",
    channels: channels.join(", "),
    tone,
    niche,
    expertName,
    targetAudience,
    targetAction: "Вовлечение или переход по ссылке"
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
        responseMimeType: "application/json",
      },
    });

    let jsonText = response.text || "{}";
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    
    const errors = validateGeneratedText(jsonText, config.validationRules);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
    }
    
    return JSON.parse(jsonText).variables || [];
  } catch (error) {
    console.error("Error in determinePostVariables:", error);
    throw error;
  }
}

export async function generatePostText(topic: string, clarification: string, channel: string, tone: string, variables: any, niche: string, expertName: string, targetAudience: string, trendsData: any = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.POST_GENERATE;
  
  const prompt = compilePrompt(config.userTemplate, {
    topic,
    clarification,
    trendsData: trendsData ? JSON.stringify(trendsData) : "Нет актуальных данных о трендах.",
    channel,
    tone,
    niche,
    expertName,
    targetAudience,
    cta: "Стандартный призыв к действию",
    variables: JSON.stringify(variables)
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
      }
    });

    const text = response.text || "";
    const errors = validateGeneratedText(text, config.validationRules);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
    }
    
    return text;
  } catch (error) {
    console.error("Error in generatePostText:", error);
    throw error;
  }
}

export async function generateImagePrompt(text: string, channel: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.IMAGE_PROMPT_GENERATE;
  
  const prompt = compilePrompt(config.userTemplate, {
    text,
    channel,
    imageAI: "Midjourney",
    brandStyle: "современный, фотореализм",
    brandColors: "корпоративные цвета",
    brandTone: "профессиональный",
    restrictions: "без текста на изображении"
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
      }
    });

    const result = response.text?.trim() || "";
    const errors = validateGeneratedText(result, config.validationRules);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
    }
    return result;
  } catch (error) {
    console.error("Error in generateImagePrompt:", error);
    throw error;
  }
}

export async function generateImage(prompt: string, aspectRatio: string = "1:1") {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error in generateImage:", error);
    throw error;
  }
}

export async function generatePodcastScript(topic: string, clarification: string, duration: string, style: string, format: string, niche: string, expertName: string, targetAudience: string, trendsData: any = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.PODCAST_SCRIPT;
  
  const durationNum = parseInt(duration) || 5;
  const wordCount = calculateWordCount(durationNum);
  
  const prompt = compilePrompt(config.userTemplate, {
    topic,
    clarification,
    trendsData: trendsData ? JSON.stringify(trendsData) : "Нет актуальных данных о трендах.",
    duration,
    wordCount,
    style,
    format,
    niche,
    expertName,
    targetAudience,
    voiceType: "нейтральный",
    speakingRate: 135
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
      }
    });

    const text = response.text || "";
    const errors = validateGeneratedText(text, config.validationRules);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
    }
    return text;
  } catch (error) {
    console.error("Error in generatePodcastScript:", error);
    throw error;
  }
}

export async function generateVideoAvatarScript(topic: string, clarification: string, duration: string, podcastText: string, niche: string, expertName: string, targetAudience: string, trendsData: any = null) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const config = SYSTEM_PROMPTS.VIDEO_AVATAR_SCRIPT;
  
  const durationNum = parseInt(duration) || 30;
  const wordCount = calculateShortWordCount(durationNum);
  const durationMinus5 = Math.max(0, durationNum - 5);
  
  const prompt = compilePrompt(config.userTemplate, {
    topic,
    clarification,
    trendsData: trendsData ? JSON.stringify(trendsData) : "Нет актуальных данных о трендах.",
    duration,
    wordCount,
    niche,
    expertName,
    targetAudience,
    style: "энергичный",
    podcastText: podcastText || "",
    durationMinus5
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: config.system,
        temperature: config.temperature,
      }
    });

    const text = response.text || "";
    const errors = validateGeneratedText(text, config.validationRules);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
    }
    return text;
  } catch (error) {
    console.error("Error in generateVideoAvatarScript:", error);
    throw error;
  }
}

export async function generateTTS(text: string, voiceName: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO" as any],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Gemini TTS returns raw PCM 16-bit, 24000Hz, mono
      // We need to wrap it in a WAV header for browser compatibility
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);

      // RIFF identifier
      view.setUint32(0, 0x52494646, false); // "RIFF"
      // file length
      view.setUint32(4, 36 + len, true);
      // RIFF type
      view.setUint32(8, 0x57415645, false); // "WAVE"
      // format chunk identifier
      view.setUint32(12, 0x666d7420, false); // "fmt "
      // format chunk length
      view.setUint32(16, 16, true);
      // sample format (raw)
      view.setUint16(20, 1, true);
      // channel count
      view.setUint16(22, 1, true);
      // sample rate
      view.setUint32(24, 24000, true);
      // byte rate (sample rate * block align)
      view.setUint32(28, 24000 * 2, true);
      // block align (channel count * bytes per sample)
      view.setUint16(32, 2, true);
      // bits per sample
      view.setUint16(34, 16, true);
      // data chunk identifier
      view.setUint32(36, 0x64617461, false); // "data"
      // data chunk length
      view.setUint32(40, len, true);

      const wavBlob = new Blob([wavHeader, bytes], { type: "audio/wav" });
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(wavBlob);
      });
    }
    return null;
  } catch (error) {
    console.error("Error in generateTTS:", error);
    throw error;
  }
}
