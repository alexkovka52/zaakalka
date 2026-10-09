"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { Flame, Settings2 } from "lucide-react";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { isSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabase/browser";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";

const localeList: Locale[] = ["ru", "en", "ro"];
export default function Home() {
  const [locale, setLocaleState] = useState<Locale>("ru");
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [setupError, setSetupError] = useState(false);
  const [demoProfile,setDemoProfile]=useState<Profile>({user_id:"demo",name:"ZAKALKA",avatar_url:null,age:24,sex:null,height:178,weight:72,goal:"goalStrength",level:"intermediate",training_experience:"1 year",max_pullups:10,max_pushups:25,max_dips:12,equipment:["equipmentPull","equipmentDip"],training_frequency:4,language:"ru",onboarding_completed:true,protein_goal:120,nutrition_goal:"",allergies:null,dietary_restrictions:null,xp:320,current_level:1});
  const saveDemoProfile=(next:Profile)=>{setDemoProfile(next);localStorage.setItem("zakalka-demo-profile",JSON.stringify(next))};
  const tx = useCallback((key: Parameters<typeof t>[1]) => t(locale,key), [locale]);
  const setLocale = (next: Locale) => { setLocaleState(next); document.documentElement.lang=next==="ro"?"ro":next; localStorage.setItem("zakalka-language",next); if(supabase&&session)void supabase.from("profiles").update({language:next}).eq("user_id",session.user.id); };

  const loadProfile = useCallback(async (client: SupabaseClient,userId:string) => {
    setProfileLoading(true);
    const {data,error}=await client.from("profiles").select("*").eq("user_id",userId).maybeSingle();
    if(error){setSetupError(true);setProfileLoading(false);return}
    setProfile(data as Profile|null);
    if(data?.language&&localeList.includes(data.language as Locale)){setLocaleState(data.language as Locale);localStorage.setItem("zakalka-language",data.language)}
    setProfileLoading(false);
  },[]);

  useEffect(()=>{const saved=localStorage.getItem("zakalka-language");if(saved&&localeList.includes(saved as Locale)){setLocaleState(saved as Locale);document.documentElement.lang=saved==="ro"?"ro":saved;}if(!isSupabaseConfigured()){const savedDemo=localStorage.getItem("zakalka-demo-profile");if(savedDemo){try{setDemoProfile({...demoProfile,...JSON.parse(savedDemo)})}catch{localStorage.removeItem("zakalka-demo-profile")}}setLoading(false);return}const client=getSupabaseBrowser();setSupabase(client);let alive=true;client.auth.getSession().then(({data})=>{if(!alive)return;setSession(data.session);if(data.session)void loadProfile(client,data.session.user.id);else setLoading(false)});const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{if(!alive)return;setSession(next);setProfile(null);if(next){void loadProfile(client,next.user.id)}else{setLoading(false);setProfileLoading(false)}});return()=>{alive=false;subscription.unsubscribe()}},[loadProfile]);

  if(!isSupabaseConfigured())return <AppShell key="demo" supabase={null} session={null} profile={demoProfile} onProfile={saveDemoProfile} locale={locale} onLocale={setLocale} onSignOut={()=>{}} demo/>;
  if(setupError)return <Setup locale={locale} onLocale={setLocale} connectionError/>;
  if(loading||profileLoading)return <main className="loading-screen"><div className="loading-flame"><Flame/></div><span className="eyebrow">ZAKALKA</span><p>{tx("loading")}</p></main>;
  if(!session||!supabase)return <AuthScreen supabase={supabase??getSupabaseBrowser()} locale={locale} onLocale={setLocale}/>;
  if(!profile||!profile.onboarding_completed)return <Onboarding supabase={supabase} userId={session.user.id} locale={locale} initial={profile} onComplete={setProfile}/>;
  return <AppShell key={session.user.id} supabase={supabase} session={session} profile={profile} onProfile={setProfile} locale={locale} onLocale={setLocale} onSignOut={async()=>{await supabase.auth.signOut();setSession(null);setProfile(null)}}/>;
}

function Setup({locale,onLocale,connectionError=false}:{locale:Locale;onLocale:(v:Locale)=>void;connectionError?:boolean}){return <main className="setup-page"><section className="setup-card"><img src="/images/zakalka-mark.png" alt="ZAKALKA"/><span className="eyebrow">ZAKALKA · FIRST SETUP</span><h1>{t(locale,"setupTitle")}</h1><p className="muted">{connectionError?t(locale,"loadSupabase"):t(locale,"setupBody")}</p><div className="setup-code"><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code><code>GEMINI_API_KEY <small>· server only</small></code></div><p className="muted">{t(locale,"setupDocs")}</p><div className="locale-switch">{(["ru","en","ro"] as Locale[]).map(code=><button key={code} className={locale===code?"selected":""} onClick={()=>{onLocale(code);localStorage.setItem("zakalka-language",code)}}>{code.toUpperCase()}</button>)}</div><a className="setup-doc" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"><Settings2 size={14}/> Supabase Dashboard ↗</a></section></main>}
