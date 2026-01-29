import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { 
  Upload, 
  Image as ImageIcon, 
  Type, 
  MonitorPlay, 
  Download, 
  RefreshCw, 
  Sparkles, 
  Maximize2, 
  Smartphone,
  Square,
  LayoutTemplate,
  Wand2,
  AlertCircle,
  Key,
  ExternalLink,
  Zap,
  Shirt,
  Clapperboard,
  Loader2,
  History,
  Clock,
  Settings,
  X,
  LayoutGrid
} from 'lucide-react';

// --- Types & Constants ---
type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | 'all';

interface HistoryItem {
  id: string;
  imageUrl: string;
  title: string;
  clothing: string;
  background: string;
  timestamp: number;
}

const RATIO_OPTIONS: { value: AspectRatio; label: string; icon: any }[] = [
  { value: '16:9', label: '横屏封面 (16:9)', icon: MonitorPlay },
  { value: '9:16', label: '竖屏/Shorts (9:16)', icon: Smartphone },
  { value: '3:4', label: '小红书 (3:4)', icon: LayoutTemplate },
  { value: '4:3', label: '传统 (4:3)', icon: MonitorPlay },
  { value: '1:1', label: '正方形 (1:1)', icon: Square },
  { value: 'all', label: '全尺寸 (All)', icon: LayoutGrid },
];

const IMAGE_MODEL_NAME = 'gemini-3-pro-image-preview';
const ANALYSIS_MODEL_NAME = 'gemini-3-flash-preview';

