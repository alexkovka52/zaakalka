"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Flame, Mail, LockKeyhole, ArrowUpRight } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

type Props = { supabase: SupabaseClient; locale: Locale; onLocale: (value: Locale) => void };
export function AuthScreen({ supabase, locale, onLocale }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const tx = (key: Parameters<typeof t>[1]) => t(locale, key);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "reset") setMode("reset"); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "signup") {
        const { error: authError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (authError) throw authError; setNotice(tx("signupSent"));
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/?mode=reset` });
        if (authError) throw authError; setNotice(tx("resetSent"));
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError; setMode("login"); setNotice(tx("profileSaved")); history.replaceState({}, "", "/");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : tx("loadError")); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><img src="/images/zakalka-mark.png" alt="ZAKALKA" /><span>ZAKALKA</span></div><div className="locale-switch" aria-label={tx("language")}>{(["ru", "en", "ro"] as Locale[]).map(code => <button key={code} className={locale === code ? "selected" : ""} onClick={() => onLocale(code)}>{code.toUpperCase()}</button>)}</div><div className="auth-icon"><Flame size={21}/></div><span className="eyebrow">ZAKALKA ACCOUNT</span><h1>{mode === "reset" ? tx("resetPassword") : mode === "forgot" ? tx("forgot") : tx("authWelcome")}</h1><p className="muted">{tx("authSub")}</p><form className="auth-form" onSubmit={submit}>{mode !== "reset" && <label><span>{tx("email")}</span><span className="input-icon"><Mail size={16}/><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></span></label>}{mode !== "forgot" && <label><span>{mode === "reset" ? tx("resetPassword") : tx("password")}</span><span className="input-icon"><LockKeyhole size={16}/><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} /></span></label>}{mode === "login" && <button type="button" className="auth-link align-right" onClick={()=>setMode("forgot")}>{tx("forgot")}</button>}<button className="primary-button auth-submit" disabled={busy}>{busy ? tx("loading") : mode === "login" ? tx("signIn") : mode === "signup" ? tx("signUp") : mode === "forgot" ? tx("sendReset") : tx("resetPassword")} <ArrowUpRight size={15}/></button></form>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}{mode !== "forgot" && mode !== "reset" && <p className="auth-switch">{mode === "login" ? tx("noAccount") : tx("hasAccount")} <button className="auth-link" onClick={()=>{setMode(mode === "login" ? "signup" : "login");setError("");setNotice("")}}>{mode === "login" ? tx("signUp") : tx("signIn")}</button></p>}</div><p className="auth-safety">{tx("chatSafety")}</p></main>;
}


