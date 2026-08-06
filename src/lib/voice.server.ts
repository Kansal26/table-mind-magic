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
  console.log('[Voice Debug] Incoming params:', { qrToken, transcript });

  const scope = await requireSessionScope(qrToken);
  if (!scope) throw new Error("Invalid session");

  const { data: menuItems, error } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, description, price, category, available")
    .eq("restaurant_id", scope.restaurantId)
    .eq("available", true);

  console.log('[Voice Debug] Session Data:', scope);
  console.log('[Voice Debug] Fetched Menu Items Count:', menuItems?.length);

  if (!menuItems || menuItems.length === 0) {
    console.error('[Voice Debug] Error: No menu items found for restaurant');
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
5. UNMATCHED: If no items match, return empty \`parsed_items: []\` and \`clarification_needed: null\`.`;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  const groq = new Groq({ apiKey });

  console.log('[Voice Debug] Sending request to LLM API...');
  const responsePromise = groq.chat.completions.create({
    messages: [{ role: "system", content: prompt }],
    model: "llama-3.3-70b-versatile",
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

    return JSON.parse(text) as VoiceOrderResponse;
  } catch (err) {
    console.error('[Voice Debug] LLM Call Failed or Timed Out:', err);
    throw err;
  }
}
