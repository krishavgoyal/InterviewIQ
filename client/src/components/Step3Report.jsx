import { useMemo } from "react";
import { FaArrowLeft, FaDownload, FaExternalLinkAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const MotionDiv = motion.div;
const topicLabels = { dsa: "DSA & Coding", oops: "OOP / Design", dbms: "DBMS / SQL", operatingSystems: "Operating Systems", computerArchitecture: "Computer Architecture", resume: "Resume & Projects", generic: "Technical Reasoning", behavioral: "Behavioral Interview", situational: "Situational Judgement", motivation: "Career Motivation" };

const clientFallbackReport = (questions, score) => {
  const grouped = questions.reduce((groups, question) => {
    const topic = question.topic || "generic";
    groups[topic] ||= [];
    groups[topic].push(question);
    return groups;
  }, {});
  const analysis = Object.entries(grouped).map(([topic, entries]) => ({ topic, label: topicLabels[topic] || topic, score: Number((entries.reduce((sum, entry) => sum + (entry.score || 0), 0) / entries.length).toFixed(1)) })).sort((a, b) => a.score - b.score);
  return {
    executiveSummary: score >= 7 ? "You have a useful interview foundation. Refine your weaker topics with deliberate practice and explain your reasoning more explicitly." : "Use the question feedback below to focus your next study session. Prioritise the lowest-scoring concepts, then retake a targeted interview.",
    readiness: score >= 7 ? "Developing interview-ready" : "Needs focused practice",
    improvementAreas: analysis.slice(0, 3).map((item, index) => ({ ...item, priority: index === 0 ? "high" : "medium", diagnosis: "Review the feedback from this topic and practise explaining the solution step by step.", actions: ["Study the core concept for 30 minutes.", "Solve one timed practice problem and explain the trade-offs aloud."] })),
    practicePlan: analysis.slice(0, 3).map((item, index) => ({ day: `Practice block ${index + 1}`, task: `Work on ${item.label}, then retry a focused question under a time limit.` })),
    interviewAdvice: "State your approach first, explain key decisions and edge cases, then finish with a concise conclusion.",
    resources: [],
  };
};

const addPdfHeader = (doc, title, subtitle) => {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(5, 150, 105); doc.rect(0, 0, width, 28, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(title, 18, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(subtitle, 18, 20); doc.setTextColor(31, 41, 55);
  return 40;
};

const writePdfSection = (doc, title, text, y) => {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const lines = doc.splitTextToSize(String(text || ""), width - 36);
  const required = 13 + lines.length * 5;
  if (y + required > height - 22) { doc.addPage(); y = addPdfHeader(doc, "InterviewIQ Coaching Report", "Personalised practice guidance"); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(5, 120, 85); doc.text(title, 18, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(31, 41, 55); doc.text(lines, 18, y + 7);
  return y + required + 4;
};

function Step3Report({ report }) {
  const navigate = useNavigate();
  const { finalScore = 0, confidence = 0, communication = 0, correctness = 0, questionWiseScore = [] } = report || {};
  const score = Number(finalScore || 0);
  const coaching = report?.coachingReport || clientFallbackReport(questionWiseScore, score);
  const questions = useMemo(() => questionWiseScore.map((question, index) => ({ ...question, index: index + 1, topicLabel: topicLabels[question.topic] || question.topic || "General interview skill" })), [questionWiseScore]);
  const skillCards = [{ label: "Confidence", value: confidence }, { label: "Communication", value: communication }, { label: "Correctness", value: correctness }];

  if (!report) return <div className="flex min-h-screen items-center justify-center"><p className="text-lg text-gray-500">Loading your interview report...</p></div>;

  const downloadPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF("p", "mm", "a4");
    const width = doc.internal.pageSize.getWidth();
    let y = addPdfHeader(doc, "InterviewIQ Performance Report", "Evidence-based feedback and improvement plan");
    doc.setFillColor(236, 253, 245); doc.roundedRect(18, y, width - 36, 27, 4, 4, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(6, 95, 70); doc.text(`Overall score: ${score}/10`, 24, y + 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(31, 41, 55); doc.text(`Readiness: ${coaching.readiness || "Practice recommended"}`, 24, y + 20);
    y += 38;
    autoTable(doc, { startY: y, margin: { left: 18, right: 18 }, head: [["Confidence", "Communication", "Correctness"]], body: [[`${Number(confidence).toFixed(1)}/10`, `${Number(communication).toFixed(1)}/10`, `${Number(correctness).toFixed(1)}/10`]], theme: "grid", styles: { fontSize: 10, halign: "center", cellPadding: 4 }, headStyles: { fillColor: [5, 150, 105] } });
    y = doc.lastAutoTable.finalY + 12;
    writePdfSection(doc, "Executive summary", coaching.executiveSummary, y);

    doc.addPage();
    y = addPdfHeader(doc, "Question-by-question feedback", "Your submitted solution and AI feedback for every question");
    autoTable(doc, { startY: y, margin: { left: 12, right: 12 }, head: [["#", "Topic", "Question and solution", "Score", "Feedback and next step"]], body: questions.map((q) => [q.index, q.topicLabel, `${q.question}\n\nSolution: ${q.answer || q.code || "No response submitted."}`, `${q.score || 0}/10`, `${q.feedback || "No feedback available."}\n\nStrengths: ${(q.strengths || []).join("; ") || "Not recorded."}\nImprove: ${(q.improvements || []).join("; ") || "Not recorded."}`]), theme: "striped", styles: { fontSize: 7.6, cellPadding: 2.5, valign: "top", overflow: "linebreak" }, headStyles: { fillColor: [5, 150, 105], fontSize: 8, halign: "center" }, columnStyles: { 0: { cellWidth: 7, halign: "center" }, 1: { cellWidth: 24 }, 2: { cellWidth: 65 }, 3: { cellWidth: 13, halign: "center" }, 4: { cellWidth: "auto" } } });

    doc.addPage();
    y = addPdfHeader(doc, "Concept analysis and action plan", "Prioritised topics to improve before your next interview");
    (coaching.improvementAreas || []).forEach((area, index) => { y = writePdfSection(doc, `${index + 1}. ${area.label || topicLabels[area.topic] || area.topic} - ${String(area.priority || "medium").toUpperCase()} priority`, `${area.diagnosis || "Review this topic."}\n${(area.actions || []).map((action) => `- ${action}`).join("\n")}`, y); });
    y = writePdfSection(doc, "Interview advice", coaching.interviewAdvice, y);
    y = writePdfSection(doc, "Practice plan", (coaching.practicePlan || []).map((item) => `${item.day}: ${item.task}`).join("\n"), y);
    if ((coaching.resources || []).length) {
      if (y > 220) { doc.addPage(); y = addPdfHeader(doc, "Recommended free learning", "Free YouTube lectures selected for your weaker concepts"); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(5, 120, 85); doc.text("Recommended free YouTube lectures", 18, y); y += 8;
      coaching.resources.forEach((resource) => { if (y > 275) { doc.addPage(); y = addPdfHeader(doc, "Recommended free learning", "Continue your practice plan"); } doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(31, 41, 55); doc.text(resource.title, 18, y); doc.setFont("helvetica", "normal"); doc.setTextColor(37, 99, 235); doc.textWithLink("Open free lecture", 18, y + 6, { url: resource.url }); y += 15; });
    }
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) { doc.setPage(page); doc.setDrawColor(209, 213, 219); doc.line(18, 287, width - 18, 287); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(107, 114, 128); doc.text("InterviewIQ - personalised AI interview coaching", 18, 292); doc.text(`Page ${page} of ${pages}`, width - 18, 292, { align: "right" }); }
    doc.save("InterviewIQ_Detailed_Coaching_Report.pdf");
  };

  return <div className="min-h-screen bg-linear-to-br from-gray-50 to-emerald-50 px-4 py-8 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-start gap-4"><button onClick={() => navigate("/history")} className="mt-1 rounded-full bg-white p-3 shadow transition hover:shadow-md"><FaArrowLeft className="text-gray-600" /></button><div><h1 className="text-3xl font-bold text-gray-800">Your detailed interview report</h1><p className="mt-2 text-gray-500">Question feedback first, then a focused learning plan.</p></div></div><button onClick={downloadPDF} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-700"><FaDownload /> Download detailed PDF</button></div>
    <div className="grid gap-6 lg:grid-cols-3"><MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl bg-white p-7 text-center shadow-lg"><p className="text-sm text-gray-500">Overall performance</p><div className="mx-auto mt-5 h-28 w-28"><CircularProgressbar value={Math.max(0, Math.min(100, score * 10))} text={`${score}/10`} styles={buildStyles({ textSize: "17px", pathColor: "#10b981", textColor: "#065f46", trailColor: "#e5e7eb" })} /></div><p className="mt-4 font-semibold text-gray-800">{score >= 8 ? "Strong interview performance" : score >= 5 ? "Developing interview performance" : "Focused practice recommended"}</p><p className="mt-1 text-sm text-gray-500">{coaching.readiness}</p></MotionDiv><MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl bg-white p-7 shadow-lg lg:col-span-2"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">AI coaching summary</p><p className="mt-3 leading-relaxed text-gray-700">{coaching.executiveSummary}</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{skillCards.map((skill) => <div key={skill.label} className="rounded-xl bg-gray-50 p-3"><div className="flex justify-between text-sm"><span>{skill.label}</span><span className="font-bold text-emerald-700">{Number(skill.value).toFixed(1)}</span></div><div className="mt-2 h-2 rounded-full bg-gray-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, skill.value * 10))}%` }} /></div></div>)}</div></MotionDiv></div>
    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 rounded-3xl bg-white p-6 shadow-lg"><h2 className="text-lg font-semibold text-gray-800">Performance across questions</h2><div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={questions.map((q) => ({ name: `Q${q.index}`, score: q.score || 0 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 10]} /><Tooltip /><Area type="monotone" dataKey="score" stroke="#059669" fill="#bbf7d0" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></MotionDiv>
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-lg"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Part 1</p><h2 className="mt-1 text-xl font-bold text-gray-800">Question-by-question feedback</h2><p className="mt-1 text-sm text-gray-500">Review your submitted solution, score, strengths, and next improvements before the overall diagnosis.</p><div className="mt-6 space-y-5">{questions.map((q) => <article key={q.index} className="rounded-2xl border border-gray-200 bg-gray-50 p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-gray-400">Question {q.index}</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{q.topicLabel}</span></div><p className="mt-2 font-semibold leading-relaxed text-gray-800">{q.question}</p></div><span className="h-fit rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">{q.score || 0}/10</span></div><div className="mt-4 rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your submitted solution</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{q.answer || "No spoken or typed answer captured."}</p>{q.code && <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100"><code>{q.code}</code></pre>}</div><div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Basic AI feedback</p><p className="mt-2 text-sm leading-relaxed text-gray-700">{q.feedback || "No feedback available."}</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-800">What worked</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">{(q.strengths || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-800">Improve next</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">{(q.improvements || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div></div></article>)}</div></section>
    <section className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-3xl bg-white p-6 shadow-lg"><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Part 2</p><h2 className="mt-1 text-xl font-bold text-gray-800">Priority concepts to improve</h2><div className="mt-5 space-y-4">{(coaching.improvementAreas || []).map((area, index) => <div key={`${area.topic}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-gray-800">{area.label || topicLabels[area.topic] || area.topic}</p><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase text-amber-700">{area.priority || "medium"}</span></div><p className="mt-2 text-sm leading-relaxed text-gray-700">{area.diagnosis}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">{(area.actions || []).map((action, actionIndex) => <li key={actionIndex}>{action}</li>)}</ul></div>)}</div></div><div className="rounded-3xl bg-white p-6 shadow-lg"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Your plan</p><h2 className="mt-1 text-xl font-bold text-gray-800">Practice and retake strategy</h2><p className="mt-3 text-sm leading-relaxed text-gray-700">{coaching.interviewAdvice}</p><ol className="mt-5 space-y-3">{(coaching.practicePlan || []).map((item, index) => <li key={index} className="rounded-xl bg-gray-50 p-3"><p className="text-sm font-semibold text-emerald-700">{item.day}</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{item.task}</p></li>)}</ol></div></section>
    {(coaching.resources || []).length > 0 && <section className="mt-6 rounded-3xl bg-slate-900 p-6 text-white shadow-lg"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Free learning resources</p><h2 className="mt-1 text-xl font-bold">Recommended YouTube lectures for your weaker topics</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{coaching.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="group rounded-xl border border-slate-700 bg-slate-800 p-4 transition hover:border-emerald-400 hover:bg-slate-700"><p className="font-semibold text-white">{resource.title}</p><p className="mt-2 flex items-center gap-2 text-sm text-emerald-300">Open free lecture <FaExternalLinkAlt size={12} /></p></a>)}</div></section>}
  </div></div>;
}

export default Step3Report;
