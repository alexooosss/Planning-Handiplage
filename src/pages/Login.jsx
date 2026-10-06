import React, { useState } from "react";
import { ShieldCheck, User, ArrowRight } from "lucide-react";

export default function Login({ accounts, onLogin, loadError }) {
  const [role, setRole] = useState("admin");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const acc = accounts.find((a) => a.id === id.trim() && a.password === pw && a.role === (role === "admin" ? "admin" : "user"));
    if (acc) onLogin(acc); else setErr("Identifiant ou mot de passe incorrect.");
  };
  return (
    <div className="login" data-role={role}>
      <div className="login-art"><img className="login-photo" src={`${import.meta.env.BASE_URL}plage.jpeg`} alt="La plage de la Salis à Antibes" /><img className="login-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Handiplage Planning" /></div>
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo-sm" src={`${import.meta.env.BASE_URL}logo-light.svg`} alt="Handiplage Planning" />
        <div className="role-tiles" role="radiogroup" aria-label="Type de compte">
          <button type="button" role="radio" className="role-tile admin" aria-checked={role === "admin"} onClick={() => { setRole("admin"); setErr(""); }}>
            <span className="rt-ico"><ShieldCheck size={22} /></span><b>Administrateur</b>
          </button>
          <button type="button" role="radio" className="role-tile user" aria-checked={role === "user"} onClick={() => { setRole("user"); setErr(""); }}>
            <span className="rt-ico"><User size={22} /></span><b>Agent</b>
          </button>
        </div>
        <h1>{role === "admin" ? "Espace administrateur" : "Espace agent"}</h1>
        <label className="field"><span className="field-label">Identifiant</span><input className="input" value={id} onChange={(e) => { setId(e.target.value); setErr(""); }} autoComplete="username" /></label>
        <label className="field"><span className="field-label">Mot de passe</span><input className="input" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} autoComplete="current-password" /></label>
        {err && <p className="field-error" role="alert">{err}</p>}
        <button className="btn login-submit" type="submit">Se connecter<ArrowRight size={16} /></button>
        {loadError && <p className="field-error" role="alert">Impossible de joindre la base de données : vérifiez la connexion internet puis rechargez la page.</p>}
      </form>
    </div>
  );
}
