import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const parseVoiceOrderSchema = z.object({
  qrToken: z.string().min(1).max(200),
  transcript: z.string().min(1).max(2000),
});

export const parseVoiceOrderFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseVoiceOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { parseVoiceTranscript } = await import("./voice.server");
    return parseVoiceTranscript(data.qrToken, data.transcript);
  });
