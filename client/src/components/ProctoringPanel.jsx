import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaCamera, FaCheckCircle, FaExpand, FaExclamationTriangle, FaShieldAlt, FaVideoSlash } from "react-icons/fa";
import { ServerUrl } from "../config/api";

// Local checks run every 2.5 seconds; this AI-backed image review is the fallback
// for signals that a browser cannot reliably detect, such as a secondary display.
const AI_CHECK_INTERVAL_MS = 25 * 1000;
const LIVE_CHECK_INTERVAL_MS = 2500;

const browserWarningDetails = {
  tab_hidden: "Interview tab is not visible. Return to the interview window.",
  window_blur: "Interview window lost focus. Keep the interview window active.",
  focus_mode_exited: "Focus mode was exited. Return to focus mode if your interview requires it.",
  camera_stopped: "Camera monitoring stopped. Restart it to continue the practice integrity check.",
};

const detectedWarningDetails = {
  no_face: "Face not visible. Please return to the camera frame.",
  multiple_people: "Multiple people detected. Only one candidate should be in the camera frame.",
  visible_phone: "Phone detected in the camera frame. Please keep phones out of view.",
  visible_secondary_screen: "A possible secondary screen was detected. Please check your interview setup.",
};

const toWarning = (eventType, message) => ({
  eventType,
  message: message || detectedWarningDetails[eventType] || browserWarningDetails[eventType] || "An integrity-review signal needs attention.",
});