// --- Main Component ---
function App() {
  // --- State ---
  const [apiSource, setApiSource] = useState<'google' | 't8'>('google');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [t8ApiKey, setT8ApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [tempT8Key, setTempT8Key] = useState('');

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  
  // Style Configuration State
  const [clothingStyle, setClothingStyle] = useState('');
  const [backgroundScene, setBackgroundScene] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [modification, setModification] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedBatchImages, setGeneratedBatchImages] = useState<{ratio: string, url: string}[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<string>('');
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- API Key Selection Logic ---
  useEffect(() => {
    const checkKey = async () => {
      // Check stored preference
      const storedSource = localStorage.getItem('api_source') as 'google' | 't8';
      if (storedSource) setApiSource(storedSource);

      const storedT8Key = localStorage.getItem('t8_api_key');
      if (storedT8Key) setT8ApiKey(storedT8Key);

      // 1. Check Local Storage
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        setCustomApiKey(storedKey);
        // If source is google, set hasApiKey true
        if (!storedSource || storedSource === 'google') {
             setHasApiKey(true);
        }
      }

      // Check if T8 is selected and valid
      if (storedSource === 't8' && storedT8Key) {
          setHasApiKey(true);
          return;
      }

      // 2. Check AI Studio Environment (Only for Google)
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        if (has) {
          // If env has key, we can assume it's usable if user didn't explicitly prefer T8
          if (apiSource === 'google') setHasApiKey(true);
          return;
        }
      } 
      
      // 3. Check Env Var
      if (process.env.API_KEY) {
          if (apiSource === 'google') setHasApiKey(true);
      }
    };
    checkKey();
  }, [apiSource]);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleManualKeySubmit = () => {
    if (apiSource === 'google') {
        if (tempKey.trim()) {
          setCustomApiKey(tempKey.trim());
          localStorage.setItem('gemini_api_key', tempKey.trim());
          setHasApiKey(true);
          setShowKeyModal(false);
        }
    } else {
        if (tempT8Key.trim()) {
            setT8ApiKey(tempT8Key.trim());
            localStorage.setItem('t8_api_key', tempT8Key.trim());
            setHasApiKey(true);
            setShowKeyModal(false);
        }
    }
  };

  const handleSourceChange = (source: 'google' | 't8') => {
      setApiSource(source);
      localStorage.setItem('api_source', source);
      // Reset hasApiKey based on new source validity
      if (source === 'google') {
          setHasApiKey(!!customApiKey || !!process.env.API_KEY);
      } else {
          setHasApiKey(!!t8ApiKey);
      }
  };

  const openKeyModal = () => {
    setTempKey(customApiKey || '');
    setTempT8Key(t8ApiKey || '');
    setShowKeyModal(true);
  };

  const getEffectiveApiKey = () => {
    if (apiSource === 't8') return t8ApiKey;
    return customApiKey || process.env.API_KEY;
  };

  // --- Handlers ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const cleanBase64 = (dataUrl: string) => {
    return dataUrl.split(',')[1];
  };
  
  // Restore history item
  const handleRestoreHistory = (item: HistoryItem) => {
    setGeneratedImage(item.imageUrl);
    // Optional: restore title if you want, but user might want to keep current title
    // setTitle(item.title); 
    setClothingStyle(item.clothing);
    setBackgroundScene(item.background);
  };

  // --- AI Analysis Handler ---
  const handleAnalyzeTitle = async () => {
    if (!title.trim()) {
      setError('请先输入标题，AI 才能分析关键词。');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const prompt = `
        As a creative director for YouTube thumbnails, analyze this video title: "${title}".
        
        Your task is to propose a UNIQUE and CREATIVE visual style that makes this video go viral.
        Avoid generic suggestions. Think outside the box.
        
        Output a JSON object with two fields in Simplified Chinese (简体中文):
        1. "clothing": A specific description of what the person should wear. (e.g. "赛博朋克发光夹克", "复古侦探风衣", "专业实验室白大褂").
        2. "background": A specific description of the background scene. (e.g. "充满全息投影的数据中心", "夕阳下的废弃工厂", "极简主义的高级灰摄影棚").
        
        Keep descriptions concise (under 20 words) but visually specific.
        Output MUST be in Simplified Chinese.
        
        Example Output:
        {
          "clothing": "黑色连帽卫衣配极客眼镜",
          "background": "充满代码雨的黑客帝国风格矩阵空间"
        }
      `;

      let rawText = '';

      if (apiSource === 't8') {
        // Use OpenAI SDK for T8
        const openai = new OpenAI({
            apiKey: getEffectiveApiKey(),
            baseURL: "https://ai.t8star.cn/v1",
            dangerouslyAllowBrowser: true
        });

        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gemini-3-flash-preview",
            temperature: 0.8
        });

        rawText = completion.choices[0]?.message?.content || '';

      } else {
        const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey() });
        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL_NAME,
            contents: prompt,
            config: { 
            // responseMimeType: 'application/json', // Removed to avoid potential empty responses
            temperature: 0.8 
            }
        });

        // 尝试获取并解析返回的文本
        if (typeof response.text === 'function') {
            rawText = response.text();
        } else if (response.text) {
            rawText = response.text;
        }
      }
      
      console.log("AI Analysis Result:", rawText);

      let result: any = {};
      try {
        // 尝试直接解析
        result = JSON.parse(rawText || '{}');
      } catch (e) {
        // 如果直接解析失败，尝试从 markdown 代码块中提取 JSON
        const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            result = JSON.parse(jsonMatch[1]);
          } catch (e2) {
            console.error("JSON parsing failed even after extraction", e2);
          }
        }
      }

      if (result.clothing || result.background) {
        if (result.clothing) setClothingStyle(result.clothing);
        if (result.background) setBackgroundScene(result.background);
      } else {
        // 如果没有解析出有效内容，尝试直接使用文本（如果它不是 JSON）
        if (rawText && !rawText.includes('{')) {
             // 兜底：也许模型没有返回 JSON，而是直接返回了建议？
             // 尝试智能提取：
             // 如果文本很短，直接塞给 clothing (临时方案)
             if (rawText.length < 50) {
                setClothingStyle(rawText);
                setBackgroundScene("与主题匹配的风格化背景");
             } else {
                 setError('AI 返回格式异常，请重试。');
             }
        } else {
             setError('AI 未能生成有效的风格建议，请尝试修改标题后重试。');
        }
      }

    } catch (err: any) {
      console.error(err);
      setError('分析失败，请检查网络或 Key 是否正确。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateSingleImage = async (targetRatio: string, currentPrompt: string, aiInstance: any): Promise<string> => {
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount <= maxRetries) {
          try {
              if (apiSource === 't8') {
                  // T8 / OpenAI Compatible Image Generation
                  const openai = aiInstance as OpenAI;
                  
                  // For nano-banana-2-2k, we might need a specific parameter structure
                  // Based on user provided log, it seems to accept standard OpenAI-like body but with specific model
                  // However, T8 might use chat completions for everything or standard image generations.
                  // Let's assume standard image generation first, but if model is chat-based wrapper, we might need to adjust.
                  // The log shows "model": "nano-banana-2", "properties": { "aspect_ratio": "16:9", "image": "...", "hide_file_data", "image_size": "2K" }
                  // This suggests it might be a custom endpoint or a chat completion with JSON payload?
                  // Wait, the log shows "input": "{\"aspect_ratio\":\"16:9\",...}" inside a request.
                  // And the response has "data": [{"url": "..."}]
                  // It looks like a standard image generation endpoint structure but with custom properties.
                  
                  // Let's try standard OpenAI image generation first with standard size/quality mapping
                  // Mapping aspect ratio to resolution is tricky for standard OpenAI API, usually it's '1024x1024' etc.
                  // But T8 might support custom sizes.
                  
                  // If T8 uses the standard /v1/images/generations endpoint:
                  const response = await openai.images.generate({
                      model: "nano-banana-2-2k", 
                      prompt: currentPrompt,
                      // @ts-ignore - Some custom params might be needed or standard size
                      size: "1024x1024", // Default placeholder, T8 might ignore this if using aspect_ratio in prompt or elsewhere
                      response_format: "b64_json", // We prefer base64 to avoid CORS with external URLs
                      n: 1,
                      // Custom properties for T8 if they support extra body params via some hack or if the SDK allows
                  });

                  // NOTE: Standard OpenAI SDK doesn't easily allow custom body params like 'aspect_ratio' at top level.
                  // If T8 requires specific 'aspect_ratio' param outside prompt, we might need to fetch directly.
                  
                  // Let's use fetch for T8 to ensure we can pass the exact payload structure seen in the logs
                  // The log shows:
                  // "properties": { 
                  //    "aspect_ratio": "16:9", 
                  //    "image": "...", 
                  //    "image_size": "2K", 
                  //    "model": "nano-banana-2", 
                  //    "prompt": "..." 
                  // }
                  // This looks like a specific JSON body.
                  
                  // RE-EVALUATING BASED ON LOG:
                  // The log shows a task creation. It might be an async task or a sync task.
                  // "action": "image-sync"
                  
                  // Let's try to construct a fetch request that mimics the structure, but via OpenAI SDK if possible? No, fetch is safer.
                  
                  // Map aspect ratio to specific dimensions for T8/OpenAI
                  // IMPORTANT: The T8/Google wrapper likely validates aspect ratio based on size.
                  // We must use resolutions that STRICTLY match the aspect ratio math.
                  // 16:9 -> 1.777... (e.g. 1280x720)
                  // 9:16 -> 0.5625 (e.g. 720x1280)
                  // 3:4 -> 0.75 (e.g. 768x1024)
                  // 4:3 -> 1.333... (e.g. 1024x768)
                  let sizeParam = "1024x1024";
                  switch(targetRatio) {
                      case '16:9': sizeParam = "1280x720"; break; // 1792x1024 is 1.75 (7:4), causing 400 error
                      case '9:16': sizeParam = "720x1280"; break; // 1024x1792 is 0.57 (4:7)
                      case '3:4': sizeParam = "768x1024"; break;  // Exact 0.75 match
                      case '4:3': sizeParam = "1024x768"; break;  // Exact 1.33 match
                      default: sizeParam = "1024x1024"; break;
                  }

                  // T8 Async Implementation
                  console.log("Starting T8 Async Image Generation...", { targetRatio, model: "nano-banana-2-2k" });
                  
                  // Helper to fetch and convert image URL to Base64 to avoid CORS/Network issues
                  const fetchImageToBase64 = async (url: string): Promise<string> => {
                       try {
                           console.log("Fetching image from URL to convert to Base64:", url);
                           // Use a CORS proxy if needed, but first try direct fetch.
                           // Since 'files.closeai.fans' might be blocked or have strict CORS, we might fail here.
                           // But since we are in a browser environment, we can't easily proxy without a backend.
                           // However, if the user is running this locally, maybe direct fetch works if no CORS?
                           // Wait, the error is ERR_CONNECTION_RESET, which implies network blocking (GFW or similar).
                           // If the URL is blocked, the browser CANNOT fetch it directly.
                           // We need to hope T8 provides base64 directly (response_format: "b64_json").
                           // We DID request response_format: "b64_json".
                           // Let's check why T8 ignores it and returns URL.
                           
                           // If T8 insists on returning URL and that URL is blocked, we are stuck without a backend proxy.
                           // BUT, let's try to see if we can force b64_json or use a public proxy.
                           // For now, let's try to fetch.
                           const response = await fetch(url);
                           const blob = await response.blob();
                           return new Promise((resolve, reject) => {
                               const reader = new FileReader();
                               reader.onloadend = () => resolve(reader.result as string);
                               reader.onerror = reject;
                               reader.readAsDataURL(blob);
                           });
                       } catch (e) {
                           console.error("Failed to fetch image:", e);
                           // Fallback: return original URL and hope user has VPN
                           return url;
                       }
                  };

                  // Helper to process T8 response data (extracted from async or sync)
                  const processT8Data = async (responseData: any) => {
                       // Log full data for debugging
                       console.log("Processing T8 Data:", JSON.stringify(responseData).substring(0, 500));

                       let imageUrl = '';
                       let b64Data = '';

                       // The "responseData" here is the full JSON object returned by the API.
                       
                       // 1. Check for nested T8 Async Task format: root -> data -> data -> array
                       if (responseData.data && !Array.isArray(responseData.data)) {
                            // Check for deep nesting: root.data.data.data
                            if (responseData.data.data && responseData.data.data.data && Array.isArray(responseData.data.data.data)) {
                                const item = responseData.data.data.data[0];
                                if (item) {
                                    if (item.b64_json) b64Data = item.b64_json;
                                    else if (item.url) imageUrl = item.url;
                                }
                            }
                            // Check for double nesting: root.data.data (Array)
                            else if (responseData.data.data && Array.isArray(responseData.data.data)) {
                                const item = responseData.data.data[0];
                                if (item) {
                                    if (item.b64_json) b64Data = item.b64_json;
                                    else if (item.url) imageUrl = item.url;
                                }
                            }
                       }
                       
                       // 2. Check for Standard OpenAI format: root -> data -> array
                       if (!imageUrl && !b64Data && Array.isArray(responseData.data) && responseData.data[0]) {
                           const item = responseData.data[0];
                           if (item.b64_json) b64Data = item.b64_json;
                           else if (item.url) imageUrl = item.url;
                       }

                       // 3. Fallback: flat object
                       if (!imageUrl && !b64Data && responseData.data && responseData.data.url && typeof responseData.data.url === 'string') {
                           imageUrl = responseData.data.url;
                       }

                       if (b64Data) {
                           return b64Data.startsWith('data:image') ? b64Data : `data:image/jpeg;base64,${b64Data}`;
                       }

                       if (imageUrl) {
                           // If we got a URL, try to fetch it to base64 if possible, otherwise return URL
                           // Since user reported connection reset, direct use of URL in <img> tag failed.
                           // We can try to fetch it via a CORS proxy or just return it.
                           // Given this is a frontend-only app, we can't do much about connection reset unless we use a public proxy.
                           // Let's try to use 'wsrv.nl' as a proxy which is often used for image resizing/proxying.
                           // Format: https://wsrv.nl/?url={encoded_url}
                           const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`;
                           return proxyUrl; 
                       }

                       throw new Error(`生成 ${targetRatio} 失败：无法解析 T8 返回的图片数据。结构Keys: ${Object.keys(responseData || {})}, DataKeys: ${Object.keys(responseData.data || {})}`);
                  };

                  // 1. Submit Async Task
                  const t8Response = await fetch("https://ai.t8star.cn/v1/images/generations?async=true", {
                      method: "POST",
                      headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${getEffectiveApiKey()}`
                      },
                      body: JSON.stringify({
                          model: "nano-banana-2-2k",
                          prompt: currentPrompt + ` --ar ${targetRatio}`,
                          n: 1,
                          size: sizeParam, 
                          response_format: "b64_json",
                          aspect_ratio: targetRatio, 
                          image_size: "2K",
                          image: cleanBase64(uploadedImage!), 
                          hide_file_data: true,
                          properties: {
                             aspect_ratio: targetRatio,
                             image_size: "2K",
                             hide_file_data: true
                          }
                      })
                  });

                  if (!t8Response.ok) {
                      const errText = await t8Response.text();
                      console.error("T8 Async Submit Error:", errText);
                      throw new Error(`T8 Submit Error: ${t8Response.status} - ${errText}`);
                  }

                  const submitData = await t8Response.json();
                  const taskId = submitData.task_id || submitData.id; // Check if it's task_id or id

                  if (!taskId) {
                       console.error("No task_id in response:", submitData);
                       // Fallback: maybe it returned result directly?
                       if (submitData.data) return processT8Data(submitData);
                       throw new Error("T8 Async Error: No task_id returned");
                  }

                  console.log("T8 Task ID:", taskId);
                  setProgressStep(`任务已提交 (ID: ${taskId.slice(0, 8)}...)，正在排队生成...`);

                  // 2. Poll for Results
                  const maxAttempts = 60; // 2 minutes timeout (2s interval)
                  let pollAttempt = 0;

                  while (pollAttempt < maxAttempts) {
                      pollAttempt++;
                      await new Promise(r => setTimeout(r, 2000)); // Wait 2s

                      const pollResponse = await fetch(`https://ai.t8star.cn/v1/images/tasks/${taskId}`, {
                          headers: {
                              "Authorization": `Bearer ${getEffectiveApiKey()}`
                          }
                      });

                      if (!pollResponse.ok) {
                          console.warn(`Polling attempt ${pollAttempt} failed:`, pollResponse.status);
                          continue; 
                      }

                      const pollData = await pollResponse.json();
                      console.log(`Polling ${taskId} status:`, pollData.status || 'UNKNOWN');

                      // Check for SUCCESS status or if data is present and valid
                      // Note: pollData.data might be an object { data: [...] }, so .length check fails on it
                      if (pollData.status === 'SUCCESS' || (pollData.data && (Array.isArray(pollData.data) || pollData.data.data))) {
                          return processT8Data(pollData);
                      }
                      
                      if (pollData.status === 'FAILED' || pollData.status === 'FAILURE') {
                           throw new Error(`T8 Task Failed: ${pollData.error || 'Unknown error'}`);
                      }
                      
                      // Update progress if possible
                      if (pollData.status) {
                          setProgressStep(`正在生成中... [${pollData.status}] (${pollAttempt}/${maxAttempts})`);
                      }
                  }
                  
                  throw new Error("T8 Task Timed Out");

              } else {
                // Google GenAI Logic
                const response = await (aiInstance as GoogleGenAI).models.generateContent({
                    model: IMAGE_MODEL_NAME,
                    contents: [
                        {
                            inlineData: {
                                mimeType: 'image/png',
                                data: cleanBase64(uploadedImage!)
                            }
                        },
                        { text: currentPrompt }
                    ],
                    config: {
                        imageConfig: {
                            aspectRatio: targetRatio,
                            imageSize: '2K',
                        }
                    }
                });

                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            return `data:image/png;base64,${part.inlineData.data}`;
                        }
                    }
                }
                throw new Error(`生成 ${targetRatio} 失败：未返回图片数据。`);
              }

          } catch (error: any) {
              // Check for 503 Service Unavailable or 429 Too Many Requests
              const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded') || error.message?.includes('429');
              
              if (isOverloaded && retryCount < maxRetries) {
                  retryCount++;
                  const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
                  console.log(`Model overloaded. Retrying ${targetRatio} in ${Math.round(delay)}ms... (Attempt ${retryCount}/${maxRetries})`);
                  setProgressStep(`服务器繁忙，正在重试 ${targetRatio} (${retryCount}/${maxRetries})...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
              }
              
              throw error; // Rethrow other errors or if max retries reached
          }
      }
      throw new Error(`生成 ${targetRatio} 失败：多次重试均无效。`);
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      setError('请先上传一张人物参考图');
      return;
    }
    if (!title.trim()) {
      setError('请输入封面标题');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setGeneratedBatchImages(null);
    setProgressStep('正在初始化 AI 模型...');

    try {
      let aiInstance: any;
      
      if (apiSource === 't8') {
          // Initialize OpenAI for T8 (used for analyze, but for image we use direct fetch in helper)
          // We pass a dummy or the openai instance just in case
          aiInstance = new OpenAI({
            apiKey: getEffectiveApiKey(),
            baseURL: "https://ai.t8star.cn/v1",
            dangerouslyAllowBrowser: true
          });
      } else {
          aiInstance = new GoogleGenAI({ apiKey: getEffectiveApiKey() });
      }
      
      // Dynamic Prompt Construction
      let clothingInstruction = clothingStyle 
        ? `**CLOTHING CHANGE:** The subject MUST wear: ${clothingStyle}. Do NOT keep original clothes.` 
        : "Keep clothing stylish and modern.";
        
      let backgroundInstruction = backgroundScene 
        ? `**BACKGROUND:** ${backgroundScene}.` 
        : "Background: Abstract high-tech digital studio.";

      let prompt = `Create a high-quality, viral-style YouTube video thumbnail.
      
      **Core Elements:**
      1. **TEXT:** The main headline is:
      """
      ${title}
      """
      **CRITICAL: Render the text EXACTLY as written above. If there are line breaks (multiple lines), you MUST render them on separate lines in the image.**
      The text must be MASSIVE, BOLD, and legible. Use a high-impact sans-serif font with 3D effects or heavy drop shadows (Colors: White, Yellow, or Cyan).
      
      2. **SUBJECT:** Use the person from the provided image. 
         - **CRITICAL:** KEEP FACIAL FEATURES ONLY. 
         - ${clothingInstruction}
         - Re-imagine the pose to be expressive and matching the title energy (e.g., holding a relevant prop or gesturing).
      3. **SCENE:** ${backgroundInstruction}
      
      **Global Aesthetic Filter:**
      - Even if the scene is specific (e.g., a farm or kitchen), apply a **"High-End Tech Influencer"** look.
      - Use cinematic lighting (rim lights, blue/orange contrast).
      - Add subtle digital overlays, neon accents, or bokeh to ensure a premium feel.
      
      **Output Quality:** 4K resolution, photorealistic subject, vector-style graphics for text/background elements.
      `;

      if (modification) {
        prompt += `\n\n**ADDITIONAL INSTRUCTIONS:** ${modification}`;
      }

      setProgressStep('正在根据您的设定构图...');

      if (aspectRatio === 'all') {
        // Batch Generation
        const ratios: AspectRatio[] = ['16:9', '9:16', '3:4', '4:3', '1:1'];
        const results: {ratio: string, url: string}[] = [];

        for (let i = 0; i < ratios.length; i++) {
          const ratio = ratios[i];
          setProgressStep(`正在生成 ${ratio} (${i + 1}/${ratios.length})...`);
          // Add a small delay between requests to avoid rate limits
          if (i > 0) await new Promise(r => setTimeout(r, 1000));
          
          try {
            const url = await generateSingleImage(ratio, prompt, aiInstance);
            results.push({ ratio, url });
          } catch (e) {
            console.error(`Failed to generate ${ratio}`, e);
            // Continue even if one fails
          }
        }

        if (results.length > 0) {
          setGeneratedBatchImages(results);
          // Set the first one as main preview
          setGeneratedImage(results[0].url);
          
          // Add ALL to history
          const newHistoryItems: HistoryItem[] = results.map((result, index) => ({
            id: (Date.now() + index).toString(),
            imageUrl: result.url,
            title: title,
            clothing: clothingStyle || '默认风格',
            background: backgroundScene || '默认背景',
            timestamp: Date.now()
          }));
          
          setHistory(prev => [...newHistoryItems, ...prev]);
        } else {
           throw new Error("所有尺寸生成均失败，请重试。");
        }

      } else {
        // Single Generation
        const finalImageUrl = await generateSingleImage(aspectRatio, prompt, aiInstance);
        
        setGeneratedImage(finalImageUrl);
        
        // Add to history
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          imageUrl: finalImageUrl,
          title: title,
          clothing: clothingStyle || '默认风格',
          background: backgroundScene || '默认背景',
          timestamp: Date.now()
        };
        setHistory(prev => [newHistoryItem, ...prev]);
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('Requested entity was not found')) {
        // Don't auto-reset hasApiKey if using custom key, let user decide
        if (!customApiKey) setHasApiKey(false); 
        setError('项目或 API Key 无效，请重新配置。');
      } else if (err.message && (err.message.includes('503') || err.message.includes('overloaded'))) {
        setError('AI 模型目前负载过高，请稍等片刻后再试。');
      } else {
        setError(err.message || '生成过程中发生未知错误。');
      }
    } finally {
      setIsGenerating(false);
      setProgressStep('');
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `cover-${title.replace(/\s+/g, '-')}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // --- Render Key Modal ---
  const renderKeyModal = () => {
    if (!showKeyModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
          <button 
            onClick={() => setShowKeyModal(false)}
            className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Key className="w-5 h-5 text-violet-400" />
            设置 API Key
          </h3>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            请选择您希望使用的 API 源并配置密钥。
          </p>
          
          <div className="space-y-4">
            {/* Source Selection */}
            <div className="flex bg-black/30 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => handleSourceChange('google')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${apiSource === 'google' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    Google 官方
                </button>
                <button
                  onClick={() => handleSourceChange('t8')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${apiSource === 't8' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    T8 聚合 API
                </button>
            </div>

            {apiSource === 'google' ? (
                <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Google Gemini API Key</label>
                <input 
                    type="password" 
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono text-sm transition-all"
                />
                </div>
            ) : (
                <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">T8 API Key</label>
                <input 
                    type="password" 
                    value={tempT8Key}
                    onChange={(e) => setTempT8Key(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono text-sm transition-all"
                />
                <p className="text-xs text-gray-500 mt-2">
                    需要配合 T8 聚合 API 使用，生图将使用 <code>nano-banana-2</code> 模型。
                </p>
                </div>
            )}
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowKeyModal(false)}
                className="flex-1 py-3 rounded-xl font-medium text-gray-400 hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleManualKeySubmit}
                disabled={apiSource === 'google' ? !tempKey.trim() : !tempT8Key.trim()}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                确认保存
              </button>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            {apiSource === 'google' ? (
                <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1 transition-colors"
                >
                获取 Gemini API Key <ExternalLink size={10} />
                </a>
            ) : (
                <a 
                href="https://ai.t8star.cn" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 inline-flex items-center gap-1 transition-colors"
                >
                前往 T8 获取 Key <ExternalLink size={10} />
                </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Render Landing Page (No Key) ---
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center p-4 relative">
        {renderKeyModal()}
        <div className="max-w-md w-full bg-[#121212] border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Key className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-3">连接 Google Cloud</h1>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            为了使用高质量的 <strong>Gemini 3 Pro</strong> 图像生成模型，请选择一个关联了 Billing 的 Google Cloud 项目。
          </p>
          
          <div className="space-y-3 mb-6">
            <button 
              onClick={handleSelectKey}
              className="w-full py-3.5 bg-white text-black rounded-xl font-bold text-base hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-current" />
              选择项目 (推荐)
            </button>
            <button 
              onClick={openKeyModal}
              className="w-full py-3.5 bg-white/5 text-white border border-white/10 rounded-xl font-bold text-base hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              手动输入 Key
            </button>
          </div>

          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center justify-center gap-1 transition-colors"
          >
            了解关于 Gemini API 计费 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // --- Render Main App ---
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-violet-500/30">
      {renderKeyModal()}
      <div className="max-w-[1600px] mx-auto p-4 lg:p-8">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                AI 爆款封面生成器
              </h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Gemini 3 Pro Powered</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={openKeyModal}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors border border-white/5"
              title="设置 API Key"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="grid lg:grid-cols-12 gap-8 h-full">
          
          {/* LEFT COLUMN: Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Upload Section */}
            <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">1</span>
                上传人物参考图
              </h2>
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`
                  relative group cursor-pointer h-48 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
                  ${uploadedImage 
                    ? 'border-violet-500/50 bg-violet-900/10' 
                    : 'border-white/10 hover:border-violet-500/50 hover:bg-white/5'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                {uploadedImage ? (
                  <div className="relative w-full h-full p-2">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded" 
                      className="w-full h-full object-contain rounded-lg" 
                    />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <p className="text-white font-medium flex items-center gap-2">
                        <RefreshCw size={16} /> 更换图片
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="text-gray-400 group-hover:text-white" />
                    </div>
                    <p className="text-sm text-gray-300 font-medium">点击上传 或 拖入图片</p>
                    <p className="text-xs text-gray-500 mt-1">支持 PNG, JPG</p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Title & AI Analysis */}
            <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 shadow-xl space-y-6">
              
              {/* Title Input */}
              <div>
                <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">2</span>
                  封面标题 (Text)
                </h2>
                <div className="relative">
                  <Type className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" />
                  <textarea
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：&#10;5分钟学会React！&#10;月薪过万攻略"
                    rows={3}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-24 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all text-lg font-medium resize-none min-h-[80px]"
                  />
                  <button 
                    onClick={handleAnalyzeTitle}
                    disabled={isAnalyzing || !title.trim()}
                    className={`
                      absolute right-2 bottom-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all
                      ${isAnalyzing 
                        ? 'bg-violet-500/20 text-violet-300' 
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20'}
                    `}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    {isAnalyzing ? '分析中' : 'AI分析'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">提示：标题换行会在封面中呈现为多行文字。</p>
              </div>

              {/* AI Style Suggestion Area (Always Visible) */}
              <div className="bg-gradient-to-br from-violet-900/20 to-purple-900/20 border border-violet-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-bold text-violet-200 uppercase tracking-wide">AI 风格推荐 (可重复点击刷新)</span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Clothing Field */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                        <Shirt className="w-3 h-3" /> 推荐服饰 (可修改)
                      </label>
                      <input 
                        type="text" 
                        value={clothingStyle}
                        onChange={(e) => setClothingStyle(e.target.value)}
                        placeholder="等待 AI 分析..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    {/* Background Field */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                        <Clapperboard className="w-3 h-3" /> 推荐场景 (可修改)
                      </label>
                      <input 
                        type="text" 
                        value={backgroundScene}
                        onChange={(e) => setBackgroundScene(e.target.value)}
                        placeholder="等待 AI 分析..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

              {/* Ratio Selection */}
              <div>
                <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">3</span>
                  画布比例
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      className={`
                        flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                        ${aspectRatio === opt.value 
                          ? 'bg-violet-600/20 border-violet-500 text-white' 
                          : 'bg-black/20 border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'}
                      `}
                    >
                      <opt.icon className="w-5 h-5 mb-1" />
                      <span className="text-xs font-medium">{opt.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Modification (Optional) */}
            <div className="bg-[#121212] rounded-2xl p-6 border border-white/5 shadow-xl">
              <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">4</span>
                额外补充 (可选)
              </h2>
              <div className="relative">
                <Wand2 className="absolute left-3 top-3.5 text-gray-500 w-4 h-4" />
                <textarea
                  value={modification}
                  onChange={(e) => setModification(e.target.value)}
                  placeholder="例如：给我加个眼镜，或者让表情更夸张..."
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all min-h-[60px] resize-none"
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`
                w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
                ${isGenerating 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'}
              `}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-current" />
                  {generatedImage ? '重新生成' : '立即生成封面'}
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Preview & History */}
          <div className="lg:col-span-8 flex gap-4 min-h-[600px]">
            {/* Main Preview Area */}
            <div className="flex-1 bg-[#0a0a0a] rounded-3xl border border-white/5 p-4 lg:p-8 flex flex-col relative overflow-hidden">
              
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" 
                style={{
                  backgroundImage: 'radial-gradient(circle at 50% 50%, #2d3748 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }}
              />

              <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full h-full">
                {isGenerating ? (
                  <div className="text-center space-y-6 animate-pulse">
                    <div className="w-24 h-24 mx-auto relative">
                      <div className="absolute inset-0 bg-violet-500/20 rounded-full animate-ping" />
                      <div className="relative z-10 w-full h-full bg-gradient-to-tr from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-white animate-spin-slow" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">AI 正在创作</h3>
                      <p className="text-violet-300 font-mono text-sm">{progressStep}</p>
                      {clothingStyle && (
                        <p className="text-gray-500 text-xs mt-2">应用风格：{clothingStyle} + {backgroundScene}</p>
                      )}
                    </div>
                  </div>
                ) : generatedBatchImages ? (
                  <div className="w-full h-full overflow-y-auto p-4 custom-scrollbar">
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {generatedBatchImages.map((img, idx) => (
                           <div key={idx} className="relative group rounded-xl overflow-hidden shadow-lg border border-white/10 bg-black/40">
                              <img src={img.url} alt={img.ratio} className="w-full h-auto object-contain" />
                              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-mono font-bold text-white">
                                 {img.ratio}
                              </div>
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                 <button 
                                   onClick={() => window.open(img.url, '_blank')}
                                   className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                                   title="全屏查看"
                                 >
                                    <Maximize2 size={16} />
                                 </button>
                                 <a 
                                    href={img.url}
                                    download={`cover-${img.ratio}-${Date.now()}.png`}
                                    className="p-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white transition-colors"
                                    title="下载"
                                 >
                                    <Download size={16} />
                                 </a>
                              </div>
                           </div>
                        ))}
                     </div>
                     <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => {
                             generatedBatchImages.forEach(img => {
                                const link = document.createElement('a');
                                link.href = img.url;
                                link.download = `cover-${img.ratio}-${Date.now()}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                             });
                          }} 
                          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2"
                        >
                           <Download size={18} /> 批量下载所有图片
                        </button>
                     </div>
                  </div>
                ) : generatedImage ? (
                  <div className="relative group w-full h-full flex items-center justify-center">
                    <img 
                      src={generatedImage} 
                      alt="Generated Cover" 
                      className="max-w-full max-h-[70vh] rounded-lg shadow-2xl shadow-black/50 object-contain"
                    />
                    <div className="absolute bottom-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300 backdrop-blur-sm p-2 rounded-xl">
                      <button 
                        onClick={() => window.open(generatedImage, '_blank')}
                        className="bg-black/80 hover:bg-black text-white px-4 py-2 rounded-lg backdrop-blur-md flex items-center gap-2 text-sm border border-white/10"
                      >
                        <Maximize2 size={16} /> 全屏查看
                      </button>
                      <button 
                        onClick={downloadImage}
                        className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-violet-600/30"
                      >
                        <Download size={18} /> 下载封面
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center opacity-40 max-w-md">
                    <ImageIcon className="w-24 h-24 mx-auto mb-4 text-gray-500" />
                    <h3 className="text-xl font-bold text-white mb-2">等待生成</h3>
                    <p className="text-gray-400">
                      在左侧上传图片、填写标题并点击 <span className="inline-flex items-center gap-1 bg-violet-500/20 px-1.5 py-0.5 rounded text-violet-300 text-xs"><Wand2 size={10}/> AI分析</span>，让 AI 为您定制专属风格。
                    </p>
                  </div>
                )}
              </div>

              {/* Hint */}
              {!isGenerating && generatedImage && (
                <div className="mt-6 text-center">
                   <p className="text-xs text-gray-500">
                     对结果不满意？您可以手动修改上方的“推荐服饰”或“推荐场景”，然后再次点击生成。
                   </p>
                </div>
              )}
            </div>

            {/* History Sidebar */}
            {history.length > 0 && (
               <div className="w-24 bg-[#121212] border border-white/5 rounded-2xl flex flex-col shrink-0 overflow-hidden">
                <div className="p-3 border-b border-white/5 text-center bg-black/20">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-1">
                    <History className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">历史</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleRestoreHistory(item)}
                      className={`
                        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all aspect-square
                        ${generatedImage === item.imageUrl ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-transparent hover:border-white/30'}
                      `}
                    >
                      <img 
                        src={item.imageUrl} 
                        alt="History" 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1">
                        <Clock className="w-4 h-4 text-white mb-1" />
                        <span className="text-[8px] text-gray-300 leading-tight text-center line-clamp-2">点击恢复风格</span>
                      </div>
                    </div>
                  ))}
                </div>
               </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}

// Mount the App
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}