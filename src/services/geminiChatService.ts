import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const scrapeWebsiteTool: FunctionDeclaration = {
  name: "scrapeWebsite",
  description: "Scrapes the text content of a given website URL. Useful for extracting products and business descriptions from a user's website.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full URL of the website to scrape, e.g. https://example.com"
      }
    },
    required: ["url"]
  }
};

import systemInstruction from "./systemPrompt.md?raw";

const responseSchema = {
    type: Type.OBJECT,
    properties: {
      conversation: {
        type: Type.STRING,
        description: "The text you want to say to the user on this turn (e.g., asking for their website, suggesting a description, or confirming completion)."
      },
      stop: {
        type: Type.BOOLEAN,
        description: "Set to true when the onboarding is finished or the 5 turn limit is reached."
      },
      products: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            image_url: { type: Type.STRING },
            sell_price: { type: Type.STRING },
            cost_price: { type: Type.STRING },
            description: { type: Type.STRING },
            suggested_description: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      },
      business_description: {
        type: Type.STRING,
        description: "A short summary of what the business does, who they serve, and market positioning."
      }
    },
    required: ["conversation", "stop", "products"]
};

export { ai, systemInstruction, responseSchema, scrapeWebsiteTool };
