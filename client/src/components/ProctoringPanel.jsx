import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { FaCamera, FaCheckCircle, FaExpand, FaExclamationTriangle, FaShieldAlt, FaVideoSlash } from "react-icons/fa";
import { ServerUrl } from "../config/api";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function ProctoringPanel({ interviewId, questionIndex, active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const checkingRef = useRef(false);
  const hadFocusModeRef = useRef(false);
  const [consented, setConsented] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [status, setStatus] = useState("Camera is off. Start monitoring when you are ready.");
  const [error, setError] = useState("");

  const sendSignal = useCallback(async (eventType) => {
    try {
      const response = await axios.post(`${ServerUrl}/api/interview/proctor-check`, {
        interviewId,
        questionIndex,
        eventType,
      }, { withCredentials: true });
      if (typeof response.data?.reviewCount === "number") setReviewCount(response.data.reviewCount);
    } catch {
      // Browser signals are best-effort; the interview must remain usable when the network is interrupted.
    }
  }, [interviewId, questionIndex]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return "";

    const scale = Math.min(1, 640 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.64);
  }, []);

  const runVisualCheck = useCallback(async () => {
    if (!monitoring || !active || checkingRef.current || document.visibilityState !== "visible") return;
    const frame = captureFrame();
    if (!frame) return;

    checkingRef.current = true;
    setIsChecking(true);
    setError("");
    try {
      const response = await axios.post(`${ServerUrl}/api/interview/proctor-check`, {
        interviewId,
        questionIndex,
        frame,
      }, { withCredentials: true });
      const flags = Array.isArray(response.data?.flags) ? response.data.flags : [];
      setReviewCount(Number(response.data?.reviewCount || 0));
      setStatus(flags.length ? `${flags.length} visual item${flags.length === 1 ? "" : "s"} was flagged for review.` : "Visual check complete — no clear review signal found.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The visual integrity check could not run. Browser signals remain active.");
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, [active, captureFrame, interviewId, monitoring, questionIndex]);

  const stopMonitoring = useCallback((reportStop = true) => {
    const stream = streamRef.current;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setMonitoring(false);
    setStatus("Camera monitoring is off.");
    if (reportStop) sendSignal("camera_stopped");
  }, [sendSignal]);

  const startMonitoring = async () => {
    if (!consented) {
      setError("Please confirm the camera privacy notice before starting monitoring.");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => sendSignal("camera_stopped");
      });
      setMonitoring(true);
      setStatus("Camera monitoring is active. Preparing an initial visual check...");
      await sendSignal("camera_started");
    } catch (cameraError) {
      setError(cameraError?.name === "NotAllowedError"
        ? "Camera permission was blocked. Allow camera access in the browser, then try again."
        : "The camera could not be started. Check that no other app is using it, then try again.");
    }
  };

  const enableFocusMode = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      hadFocusModeRef.current = Boolean(document.fullscreenElement);
      if (hadFocusModeRef.current) setStatus("Focus mode is active.");
    } catch {
      setError("Focus mode was not enabled. You can continue with camera monitoring.");
    }
  };

  useEffect(() => {
    if (!monitoring || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [monitoring]);

  useEffect(() => {
    if (!monitoring || !active) return undefined;
    const initialCheck = window.setTimeout(runVisualCheck, 700);
    const interval = window.setInterval(runVisualCheck, CHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.hidden) sendSignal("tab_hidden");
    };
    const onWindowBlur = () => {
      if (document.visibilityState === "visible") sendSignal("window_blur");
    };
    const onFullscreenChange = () => {
      if (hadFocusModeRef.current && !document.fullscreenElement) {
        hadFocusModeRef.current = false;
        sendSignal("focus_mode_exited");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [active, monitoring, runVisualCheck, sendSignal]);

  useEffect(() => () => stopMonitoring(false), [stopMonitoring]);

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><FaShieldAlt className="text-slate-700" /><div><p className="font-semibold text-slate-900">Practice integrity monitor</p><p className="mt-0.5 text-xs text-slate-600">Optional camera review for a realistic mock-interview environment.</p></div></div>
        {monitoring ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">Off</span>}
      </div>

      {monitoring && <div className="mt-3 overflow-hidden rounded-xl bg-slate-900"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /></div>}

      {!monitoring && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-0.5 accent-emerald-600" /><span>I consent to camera use during this practice session. This app does not record or save video. Periodic still frames are sent to the configured AI service for observable integrity-review signals only.</span></label>}

      <div className="mt-3 flex flex-wrap gap-2">
        {!monitoring ? <button type="button" onClick={startMonitoring} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"><FaCamera /> Start camera monitor</button> : <><button type="button" onClick={runVisualCheck} disabled={isChecking} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{isChecking ? "Checking…" : "Run visual check"}</button><button type="button" onClick={enableFocusMode} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"><FaExpand /> Focus mode</button><button type="button" onClick={() => stopMonitoring(true)} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"><FaVideoSlash /> Stop camera</button></>}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-600">{reviewCount > 0 ? <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-500" /> : <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-600" />}<span>{status}{reviewCount > 0 ? ` ${reviewCount} item${reviewCount === 1 ? "" : "s"} marked for review; flags are not an automatic cheating decision.` : ""}</span></p>
      {error && <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>}
    </section>
  );
}

export default ProctoringPanel;
