import { GoogleGenerativeAI } from "@google/generative-ai";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

export const findResources = async (query: string, subject: string): Promise<string[]> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      Find 2-3 high-quality, free online resources for learning about: ${query}
      Subject area: ${subject}
      
      Requirements:
      - Must be from reputable sources
      - Should be freely accessible (no paywalls)
      - Prefer official documentation, educational sites, or well-known learning platforms
      - Return only the URLs in a JSON array
      
      Example: ["https://example.com/resource1", "https://example.com/resource2"]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      // Try to parse as JSON first
      const urls = JSON.parse(text);
      if (Array.isArray(urls)) {
        return urls;
      }
      
      // Fallback: Extract URLs from text
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text.match(urlRegex) || [];
    } catch (e) {
      // Return empty array if response parsing fails
      return [];
    }
  } catch (error) {
    // Silently fail and return empty array
    return [];
  }
};
