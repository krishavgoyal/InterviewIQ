import { useState } from "react";
import { BsRobot } from "react-icons/bs";
import { FcGoogle } from "react-icons/fc";
import { IoSparkles } from "react-icons/io5";
import { motion } from "motion/react";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { auth, isFirebaseConfigured, provider } from "../utils/firebase";
import { ServerUrl } from "../config/api";
import { setUserData } from "../redux/userSlice";

const MotionSection = motion.section;

const friendlyAuthError = (error) => {
  const code = error?.code || "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") return "Incorrect email address or password.";
  if (code === "auth/email-already-in-use") return "An account already exists for this email. Please log in instead.";
  if (code === "auth/weak-password") return "Use a password with at least six characters.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google window. Allow pop-ups and try again.";
  if (code === "auth/unauthorized-domain") return "This address is not authorised in Firebase. Add localhost to Firebase Authentication → Settings → Authorised domains.";
  if (code === "auth/configuration-not-found") return "Enable Google and Email/Password in Firebase Authentication → Sign-in method.";
  if (code.includes("api-key-not-valid")) return "Firebase rejected the Web API key. Recopy apiKey from Firebase Project settings → General → Your apps, save client/.env, and restart the Vite client.";
  return error?.response?.data?.message || error?.message || "We could not complete sign-in. Please try again.";
};

function Auth({ isModel = false }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const completeSession = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const result = await axios.post(`${ServerUrl}/api/auth/session`, { idToken }, { withCredentials: true });
    dispatch(setUserData(result.data));
    if (!isModel) navigate("/dashboard", { replace: true });
  };

  const ensureFirebase = () => {
    if (isFirebaseConfigured && auth) return true;
    setError("Firebase is not configured yet. Add VITE_FIREBASE_APIKEY to client/.env, then restart the client server.");
    return false;
  };

  const handleGoogleAuth = async () => {
    if (!ensureFirebase()) return;
    setError("");
    setIsLoading(true);
    try {
      const response = await signInWithPopup(auth, provider);
      await completeSession(response.user);
    } catch (requestError) {
      dispatch(setUserData(null));
      setError(friendlyAuthError(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    if (!ensureFirebase()) return;
    if (mode === "register" && !form.name.trim()) {
      setError("Enter your name to create an account.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await updateProfile(credential.user, { displayName: form.name.trim() });
        sendEmailVerification(credential.user).catch(() => {});
        await completeSession(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
        await completeSession(credential.user);
      }
    } catch (requestError) {
      dispatch(setUserData(null));
      setError(friendlyAuthError(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  return (
    <main className={`w-full ${isModel ? "py-4" : "min-h-screen bg-[radial-gradient(circle_at_top_left,_#dcfce7,_#f8fafc_42%,_#e0f2fe)] px-5 py-12 sm:flex sm:items-center sm:justify-center"}`}>
      <MotionSection initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={`mx-auto w-full bg-white shadow-2xl shadow-slate-900/10 ${isModel ? "max-w-md rounded-3xl p-7" : "max-w-md rounded-[2rem] p-7 sm:p-9"}`}>
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg"><BsRobot size={23} /></div>
          <p className="mt-3 font-semibold text-slate-900">InterviewIQ.AI</p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{mode === "login" ? "Log in to continue your personalised interview practice." : "Start preparing for interviews with personalised AI feedback."}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button type="button" onClick={() => switchMode("login")} className={`rounded-lg px-3 py-2 transition ${mode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Log in</button>
          <button type="button" onClick={() => switchMode("register")} className={`rounded-lg px-3 py-2 transition ${mode === "register" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Create account</button>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === "register" && <label className="block text-sm font-medium text-slate-700">Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>}
          <label className="block text-sm font-medium text-slate-700">Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>
          <label className="block text-sm font-medium text-slate-700">Password<input required type="password" minLength="6" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 6 characters" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>
          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p>}
          <button disabled={isLoading} className="w-full rounded-xl bg-emerald-600 py-3.5 font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{isLoading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">OR</div>
        <button type="button" onClick={handleGoogleAuth} disabled={isLoading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><FcGoogle size={20} /> Continue with Google</button>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><IoSparkles className="text-emerald-500" /> Secure sign-in for your interview history and reports</p>
      </MotionSection>
    </main>
  );
}

export default Auth;
