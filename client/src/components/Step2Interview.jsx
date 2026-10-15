import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BsArrowRight } from "react-icons/bs";
import { FaLightbulb, FaMicrophone, FaMicrophoneSlash, FaRegKeyboard } from "react-icons/fa";
import { motion } from "motion/react";
import femaleVideo from "../assets/videos/female-ai.mp4";
import maleVideo from "../assets/videos/male-ai.mp4";
import { ServerUrl } from "../config/api";
import Timer from "./Timer";
import CodeEditor from "./CodeEditor";
import { codingLanguages, defaultLanguageForTopic } from "../utils/codingLanguages";
import ScribblePad from "./ScribblePad";
import ProctoringPanel from "./ProctoringPanel";

const MotionButton = motion.button;

function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, questions = [], userName = "there", microphoneReady } = interviewData;
  const [isIntroPhase, setIsIntroPhase] = useState(true);
  const [questionActive, setQuestionActive] = useState(false);
  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(microphoneReady === false ? "Microphone permission was not granted. Turn on microphone access in the browser, then tap the mic button." : "");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(questions[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voiceGender, setVoiceGender] = useState("female");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [code, setCode] = useState(() => questions[0]?.requiresCode ? questions[0].starterCode || "" : "");
  const [codeLanguage, setCodeLanguage] = useState(() => defaultLanguageForTopic(questions[0]?.topic));
  const [codeVersion, setCodeVersion] = useState(() => codingLanguages.find((item) => item.id === defaultLanguageForTopic(questions[0]?.topic))?.versions[0] || "Structured");
  const [scribbleImage, setScribbleImage] = useState("");
  const [hints, setHints] = useState(() => Array.isArray(questions[0]?.hints) ? questions[0].hints : []);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hintError, setHintError] = useState("");

  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const shouldListenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const micEnabledRef = useRef(true);
  const restartTimerRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const answerRef = useRef("");

  const currentQuestion = questions[currentIndex];
  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;

  const stopListening = (keepEnabled = false) => {
    shouldListenRef.current = keepEnabled;
    window.clearTimeout(restartTimerRef.current);

    if (recognitionRef.current && recognitionActiveRef.current) {
      recognitionRef.current.stop();
    }

    setIsListening(false);
  };

  const startListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition || !micEnabledRef.current || isSpeakingRef.current || recognitionActiveRef.current) return;

    shouldListenRef.current = true;
    setSpeechError("");

    try {
      recognition.start();
    } catch (error) {
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        setSpeechError("Microphone access is unavailable. Use Chrome or Edge on localhost/HTTPS and allow microphone permission.");
      }
    }
  };

  useEffect(() => {
    micEnabledRef.current = isMicOn;
  }, [isMicOn]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const unsupportedTimer = window.setTimeout(() => {
        setSpeechError("Voice input is not supported in this browser. You can still type your answer.");
      }, 0);
      return () => window.clearTimeout(unsupportedTimer);
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setIsListening(true);
      setSpeechError("");
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          finalTranscript += ` ${event.results[index][0].transcript}`;
        } else {
          interimTranscript += ` ${event.results[index][0].transcript}`;
        }
      }

      liveTranscriptRef.current = interimTranscript.trim();
      setLiveTranscript(interimTranscript.trim());

      if (finalTranscript.trim()) {
        setAnswer((previous) => {
          const nextAnswer = `${previous}${finalTranscript}`.replace(/\s+/g, " ").trimStart();
          answerRef.current = nextAnswer;
          return nextAnswer;
        });
        liveTranscriptRef.current = "";
        setLiveTranscript("");
      }
    };

    recognition.onerror = (event) => {
      recognitionActiveRef.current = false;
      setIsListening(false);
      setLiveTranscript("");

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setSpeechError("Microphone permission was blocked. Allow microphone access, then turn the mic on.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setSpeechError("Voice recognition paused. Tap the microphone to try again.");
      }
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      setIsListening(false);

      if (shouldListenRef.current && micEnabledRef.current && !isSpeakingRef.current) {
        restartTimerRef.current = window.setTimeout(startListening, 250);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      window.clearTimeout(restartTimerRef.current);
      recognition.abort();
    };
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      if (!voices.length) return;

      const femaleVoice = voices.find((voice) => /zira|samantha|jenny|female/i.test(voice.name));
      const maleVoice = voices.find((voice) => /david|mark|guy|male/i.test(voice.name));
      const selected = femaleVoice || maleVoice || voices.find((voice) => voice.lang.startsWith("en")) || voices[0];

      setSelectedVoice(selected);
      setVoiceGender(femaleVoice || (!maleVoice && selected !== maleVoice) ? "female" : "male");
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speakText = (text) => new Promise((resolve) => {
    if (!window.speechSynthesis || !selectedVoice) {
      resolve();
      return;
    }

    stopListening(false);
    window.speechSynthesis.cancel();
    isSpeakingRef.current = true;
    setIsAIPlaying(true);
    setSubtitle(text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = 1;
    utterance.pitch = 1.02;
    utterance.volume = 1;

    utterance.onstart = () => {
      videoRef.current?.play().catch(() => {});
    };

    const finishSpeaking = () => {
      isSpeakingRef.current = false;
      setIsAIPlaying(false);
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.currentTime = 0;
      resolve();
    };

    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    window.speechSynthesis.speak(utterance);
  });

  useEffect(() => {
    if (!selectedVoice && window.speechSynthesis) return undefined;

    let cancelled = false;

    const presentPrompt = async () => {
      setQuestionActive(false);
      stopListening(false);

      if (isIntroPhase) {
        await speakText(`Hi ${userName}, it is great to meet you today. I hope you are feeling confident and ready.`);
        if (cancelled) return;
        await speakText("I will ask you a few questions. Answer naturally, and take your time. Let us begin.");
        if (!cancelled) setIsIntroPhase(false);
        return;
      }

      if (!currentQuestion) return;

      if (currentIndex === questions.length - 1) {
        await speakText("Alright, this one might be a little more challenging.");
        if (cancelled) return;
      }

      await speakText(currentQuestion.question);
      if (cancelled) return;

      setSubtitle("");
      setTimeLeft(currentQuestion.timeLimit || 60);
      setQuestionActive(true);
      if (micEnabledRef.current) startListening();
    };

    presentPrompt();

    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
    };
    // speakText coordinates browser speech and microphone refs; adding it here would replay a prompt after every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentQuestion, isIntroPhase, questions.length, selectedVoice, userName]);

  useEffect(() => {
    if (!questionActive || !currentQuestion) return undefined;

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentQuestion, questionActive]);

  const submitAnswer = async () => {
    if (isSubmitting || !currentQuestion) return;

    const submittedAnswer = `${answerRef.current} ${liveTranscriptRef.current}`.replace(/\s+/g, " ").trim();
    answerRef.current = submittedAnswer;
    setAnswer(submittedAnswer);

    setQuestionActive(false);
    stopListening(false);
    setIsSubmitting(true);

    try {
      const result = await axios.post(`${ServerUrl}/api/interview/submit-answer`, {
        interviewId,
        questionIndex: currentIndex,
        answer: submittedAnswer,
        code,
        codeLanguage,
        codeVersion,
        scribbleImage,
        timeTaken: currentQuestion.timeLimit - timeLeft,
      }, { withCredentials: true });

      setFeedback(result.data);
      setSubtitle("Your detailed AI evaluation is ready below.");
      speakText("Your detailed AI evaluation is ready. Please review it on screen.");
    } catch (requestError) {
      setSpeechError(requestError.response?.data?.message || "Your answer could not be evaluated. Please try again.");
      setQuestionActive(true);
      if (micEnabledRef.current) startListening();
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestHint = async () => {
    if (isLoadingHint || isSubmitting || !currentQuestion || hints.length >= 3) return;

    setQuestionActive(false);
    stopListening(false);
    setIsLoadingHint(true);
    setHintError("");

    try {
      const result = await axios.post(`${ServerUrl}/api/interview/hint`, {
        interviewId,
        questionIndex: currentIndex,
      }, { withCredentials: true });
      const revealedHints = Array.isArray(result.data?.hints) ? result.data.hints : [];
      const newestHint = revealedHints[revealedHints.length - 1];

      setHints(revealedHints);
      setSubtitle(`AI hint ${result.data.hintNumber} of ${result.data.totalHints} is ready.`);
      if (newestHint) await speakText(newestHint);
    } catch (requestError) {
      setHintError(requestError.response?.data?.message || "The AI hint could not be prepared. Please try again.");
    } finally {
      setIsLoadingHint(false);
      if (!feedback) {
        setQuestionActive(true);
        if (micEnabledRef.current) startListening();
      }
    }
  };

  useEffect(() => {
    if (questionActive && timeLeft === 0 && !feedback && !isSubmitting) {
      const submissionTimer = window.setTimeout(submitAnswer, 0);
      return () => window.clearTimeout(submissionTimer);
    }
    return undefined;
    // submitAnswer is intentionally triggered only once when the timer reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, isSubmitting, questionActive, timeLeft]);

  const toggleMic = () => {
    if (isMicOn) {
      micEnabledRef.current = false;
      setIsMicOn(false);
      stopListening(false);
      return;
    }

    micEnabledRef.current = true;
    setIsMicOn(true);
    if (questionActive && !isAIPlaying) startListening();
  };

  const handleNext = () => {
    setAnswer("");
    answerRef.current = "";
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    setFeedback(null);
    setSpeechError("");
    setSubtitle("");
    setCode("");
    setScribbleImage("");
    setHints([]);
    setHintError("");

    if (currentIndex + 1 >= questions.length) {
      finishInterview();
      return;
    }
    const nextQuestion = questions[currentIndex + 1];
    const nextLanguage = defaultLanguageForTopic(nextQuestion.topic);
    setCode(nextQuestion.requiresCode ? nextQuestion.starterCode || "" : "");
    setCodeLanguage(nextLanguage);
    setCodeVersion(codingLanguages.find((item) => item.id === nextLanguage)?.versions[0] || "Structured");
    setHints(Array.isArray(nextQuestion.hints) ? nextQuestion.hints : []);
    setCurrentIndex((previous) => previous + 1);
  };

  const finishInterview = async () => {
    stopListening(false);
    setIsMicOn(false);

    try {
      const result = await axios.post(`${ServerUrl}/api/interview/finish`, { interviewId }, { withCredentials: true });
      onFinish(result.data);
    } catch (requestError) {
      setSpeechError(requestError.response?.data?.message || "The interview could not be completed. Please try again.");
    }
  };

  useEffect(() => () => {
    shouldListenRef.current = false;
    window.clearTimeout(restartTimerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 p-4 sm:p-6">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-350 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl lg:flex-row">
        <aside className="w-full border-b border-gray-200 bg-white p-5 lg:w-[35%] lg:border-r lg:border-b-0 lg:p-6">
          <div className="mx-auto max-w-md overflow-hidden rounded-2xl shadow-xl">
            <video ref={videoRef} src={videoSource} muted playsInline preload="auto" className="w-full object-cover" />
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-md">
            <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Interview status</span>{isAIPlaying && <span className="text-sm font-semibold text-emerald-600">Interviewer speaking</span>}</div>
            <div className="my-4 h-px bg-gray-200" />
            <div className="flex justify-center"><Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit || 60} /></div>
            <div className="my-4 h-px bg-gray-200" />
            <div className="grid grid-cols-2 gap-6 text-center"><div><span className="block text-2xl font-bold text-emerald-600">{Math.min(currentIndex + 1, questions.length)}</span><span className="text-xs text-gray-400">Current question</span></div><div><span className="block text-2xl font-bold text-emerald-600">{questions.length}</span><span className="text-xs text-gray-400">Total questions</span></div></div>
          </div>
          {!isIntroPhase && <ProctoringPanel interviewId={interviewId} questionIndex={currentIndex} active={!isSubmitting} />}
        </aside>

        <main className="flex flex-1 flex-col p-5 sm:p-8">
          <p className="text-xl font-bold text-emerald-600 sm:text-2xl">AI Smart Interview</p>
          <p className="mt-1 text-sm text-gray-500">Speak naturally. Your final spoken words appear below and are sent to the AI evaluator.</p>

          {!isIntroPhase && currentQuestion && <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm"><div className="mb-2 flex flex-wrap items-center gap-2"><p className="text-xs text-gray-400">Question {currentIndex + 1} of {questions.length}</p>{currentQuestion.topic && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{currentQuestion.topic.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</span>}{currentQuestion.requiresCode && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">Code or pseudocode required</span>}</div><p className="text-base font-semibold leading-relaxed text-gray-800 sm:text-lg">{currentQuestion.question}</p>{currentQuestion.focus && <p className="mt-3 text-xs leading-relaxed text-gray-500">Focus: {currentQuestion.focus}</p>}</div>}

          {!feedback && !isIntroPhase && currentQuestion && <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><FaLightbulb className="text-amber-500" /><p className="font-semibold text-amber-950">Progressive AI hints</p></div><p className="mt-1 text-xs leading-relaxed text-amber-800">Hint 1 gives direction, Hint 2 gives the approach, and Hint 3 reveals a concise model answer. The timer pauses while a hint is prepared.</p></div><span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{hints.length}/3 used</span></div>{hints.length > 0 && <div className="mt-4 space-y-3">{hints.map((hint, index) => <article key={`${currentIndex}-${index}`} className={`rounded-xl border p-3 ${index === 2 ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-white/80"}`}><p className={`text-xs font-bold uppercase tracking-wide ${index === 2 ? "text-rose-700" : "text-amber-700"}`}>{index === 2 ? "Hint 3 · Concise model answer" : `Hint ${index + 1} · ${index === 0 ? "Direction" : "Approach"}`}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{hint}</p></article>)}</div>}{hints.length < 3 && <button type="button" onClick={requestHint} disabled={isLoadingHint || !questionActive} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"><FaLightbulb />{isLoadingHint ? "AI is preparing your hint..." : hints.length === 0 ? "Ask for hint 1 · Direction" : hints.length === 1 ? "Ask for hint 2 · Approach" : "Reveal hint 3 · Model answer"}</button>}{hintError && <p className="mt-3 text-sm text-red-600">{hintError}</p>}</section>}

          {subtitle && <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">{subtitle}</div>}

          <div className="mt-5 flex items-center gap-2 text-sm"><span className={`flex h-2.5 w-2.5 rounded-full ${isListening ? "animate-pulse bg-red-500" : "bg-gray-300"}`} />{isListening ? <span className="font-medium text-emerald-700">Listening — speak your answer now</span> : <span className="text-gray-500">{isMicOn ? "Microphone will listen after the question" : "Microphone is off"}</span>}</div>

          {liveTranscript && <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">Hearing: {liveTranscript}</p>}
          <textarea placeholder="Your final voice transcript appears here. You can also type an answer." value={answer} onChange={(event) => { answerRef.current = event.target.value; setAnswer(event.target.value); }} className="mt-3 min-h-46 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 p-5 text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

          {!feedback && !isIntroPhase && currentQuestion?.requiresCode && <CodeEditor code={code} onCodeChange={setCode} language={codeLanguage} onLanguageChange={setCodeLanguage} version={codeVersion} onVersionChange={setCodeVersion} />}
          {!feedback && !isIntroPhase && <ScribblePad onChange={setScribbleImage} />}

          {speechError && <p className="mt-3 text-sm text-red-600">{speechError}</p>}

          {!feedback ? <div className="mt-5 flex items-center gap-4"><MotionButton onClick={toggleMic} whileTap={{ scale: 0.92 }} disabled={isSubmitting} className={`flex h-13 w-13 items-center justify-center rounded-full text-white shadow-lg transition ${isListening ? "bg-red-500" : "bg-black"}`} title={isMicOn ? "Turn microphone off" : "Turn microphone on"}>{isMicOn ? <FaMicrophone size={20} /> : <FaMicrophoneSlash size={20} />}</MotionButton><MotionButton onClick={submitAnswer} disabled={isSubmitting || isIntroPhase || !questionActive} whileTap={{ scale: 0.97 }} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-500 py-4 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500">{isSubmitting ? "AI is evaluating..." : <><FaRegKeyboard /> Submit answer for AI feedback</>}</MotionButton></div> : <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Your submitted answer</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${feedback.evaluationSource === "ai" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{feedback.evaluationSource === "ai" ? `AI score: ${feedback.score}/10` : "Basic fallback feedback"}</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{answer || "No spoken or typed explanation was captured."}</p>{currentQuestion?.requiresCode && code && <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100"><code>{code}</code></pre>}<div className="my-4 border-t border-emerald-200" /><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Detailed AI feedback</p><p className="mt-2 text-sm leading-relaxed text-emerald-950">{feedback.feedback}</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-white/80 p-3"><p className="text-xs font-semibold text-emerald-700">What you did well</p><ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-700">{(feedback.strengths || []).map((strength, index) => <li key={index}>{strength}</li>)}</ul></div><div className="rounded-xl bg-white/80 p-3"><p className="text-xs font-semibold text-amber-700">How to improve</p><ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-700">{(feedback.improvements || []).map((improvement, index) => <li key={index}>{improvement}</li>)}</ul></div></div><button onClick={handleNext} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-500 py-3 font-semibold text-white shadow-md transition hover:opacity-90">{currentIndex + 1 === questions.length ? "Finish interview" : "Next question"}<BsArrowRight size={18} /></button></div>}
        </main>
      </div>
    </div>
  );
}

export default Step2Interview;
