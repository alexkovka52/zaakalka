export type Profile = {
  user_id: string; name: string; avatar_url: string | null; age: number | null; sex: string | null;
  height: number | null; weight: number | null; goal: string | null; level: string | null;
  training_experience: string | null; max_pullups: number; max_pushups: number; max_dips: number;
  equipment: string[]; training_frequency: number; language: "ru" | "en" | "ro";
  onboarding_completed: boolean; protein_goal: number; nutrition_goal: string | null;
  allergies: string | null; dietary_restrictions: string | null; xp: number; current_level: number;
};
export type Workout = { id: string; user_id: string; name: string; started_at: string; finished_at: string | null; duration: number | null; xp_earned: number; created_at: string; workout_exercises?: Exercise[] };
export type Exercise = { id?: string; workout_session_id?: string; exercise_name: string; sets: number; reps: number; weight: number | null; duration: number | null; notes: string | null };
export type Meal = { id: string; user_id: string; date: string; name: string; protein: number; fats: number; carbs: number; calories: number; image_url: string | null; ai_analysis: string | null; created_at: string };
export type DailyGoal = { id: string; user_id: string; date: string; workout_completed: boolean; protein_completed: boolean; water_completed: boolean; daily_goal_completed: boolean; water_ml: number; xp_earned: number };
export type Activity = { id: string; type: string; value: string; xp: number; metadata: Record<string, unknown> | null; created_at: string };
export type DashboardSettings = { block_order: string[]; hidden_blocks: string[] };
export type FoodEstimate = { name: string; protein: number; fats: number; carbs: number; calories: number; portion: string; analysis: string };
