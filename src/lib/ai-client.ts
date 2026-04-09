import { GoogleGenAI } from "@google/genai";

class AIClient {
  private static instance: AIClient;
  private ai: GoogleGenAI;

  private constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  public static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance = new AIClient();
    }
    return AIClient.instance;
  }

  public getAI(): GoogleGenAI {
    return this.ai;
  }

  public async generateContent(params: {
    model: string;
    contents: string;
    config?: {
      systemInstruction?: string;
      temperature?: number;
      responseMimeType?: string;
      tools?: Array<{ [key: string]: any }>;
    };
  }) {
    try {
      const response = await this.ai.models.generateContent({
        model: params.model,
        contents: params.contents,
        config: params.config || {}
      });

      return response;
    } catch (error) {
      console.error("AI API Error:", error);
      throw error;
    }
  }

  public parseJSONResponse(text: string): any {
    let jsonText = text || "{}";
    
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n/, "").replace(/\n```$/, "");
    }
    
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error("Failed to parse JSON response:", jsonText, error);
      throw new Error("Invalid JSON response from AI");
    }
  }
}

export const aiClient = AIClient.getInstance();
