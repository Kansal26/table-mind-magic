import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSessionScope } from "./ordering.server";
import Groq from "groq-sdk";
import { z } from "zod";

const parsedItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().min(1).max(50),
  customizations: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const voiceOrderSchema = z.object({
  parsed_items: z.array(parsedItemSchema),
  clarification_needed: z.string().nullable().optional(),
});

export type VoiceOrderResponse = z.infer<typeof voiceOrderSchema>;

export async function parseVoiceTranscript(
  qrToken: string,
  transcript: string
): Promise<VoiceOrderResponse> {
  const scope = await requireSessionScope(qrToken);
  if (!scope) throw new Error("Invalid session");

  const { data: menuItems, error } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, description, price, category, available")
    .eq("restaurant_id", scope.restaurantId)
    .eq("available", true);

  if (!menuItems || menuItems.length === 0) {
    console.error('Error: No menu items found for restaurant');
  }

  if (error || !menuItems) {
    throw new Error("Could not fetch menu items");
  }

  const menuContext = menuItems
    .map((item) => `[ID: ${item.id}] ${item.name} - ${item.category}`)
    .join("\n");

  const prompt = `You are a specialized voice-ordering extraction engine for a restaurant ordering system.
Match the user's spoken transcript against the provided RESTAURANT MENU and return ONLY a raw JSON object.

RESTAURANT MENU:
${menuContext}

The user said: "${transcript}"

JSON OUTPUT SCHEMA:
{
  "parsed_items": [
    {
      "menu_item_id": "string",
      "name": "string",
      "quantity": number,
      "customizations": "string or null",
      "confidence": number
    }
  ],
  "clarification_needed": "string or null"
}

RULES:
1. CONFIDENT MATCHES: Map clear items to menu_item_id, exact name, quantity (default 1), customizations, and confidence (0.0-1.0).
2. PARTIAL MATCHES: If some items are clear and others ambiguous, ALWAYS return clear items in \`parsed_items\`. Set \`clarification_needed\` to a short question asking ONLY about the ambiguous item.
3. NO GUESSING: If an item is ambiguous, do not assign a random menu_item_id. Rely on \`clarification_needed\`.
4. ALL CLEAR: If all items match, \`clarification_needed\` must be null.
5. UNMATCHED: If no items match, return empty \`parsed_items: []\` and \`clarification_needed: null\`.
6. INCOMPLETE FRAGMENTS: If the transcript appears to be cut off mid-sentence (e.g., ends with 'also I would love to add...' or similar incomplete phrasing), do NOT guess what the incomplete item might be, even if it fuzzy-matches a menu item. Instead, only return the items that were CLEARLY and COMPLETELY stated, and set clarification_needed to something like: 'It looks like you were about to add something else — what would you like?'`;

  const apiKey = process.env['GROQ_API_KEY'];
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  const groq = new Groq({ apiKey });

  const responsePromise = groq.chat.completions.create({
    messages: [
      { role: "system", content: prompt.replace(`The user said: "${transcript}"`, "") },
      { role: "user", content: `The user said: "${transcript}"` }
    ],
    model: "qwen/qwen3.6-27b",
    response_format: { type: "json_object" }
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout")), 10000);
  });

  try {
    const response = await Promise.race([responsePromise, timeoutPromise]);
    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("Failed to parse response");
    }

    const rawData = JSON.parse(text);
    
    // Fallback if LLM returns just the array
    let items = Array.isArray(rawData) ? rawData : (rawData.parsed_items || []);
    
    // Sanitize quantities and confidences to numbers
    items = items.map((item: any) => ({
      ...item,
      quantity: typeof item.quantity === 'string' ? parseInt(item.quantity, 10) || 1 : item.quantity,
      confidence: typeof item.confidence === 'string' ? parseFloat(item.confidence) || 1 : item.confidence
    }));

    return {
      parsed_items: items,
      clarification_needed: rawData.clarification_needed || null,
    } as VoiceOrderResponse;
  } catch (err: any) {
    console.error('LLM Call Failed or Timed Out:', err);
    throw err;
  }
}