function ProctoringPanel({ interviewId, questionIndex, active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const checkingRef = useRef(false);
  const liveCheckingRef = useRef(false);
  const previousLiveWarningsRef = useRef(new Set());
  const faceDetectorRef = useRef(null);
  const faceModelRef = useRef(null);
  const objectDetectorRef = useRef(null);
  const detectorLoadRef = useRef(false);
  const hadFocusModeRef = useRef(false);
  const [consented, setConsented] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [status, setStatus] = useState("Camera is off. Start monitoring when you are ready.");
  const [error, setError] = useState("");
  const [liveWarnings, setLiveWarnings] = useState([]);
  const [browserWarnings, setBrowserWarnings] = useState([]);
  const [aiWarnings, setAiWarnings] = useState([]);
  const [detectionStatus, setDetectionStatus] = useState("Local live checks will start after the camera is ready.");

  const activeWarnings = useMemo(() => {
    const unique = new Map();
    [...browserWarnings, ...liveWarnings, ...aiWarnings].forEach((warning) => {
      if (!unique.has(warning.eventType)) unique.set(warning.eventType, warning);
    });
    return [...unique.values()];
  }, [aiWarnings, browserWarnings, liveWarnings]);

  const sendSignal = useCallback(async (eventType) => {
    try {
      const response = await axios.post(`${ServerUrl}/api/interview/proctor-check`, {
        interviewId,
        questionIndex,
        eventType,
      }, { withCredentials: true });
      if (typeof response.data?.reviewCount === "number") setReviewCount(response.data.reviewCount);
      return response.data;
    } catch {
      // Browser signals are best-effort; the interview must remain usable when the network is interrupted.
      return null;
    }
  }, [interviewId, questionIndex]);

  const setBrowserWarning = useCallback((eventType, visible) => {
    setBrowserWarnings((current) => {
      const withoutSignal = current.filter((warning) => warning.eventType !== eventType);
      return visible ? [...withoutSignal, toWarning(eventType)] : withoutSignal;
    });
  }, []);

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
      setAiWarnings(flags.map((flag) => toWarning(flag.eventType, flag.message)));
      setReviewCount(Number(response.data?.reviewCount || 0));
      setStatus(flags.length ? `${flags.length} visual item${flags.length === 1 ? "" : "s"} needs review.` : "Visual check complete — no clear review signal found.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The visual integrity check could not run. Local and browser checks remain active.");
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, [active, captureFrame, interviewId, monitoring, questionIndex]);

  const initializeLocalDetectors = useCallback(async () => {
    if (detectorLoadRef.current) return;
    detectorLoadRef.current = true;
    const supportsFaceDetection = "FaceDetector" in window;
    if (supportsFaceDetection) {
      try {
        faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
      } catch {
        faceDetectorRef.current = null;
      }
    }

    let hasFaceCheck = Boolean(faceDetectorRef.current);
    if (!hasFaceCheck) {
      try {
        const blazeFace = await import("@tensorflow-models/blazeface");
        faceModelRef.current = await blazeFace.load();
        hasFaceCheck = true;
      } catch {
        faceModelRef.current = null;
      }
    }

    let hasPhoneCheck = false;
    try {
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      objectDetectorRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      hasPhoneCheck = true;
    } catch {
      objectDetectorRef.current = null;
    }

    if (hasFaceCheck && hasPhoneCheck) setDetectionStatus("Live face-count and phone checks are active on this device.");
    else if (hasFaceCheck) setDetectionStatus("Live face-count checks are active. Phone checks use periodic visual review.");
    else if (hasPhoneCheck) setDetectionStatus("Live phone checks are active. Face checks use periodic visual review.");
    else setDetectionStatus("Local live detection is unavailable. Periodic visual review and browser checks remain available.");
  }, []);

  const syncLiveWarnings = useCallback((nextWarnings) => {
    const nextCodes = new Set(nextWarnings.map((warning) => warning.eventType));
    nextWarnings.forEach((warning) => {
      if (!previousLiveWarningsRef.current.has(warning.eventType)) sendSignal(warning.eventType);
    });
    previousLiveWarningsRef.current = nextCodes;
    setLiveWarnings(nextWarnings);
  }, [sendSignal]);

  const checkLiveScene = useCallback(async () => {
    const video = videoRef.current;
    if (!monitoring || !active || !video || video.readyState < 2 || !video.videoWidth || liveCheckingRef.current) return;

    liveCheckingRef.current = true;
    try {
      const warnings = [];
      if (faceDetectorRef.current) {
        const faces = await faceDetectorRef.current.detect(video);
        if (faces.length === 0) warnings.push(toWarning("no_face"));
        if (faces.length > 1) warnings.push(toWarning("multiple_people"));
      } else if (faceModelRef.current) {
        const faces = await faceModelRef.current.estimateFaces(video, false);
        if (faces.length === 0) warnings.push(toWarning("no_face"));
        if (faces.length > 1) warnings.push(toWarning("multiple_people"));
      }
      if (objectDetectorRef.current) {
        const objects = await objectDetectorRef.current.detect(video, 5, 0.55);
        if (objects.some((object) => object.class === "cell phone" && object.score >= 0.55)) {
          warnings.push(toWarning("visible_phone"));
        }
      }
      syncLiveWarnings(warnings);
    } catch {
      // A detector failure must not block the interview or create a false warning.
    } finally {
      liveCheckingRef.current = false;
    }
  }, [active, monitoring, syncLiveWarnings]);

  const stopMonitoring = useCallback((reportStop = true) => {
    const stream = streamRef.current;
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    previousLiveWarningsRef.current = new Set();
    setLiveWarnings([]);
    setAiWarnings([]);
    setMonitoring(false);
    setStatus("Camera monitoring is off.");
    if (reportStop) {
      setBrowserWarning("camera_stopped", true);
      sendSignal("camera_stopped");
    }
  }, [sendSignal, setBrowserWarning]);

  const startMonitoring = async () => {
    if (!consented) {
      setError("Please confirm the camera privacy notice before starting monitoring.");
      return;
    }

    try {
      setError("");
      setBrowserWarning("camera_stopped", false);
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
        track.onended = () => {
          setBrowserWarning("camera_stopped", true);
          sendSignal("camera_stopped");
        };
      });
      setMonitoring(true);
      setStatus("Camera monitoring is active. Automatic live checks are starting...");
      await sendSignal("camera_started");
      initializeLocalDetectors();
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
      if (hadFocusModeRef.current) {
        setBrowserWarning("focus_mode_exited", false);
        setStatus("Focus mode is active.");
      }
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
    const initialAiCheck = window.setTimeout(runVisualCheck, 900);
    const initialLiveCheck = window.setTimeout(checkLiveScene, 1200);
    const aiInterval = window.setInterval(runVisualCheck, AI_CHECK_INTERVAL_MS);
    const liveInterval = window.setInterval(checkLiveScene, LIVE_CHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      setBrowserWarning("tab_hidden", document.hidden);
      if (document.hidden) sendSignal("tab_hidden");
    };
    const onWindowBlur = () => {
      if (document.visibilityState === "visible") {
        setBrowserWarning("window_blur", true);
        sendSignal("window_blur");
      }
    };
    const onWindowFocus = () => setBrowserWarning("window_blur", false);
    const onFullscreenChange = () => {
      if (hadFocusModeRef.current && !document.fullscreenElement) {
        hadFocusModeRef.current = false;
        setBrowserWarning("focus_mode_exited", true);
        sendSignal("focus_mode_exited");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.clearTimeout(initialAiCheck);
      window.clearTimeout(initialLiveCheck);
      window.clearInterval(aiInterval);
      window.clearInterval(liveInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [active, checkLiveScene, monitoring, runVisualCheck, sendSignal, setBrowserWarning]);

  useEffect(() => () => stopMonitoring(false), [stopMonitoring]);

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><FaShieldAlt className="text-slate-700" /><div><p className="font-semibold text-slate-900">Practice integrity monitor</p><p className="mt-0.5 text-xs text-slate-600">Optional, privacy-aware camera checks for a realistic mock interview.</p></div></div>
        {monitoring ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">Off</span>}
      </div>

      {monitoring && <div className="mt-3 overflow-hidden rounded-xl bg-slate-900"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /></div>}

      {!monitoring && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-0.5 accent-emerald-600" /><span>I consent to camera use during this practice session. Video is not recorded or stored. Local checks inspect only face count and visible phones; an optional still-frame review is automatically sent to the configured AI service about every 25 seconds for the stated observable review signals.</span></label>}

      <div className="mt-3 flex flex-wrap gap-2">
        {!monitoring ? <button type="button" onClick={startMonitoring} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"><FaCamera /> Start camera monitor</button> : <><button type="button" onClick={runVisualCheck} disabled={isChecking} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{isChecking ? "Checking…" : "Check now"}</button><button type="button" onClick={enableFocusMode} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"><FaExpand /> Focus mode</button><button type="button" onClick={() => stopMonitoring(true)} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"><FaVideoSlash /> Stop camera</button></>}
      </div>

      {monitoring && <p className="mt-3 text-xs leading-relaxed text-slate-500">{detectionStatus} AI visual review also runs automatically about every 25 seconds. Eye direction, identity, emotion, and intent are not assessed.</p>}
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-600">{reviewCount > 0 ? <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-500" /> : <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-600" />}<span>{status}{reviewCount > 0 ? ` ${reviewCount} item${reviewCount === 1 ? "" : "s"} marked for review; signals are not an automatic cheating decision.` : ""}</span></p>
      {error && <p className="mt-2 text-xs leading-relaxed text-red-600">{error}</p>}

      {activeWarnings.length > 0 && <div role="alert" className="fixed bottom-5 right-5 z-50 w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-2xl"><div className="flex gap-3"><FaExclamationTriangle className="mt-0.5 shrink-0 text-red-600" /><div><p className="font-bold text-red-800">Integrity review warning</p><ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-red-700">{activeWarnings.map((warning) => <li key={warning.eventType}>{warning.message}</li>)}</ul><p className="mt-2 text-xs text-red-700">This alert clears when the observable condition clears. It is a review signal, not an automatic cheating decision.</p></div></div></div>}
    </section>
  );
}

export default ProctoringPanel;
