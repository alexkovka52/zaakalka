import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
const payloadSchema = z.object({ message: z.string().trim().min(1).max(4000) });

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) return Response.json({ error: "AI is not configured on the server." }, { status: 503 });
    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Enter a message up to 4,000 characters." }, { status: 400 });
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "Authentication required." }, { status: 401 });
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").gte("created_at", since);
    if ((count ?? 0) >= 12) return Response.json({ error: "Message limit reached. Please wait a minute." }, { status: 429 });
    const [profileResult, workoutsResult, mealsResult, chatResult] = await Promise.all([
      supabase.from("profiles").select("name,age,height,weight,goal,level,equipment,training_frequency,protein_goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("workout_sessions").select("name,started_at,duration,workout_exercises(exercise_name,sets,reps,weight)").eq("user_id", user.id).not("finished_at", "is", null).order("started_at", { ascending: false }).limit(5),
      supabase.from("meals").select("name,protein,fats,carbs,calories,date").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("ai_messages").select("role,content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
    ]);
    const profile = profileResult.data;
    const coachContext = {
      name: profile?.name,
      age: profile?.age,
      height_cm: profile?.height,
      weight_kg: profile?.weight,
      goal: profile?.goal,
      level: profile?.level,
      available_equipment: profile?.equipment,
      sessions_per_week: profile?.training_frequency,
      protein_target_g: profile?.protein_goal,
      recent_workouts: workoutsResult.data ?? [],
      recent_food_log: mealsResult.data ?? [],
    };
    const systemInstruction = `You are ZAKALKA Coach, a concise and supportive fitness and nutrition assistant. Reply in the user's language, which can be Russian, English, or Romanian. Use the supplied context only when relevant. Give practical, conservative guidance. Never diagnose or claim to be a clinician. For severe or alarming symptoms, tell the user to contact a medical professional or emergency services. Do not invent logged activity or nutrition values. User context: ${JSON.stringify(coachContext).slice(0, 7000)}`;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const contents = (chatResult.data ?? []).reverse().map((item) => ({ role: item.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: item.content }] }));
    const response = await ai.models.generateContent({ model: "gemini-3.8-flash", contents, config: { systemInstruction, temperature: 0.4, maxOutputTokens: 900 } });
    const answer = response.text?.trim();
    if (!answer) throw new Error("The AI returned an empty response.");
    const { error: saveError } = await supabase.from("ai_messages").insert({ user_id: user.id, role: "assistant", content: answer });
    if (saveError) throw saveError;
    return Response.json({ answer });
  } catch (error) {
    console.error("AI chat request failed", error);
    return Response.json({ error: "AI Coach is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
