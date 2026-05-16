import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  // Use API_KEY (selected via dialog) if available, otherwise GEMINI_API_KEY
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is not configured. Please check your Settings > Secrets or connect your Gemini key in the lab.");
  }
  return new GoogleGenAI({ apiKey });
};

export const enhancePrompt = async (prompt: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `You are an expert AI art prompt engineer. Rewrite the following user prompt for an image generation AI (like Midjourney or DALL-E) to make it more descriptive, cinematic, and professional. Focus on lighting, texture, composition, and mood. Keep it under 100 words.
      
      User Prompt: "${prompt}"
      
      Enhanced Prompt:`
    });
    return response.text.trim().replace(/^"|"$/g, '');
  } catch (error) {
    console.error("Prompt Enhancement Error:", error);
    throw error;
  }
};

export const generateImage = async (prompt: string, style?: string, aspectRatio: string = "1:1") => {
  const fullPrompt = style ? `${prompt}. Style: ${style}` : prompt;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: fullPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from Gemini");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

export const generateVideo = async (prompt: string, aspectRatio: string = "16:9") => {
  const hfApiKey = process.env.VITE_HUGGINGFACE_API_KEY || (import.meta as any).env?.VITE_HUGGINGFACE_API_KEY;
  
  // If HF key is provided, we can optionally use HF. 
  // For now, let's try Gemini first, and fallback to HF if permission denied, 
  // OR if the user explicitly wants to use HF (but here we'll do it as a fallback/alternative).
  
  try {
    const ai = getAI();
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        aspectRatio: aspectRatio as any
      }
    });

    return { type: 'gemini', operation };
  } catch (error: any) {
    console.error("Gemini Video Generation Error:", error);
    
    const errorMessage = error.message?.toLowerCase() || "";
    const errorStatus = error.status || error.code || error.error?.code || error.error?.status;
    const errorBody = typeof error === 'object' ? (JSON.stringify(error) + String(error)).toLowerCase() : String(error).toLowerCase();
    
    const isPermissionError = 
      errorMessage.includes("permission") || 
      errorMessage.includes("403") ||
      errorBody.includes("permission") ||
      errorBody.includes("403") ||
      errorStatus === 403 || 
      errorStatus === "PERMISSION_DENIED";

    console.log("Detected error details:", { 
      message: errorMessage, 
      status: errorStatus, 
      isPermissionError, 
      hasHfKey: !!hfApiKey 
    });

    if (isPermissionError && hfApiKey) {
      console.log("Gemini video access denied or restricted. Attempting Hugging Face fallback...");
      return await generateVideoHF(prompt);
    }

    if (isPermissionError) {
      throw new Error("VIDEO_PERMISSION_DENIED");
    }
    throw error;
  }
};

const generateVideoHF = async (prompt: string) => {
  const hfApiKey = process.env.VITE_HUGGINGFACE_API_KEY || (import.meta as any).env?.VITE_HUGGINGFACE_API_KEY;
  if (!hfApiKey) throw new Error("Hugging Face API Key not found for fallback");

  try {
    // Using a reliable text-to-video model on HF
    const response = await fetch(
      "https://api-inference.huggingface.co/models/ali-vilab/modelscope-damo-text-to-video-synthesis",
      {
        headers: { Authorization: `Bearer ${hfApiKey}` },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Hugging Face generation failed");
    }

    const blob = await response.blob();
    const videoUrl = URL.createObjectURL(blob);
    return { type: 'huggingface', url: videoUrl };
  } catch (error: any) {
    console.error("Hugging Face Video Generation Error:", error);
    throw error;
  }
};

export const pollVideoOperation = async (opWrapper: any) => {
  if (opWrapper.type === 'huggingface') {
    return { 
      done: true, 
      response: { videos: [{ uri: opWrapper.url }] } 
    };
  }
  
  const ai = getAI();
  const operation = await ai.operations.getVideosOperation({ 
    operation: opWrapper.operation 
  });
  
  return operation;
};

export const fetchVideoWithKey = async (url: string) => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey || '',
    },
  });
  if (!response.ok) throw new Error("Failed to fetch video data");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const editImage = async (base64Image: string, prompt: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: "image/png" } },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from Gemini during edit");
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};
