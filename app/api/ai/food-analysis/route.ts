import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
const schema = z.object({ path: z.string().min(10).max(300) });

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "Food photo analysis is not configured." }, { status: 503 });
    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Choose a JPEG, PNG, or WebP image smaller than 8 MB." }, { status: 400 });
    const supabase = await getSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "Authentication required." }, { status: 401 });
    if (!body.data.path.startsWith(user.id + "/") || body.data.path.includes("..")) return Response.json({ error: "Invalid image path." }, { status: 403 });
    const { data: signed, error: storageError } = await supabase.storage.from("food-photos").createSignedUrl(body.data.path, 60);
    if (storageError || !signed?.signedUrl) return Response.json({ error: "Image could not be read. Upload it again." }, { status: 400 });
    const imageResponse = await fetch(signed.signedUrl);
    if (!imageResponse.ok) return Response.json({ error: "Image could not be read. Upload it again." }, { status: 400 });
    const image = await imageResponse.arrayBuffer();
    if (image.byteLength > 8 * 1024 * 1024) return Response.json({ error: "Image must be smaller than 8 MB." }, { status: 413 });
    const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return Response.json({ error: "Unsupported image format." }, { status: 415 });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [
        { text: "Estimate the visible food and portion. Return realistic approximate nutrition values, not medical advice. If the food is unclear, state uncertainty in the analysis. Return JSON only." },
        { inlineData: { mimeType, data: Buffer.from(image).toString("base64") } },
      ] }],
      config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: {
        name: { type: Type.STRING }, portion: { type: Type.STRING }, protein: { type: Type.NUMBER }, fats: { type: Type.NUMBER }, carbs: { type: Type.NUMBER }, calories: { type: Type.NUMBER }, analysis: { type: Type.STRING },
      }, required: ["name", "portion", "protein", "fats", "carbs", "calories", "analysis"] }, maxOutputTokens: 400 },
    });
    const estimate = JSON.parse(response.text ?? "{}");
    const valid = z.object({ name: z.string().min(1).max(120), portion: z.string().max(200), protein: z.number().min(0).max(500), fats: z.number().min(0).max(500), carbs: z.number().min(0).max(1000), calories: z.number().min(0).max(8000), analysis: z.string().max(1000) }).safeParse(estimate);
    if (!valid.success) return Response.json({ error: "Could not produce a reliable food estimate. Please enter it manually." }, { status: 422 });
    return Response.json({ estimate: valid.data });
  } catch (error) {
    console.error("Food analysis request failed", error);
    return Response.json({ error: "Could not analyze this photo. Please try again or enter the meal manually." }, { status: 502 });
  }
}
