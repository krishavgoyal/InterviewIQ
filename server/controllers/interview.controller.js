import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

const knownSkills = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Express",
  "MongoDB",
  "Mongoose",
  "HTML",
  "CSS",
  "Tailwind",
  "Bootstrap",
  "Redux",
  "Next.js",
  "Python",
  "Java",
  "C++",
  "SQL",
  "Firebase",
  "Git",
  "GitHub",
  "REST API",
  "Machine Learning",
  "Data Structures",
  "Algorithms",
];

const technicalTopics = {
  dsa: "Data Structures and Algorithms (DSA)",
  oops: "Object-Oriented Programming (OOP)",
  dbms: "Database Management Systems (DBMS)",
  operatingSystems: "Operating Systems",
  computerArchitecture: "Computer Architecture",
  resume: "Resume and project experience",
  generic: "General technical problem solving",
};

const hrTopics = {
  resume: "Resume and project experience",
  behavioral: "Behavioral interview skills",
  situational: "Situational judgement",
  motivation: "Role motivation and career direction",
  generic: "General professional communication",
};

const questionTopicLabels = { ...technicalTopics, ...hrTopics };
const codeCapableTopics = new Set(["dsa", "oops", "dbms"]);

const learningResources = {
  dsa: { title: "DSA and coding interview practice - Take U Forward", url: "https://www.youtube.com/results?search_query=take+u+forward+striver+a2z+dsa+course" },
  oops: { title: "Object-oriented programming fundamentals - free lectures", url: "https://www.youtube.com/results?search_query=oop+object+oriented+programming+complete+course+free" },
  dbms: { title: "DBMS and SQL interview preparation - Gate Smashers", url: "https://www.youtube.com/results?search_query=gate+smashers+dbms+sql+playlist" },
  operatingSystems: { title: "Operating systems fundamentals - Gate Smashers", url: "https://www.youtube.com/results?search_query=gate+smashers+operating+system+playlist" },
  computerArchitecture: { title: "Computer architecture fundamentals - free lectures", url: "https://www.youtube.com/results?search_query=computer+organization+architecture+complete+course+free" },
  resume: { title: "Explaining projects clearly in interviews", url: "https://www.youtube.com/results?search_query=how+to+explain+projects+in+technical+interview" },
  generic: { title: "Technical interview problem-solving practice", url: "https://www.youtube.com/results?search_query=technical+interview+problem+solving+practice+free" },
  behavioral: { title: "Behavioral interview answers using STAR", url: "https://www.youtube.com/results?search_query=star+method+behavioral+interview+questions+free" },
  situational: { title: "Situational interview question practice", url: "https://www.youtube.com/results?search_query=situational+interview+questions+and+answers+free" },
  motivation: { title: "Interview communication and career answers", url: "https://www.youtube.com/results?search_query=how+to+answer+why+do+you+want+this+job+interview" },
};

const buildTimeLimits = (questionCount, durationMinutes) => {
  const targetSeconds = Math.max(questionCount * 45, Math.min(durationMinutes * 60, questionCount * 300));
  const weights = Array.from({ length: questionCount }, (_, index) => 0.85 + (index / Math.max(questionCount - 1, 1)) * 0.3);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => Math.round((targetSeconds * weight) / weightTotal / 5) * 5);
};

const sanitizeInterviewBlueprint = (mode, questionCount, durationMinutes, topicAllocation) => {
  const count = Number(questionCount);
  const duration = Number(durationMinutes);
  if (!Number.isInteger(count) || count < 3 || count > 15) {
    throw new Error("Choose between 3 and 15 questions.");
  }
  if (!Number.isInteger(duration) || duration < count || duration > 60) {
    throw new Error(`Choose an interview duration between ${count} and 60 minutes for ${count} questions.`);
  }

  const allowedTopics = mode === "Technical" ? technicalTopics : hrTopics;
  const entries = Object.entries(topicAllocation || {})
    .filter(([topic]) => Object.hasOwn(allowedTopics, topic))
    .map(([topic, amount]) => [topic, Number(amount)])
    .filter(([, amount]) => Number.isInteger(amount) && amount > 0);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  if (total !== count) {
    throw new Error(`Your topic allocation must total exactly ${count} questions.`);
  }

  return {
    questionCount: count,
    durationMinutes: duration,
    topicAllocation: Object.fromEntries(entries),
    timeLimits: buildTimeLimits(count, duration),
  };
};

const inferResumeData = (resumeText) => {
  const text = resumeText || "";
  const lowerText = text.toLowerCase();

  const roleKeywords = [
    "frontend developer",
    "front end developer",
    "full stack developer",
    "backend developer",
    "software developer",
    "software engineer",
    "web developer",
    "mern developer",
    "data analyst",
    "machine learning engineer",
  ];

  const matchedRole = roleKeywords.find((role) => lowerText.includes(role));

  const experienceMatch =
    text.match(/(\d+(?:\.\d+)?)\+?\s*(years?|yrs?)\s+(?:of\s+)?experience/i) ||
    text.match(/experience\s*[:|-]?\s*(\d+(?:\.\d+)?)\+?\s*(years?|yrs?)/i);

  const skills = knownSkills.filter((skill) =>
    lowerText.includes(skill.toLowerCase())
  );

  const projects = [];
  const projectSection = text.match(
    /projects?(.{0,900})(?:skills?|education|experience|certifications?|achievements?|$)/i
  );

  if (projectSection) {
    const projectLines = projectSection[1]
      .split(/[\n•|]/)
      .map((line) => line.replace(/[-–]/g, " ").replace(/\s+/g, " ").trim())
      .filter((line) => line.length >= 8 && line.length <= 90)
      .slice(0, 4);

    projects.push(...projectLines);
  }

  return {
    role: matchedRole
      ? matchedRole.replace(/\b\w/g, (letter) => letter.toUpperCase())
      : skills.some((skill) => ["React", "HTML", "CSS", "Tailwind"].includes(skill))
        ? "Frontend Developer"
        : "Software Developer",
    experience: experienceMatch ? `${experienceMatch[1]} ${experienceMatch[2]}` : "Fresher",
    projects: [...new Set(projects)],
    skills: [...new Set(skills)],
  };
};

const extractPdfText = async (filepath) => {
  const fileBuffer = await fs.promises.readFile(filepath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) }).promise;
  let documentText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    documentText += `${content.items.map((item) => item.str).join(" ")}\n`;
  }

  return documentText.replace(/\s+/g, " ").trim();
};

const documentKeywords = (text) => {
  const ignored = new Set([
    "about", "after", "again", "also", "and", "are", "been", "being", "between", "can", "candidate",
    "company", "could", "document", "for", "from", "have", "into", "interview", "job", "not", "role",
    "that", "the", "their", "they", "this", "through", "with", "will", "would", "your",
  ]);

  return [...new Set(
    String(text || "").toLowerCase().match(/[a-z][a-z+#.-]{2,}/g)?.filter((word) => !ignored.has(word)) || []
  )];
};

// A lightweight retrieval layer: only the most relevant document passages are sent to the model.
const retrieveDocumentContext = (text, query, limit = 4) => {
  if (!text) return [];

  const queryWords = new Set(documentKeywords(query));
  const chunks = String(text)
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.reduce((groups, sentence) => {
      const current = groups[groups.length - 1] || "";
      if ((current + sentence).length > 520) groups.push(sentence.trim());
      else if (groups.length) groups[groups.length - 1] = `${current} ${sentence}`.trim();
      else groups.push(sentence.trim());
      return groups;
    }, []) || [String(text)];

  return chunks
    .map((chunk) => ({
      chunk: chunk.slice(0, 650),
      score: documentKeywords(chunk).reduce((total, word) => total + (queryWords.has(word) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || b.chunk.length - a.chunk.length)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
};

const fallbackJobDescriptionData = (jobDescriptionText) => {
  const keywords = documentKeywords(jobDescriptionText).slice(0, 8);
  return {
    targetRole: "Role described in the job description",
    responsibilities: keywords.slice(0, 4),
    requiredSkills: keywords.slice(4, 8),
    interviewFocus: "Assess the candidate against the documented responsibilities and requirements.",
  };
};

const normalizeQuestionPlan = (questionPlan, blueprint) => {
  const questions = Array.isArray(questionPlan?.questions) ? questionPlan.questions : [];
  const cleanQuestions = questions
    .map((item) => ({
      question: String(item?.question || item || "").replace(/^\s*\d+[).:-]?\s*/, "").trim(),
      focus: String(item?.focus || "Interview competency").trim(),
      topic: String(item?.topic || "").trim(),
      requiresCode: item?.requiresCode === true || (item?.topic === "dsa" && item?.requiresCode !== false),
      codingInstructions: String(item?.codingInstructions || "").trim().slice(0, 1200),
      starterCode: String(item?.starterCode || "").slice(0, 4000),
    }))
    .filter((item) => item.question.length >= 12 && item.question.length <= 330)
    .slice(0, blueprint.questionCount);

  if (cleanQuestions.length !== blueprint.questionCount) {
    throw new Error(`AI did not return ${blueprint.questionCount} usable interview questions`);
  }

  const topicCounts = cleanQuestions.reduce((counts, item) => {
    if (!Object.hasOwn(blueprint.topicAllocation, item.topic)) {
      throw new Error("AI returned a question outside the selected topic allocation");
    }
    counts[item.topic] = (counts[item.topic] || 0) + 1;
    return counts;
  }, {});

  for (const [topic, expectedCount] of Object.entries(blueprint.topicAllocation)) {
    if (topicCounts[topic] !== expectedCount) {
      throw new Error(`AI did not follow the requested ${questionTopicLabels[topic]} allocation`);
    }
  }

  cleanQuestions.forEach((item) => {
    if (!codeCapableTopics.has(item.topic)) {
      item.requiresCode = false;
      item.codingInstructions = "";
      item.starterCode = "";
    }
  });

  return cleanQuestions;
};

const parseAiJson = (responseText) => {
  const text = String(responseText || "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not include a JSON object");
  }

  return JSON.parse(text.slice(start, end + 1));
};

const scoreInRange = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(10, Math.round(number * 10) / 10)) : 0;
};

const textList = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  const entries = value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3);
  return entries.length ? entries : fallback;
};

const fallbackEvaluation = (answer) => {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const hasExample = /\b(example|for instance|for example|project|because|result|impact)\b/i.test(answer);
  const hasStructure = /\b(first|then|finally|situation|task|action|result)\b/i.test(answer);
  const confidence = Math.max(2, Math.min(7, Math.round(wordCount / 18) + (hasExample ? 1 : 0)));
  const communication = Math.max(2, Math.min(8, confidence + (hasStructure ? 1 : 0)));
  const correctness = Math.max(2, Math.min(7, confidence - (wordCount < 20 ? 1 : 0)));

  return {
    confidence,
    communication,
    correctness,
    finalScore: Number(((confidence + communication + correctness) / 3).toFixed(1)),
    feedback: wordCount < 20
      ? "Your answer is too brief to demonstrate your reasoning or technical understanding. State your main point, explain why it is correct, and add one concrete example from your work or a realistic scenario."
      : "Your response communicates a useful starting point, but it needs a clearer explanation of your reasoning and a concrete outcome. Organize the answer around the situation, your action, and the result so an interviewer can assess both your judgement and impact.",
    strengths: hasExample
      ? ["You connected your answer to an example or practical context.", "You provided enough detail to establish a useful starting point."]
      : ["You addressed the question instead of leaving it unanswered.", "Your response contains a foundation that can be developed further."],
    improvements: [
      "Explain the reasoning behind your answer, not only the conclusion.",
      hasExample ? "State the measurable result or lesson from your example." : "Add one specific project, situation, or technical example.",
      "End with a concise takeaway that directly answers the question."
    ],
    evaluationSource: "fallback",
  };
};

const normalizeEvaluation = (evaluation) => {
  const confidence = scoreInRange(evaluation.confidence);
  const communication = scoreInRange(evaluation.communication);
  const correctness = scoreInRange(evaluation.correctness);
  const feedback = String(evaluation.feedback || "").trim();

  if (feedback.length < 40) {
    throw new Error("AI evaluation was not detailed enough");
  }

  return {
    confidence,
    communication,
    correctness,
    finalScore: Number(((confidence + communication + correctness) / 3).toFixed(1)),
    feedback,
    strengths: textList(evaluation.strengths, ["The answer addressed the question directly."]),
    improvements: textList(evaluation.improvements, ["Add more detail about your reasoning and outcome."]),
    evaluationSource: "ai",
  };
};

const normalizeProgressiveHints = (result) => {
  const hints = Array.isArray(result?.hints)
    ? result.hints
      .map((hint) => String(hint || "").trim().replace(/^hint\s*\d+\s*[:.-]?\s*/i, ""))
      .filter((hint) => hint.length >= 18 && hint.length <= 1500)
      .slice(0, 3)
    : [];

  if (hints.length !== 3) {
    throw new Error("AI did not return three usable progressive hints");
  }

  return hints;
};

const proctorSignalMessages = {
  camera_started: { severity: "info", message: "Camera integrity monitoring was started." },
  tab_hidden: { severity: "review", message: "The interview tab was moved to the background. Review if this was unexpected." },
  window_blur: { severity: "review", message: "The interview window lost focus. Review if this was unexpected." },
  focus_mode_exited: { severity: "review", message: "Focus mode was exited during the interview. Review if this was unexpected." },
  camera_stopped: { severity: "review", message: "Camera monitoring stopped before the interview ended. Review if this was unexpected." },
  no_face: { severity: "review", message: "No face was visible in the camera frame." },
  multiple_people: { severity: "review", message: "More than one person was visible in the camera frame." },
  visible_phone: { severity: "review", message: "A phone was visible in the camera frame." },
};

const normalizeProctorObservations = (result) => {
  const allowedTypes = new Set(["no_face", "multiple_people", "visible_phone", "visible_secondary_screen"]);
  const labels = {
    no_face: "No face is clearly visible in the camera frame.",
    multiple_people: "More than one person appears to be visible in the camera frame.",
    visible_phone: "A phone-like device appears to be visible in the camera frame.",
    visible_secondary_screen: "A secondary screen or display appears to be visible in the camera frame.",
  };

  if (!Array.isArray(result?.observations)) return [];

  return result.observations
    .filter((item) => allowedTypes.has(item?.type) && Number(item?.confidence) >= 0.65)
    .slice(0, 3)
    .map((item) => ({
      eventType: item.type,
      severity: "review",
      source: "ai",
      message: String(item?.message || labels[item.type]).trim().slice(0, 240) || labels[item.type],
    }));
};

const appendProctorFlag = (interview, flag) => {
  const existingFlags = Array.isArray(interview.proctoring?.flags) ? interview.proctoring.flags : [];
  interview.proctoring = interview.proctoring || {};
  interview.proctoring.flags = [...existingFlags, { ...flag, createdAt: new Date() }].slice(-100);
};

const buildTopicAnalysis = (questions) => {
  const grouped = questions.reduce((groups, question) => {
    const topic = question.topic || "generic";
    if (!groups[topic]) groups[topic] = [];
    groups[topic].push(question);
    return groups;
  }, {});

  return Object.entries(grouped).map(([topic, topicQuestions]) => ({
    topic,
    label: questionTopicLabels[topic] || topic,
    averageScore: Number((topicQuestions.reduce((sum, question) => sum + (question.score || 0), 0) / topicQuestions.length).toFixed(1)),
    questionCount: topicQuestions.length,
    evidence: topicQuestions.map((question) => question.feedback || "No detailed feedback was recorded.").slice(0, 2),
  })).sort((first, second) => first.averageScore - second.averageScore);
};

const buildFallbackCoachingReport = (questions, finalScore) => {
  const topicAnalysis = buildTopicAnalysis(questions);
  const improvementAreas = topicAnalysis.slice(0, 3).map((area, index) => ({
    topic: area.topic,
    label: area.label,
    score: area.averageScore,
    priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    diagnosis: area.averageScore < 5
      ? `Your answers in ${area.label} need stronger accuracy and a more complete explanation.`
      : `You have a foundation in ${area.label}, but need more depth, precision, and practical examples.`,
    actions: [
      `Review the core concepts tested in ${area.label}.`,
      "Practise one timed question, then explain your reasoning aloud before checking the solution.",
    ],
  }));
  const strongestAreas = [...topicAnalysis].sort((first, second) => second.averageScore - first.averageScore).slice(0, 2).map((area) => ({
    topic: area.topic,
    label: area.label,
    score: area.averageScore,
    reason: `This was your strongest assessed area across ${area.questionCount} question${area.questionCount === 1 ? "" : "s"}.`,
  }));
  const resourceTopics = [...new Set(improvementAreas.map((area) => area.topic))];

  return {
    source: "fallback",
    executiveSummary: finalScore >= 7
      ? "You showed a solid interview foundation. Focus next on making your strongest answers more precise and repeatable under time pressure."
      : "This interview identified clear learning priorities. Improve one topic at a time, practise explaining your reasoning, and retake a focused interview to measure progress.",
    readiness: finalScore >= 7 ? "Developing interview-ready" : "Needs focused practice before the next interview",
    strongestAreas,
    improvementAreas,
    practicePlan: improvementAreas.map((area, index) => ({
      day: `Practice block ${index + 1}`,
      task: `Spend 45-60 minutes on ${area.label}: learn one weak concept, solve one question, and explain the solution aloud.`,
    })),
    interviewAdvice: "Use a consistent answer structure: state your approach, justify the key decision, cover edge cases or trade-offs, and end with the result.",
    resources: resourceTopics.map((topic) => ({ topic, ...(learningResources[topic] || learningResources.generic) })),
  };
};

const normalizeCoachingReport = (report, fallback) => ({
  ...fallback,
  source: "ai",
  executiveSummary: String(report.executiveSummary || fallback.executiveSummary).trim(),
  readiness: String(report.readiness || fallback.readiness).trim(),
  strongestAreas: Array.isArray(report.strongestAreas) && report.strongestAreas.length ? report.strongestAreas.slice(0, 3) : fallback.strongestAreas,
  improvementAreas: Array.isArray(report.improvementAreas) && report.improvementAreas.length ? report.improvementAreas.slice(0, 3).map((area, index) => ({
    ...fallback.improvementAreas[index],
    ...area,
    actions: textList(area.actions, fallback.improvementAreas[index]?.actions || []),
  })) : fallback.improvementAreas,
  practicePlan: Array.isArray(report.practicePlan) && report.practicePlan.length ? report.practicePlan.slice(0, 7) : fallback.practicePlan,
  interviewAdvice: String(report.interviewAdvice || fallback.interviewAdvice).trim(),
});

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume required" });
    }
    const filepath = req.file.path;
    const resumeText = await extractPdfText(filepath);

    if (!resumeText) {
      throw new Error("No readable text was found in this resume PDF.");
    }

    const messages = [
      {
        role: "system",
        content: `
Extract structured data from resume.

Return strictly JSON:

{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}
`
      },
      {
        role: "user",
        content: resumeText
      }
    ];


    let parsed = null;

    try {
      const aiResponse = await askAi(messages)
       parsed = parseAiJson(aiResponse);
    } catch (error) {
      parsed = inferResumeData(resumeText);
    }

    fs.unlinkSync(filepath)


    res.json({
      role: parsed.role,
      experience: parsed.experience,
      projects: parsed.projects,
      skills: parsed.skills,
      resumeText
    });

  } catch (error) {
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};

export const analyzeJobDescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Job description PDF required" });
    }

    const filepath = req.file.path;
    const jobDescriptionText = await extractPdfText(filepath);
    if (!jobDescriptionText) {
      throw new Error("No readable text was found in this job description PDF.");
    }

    let analysis;
    try {
      const aiResponse = await askAi([
        {
          role: "system",
          content: `Analyze this job description for a mock interview. Return only valid JSON with this shape:
{
  "targetRole": "string",
  "responsibilities": ["up to 5 concise responsibilities"],
  "requiredSkills": ["up to 8 specific skills"],
  "interviewFocus": "one concise sentence"
}`,
        },
        { role: "user", content: jobDescriptionText.slice(0, 18000) },
      ]);
      analysis = parseAiJson(aiResponse);
    } catch (error) {
      analysis = fallbackJobDescriptionData(jobDescriptionText);
    }

    await fs.promises.unlink(filepath);
    return res.json({
      jobDescriptionText,
      targetRole: String(analysis.targetRole || "").trim(),
      responsibilities: textList(analysis.responsibilities, []),
      requiredSkills: textList(analysis.requiredSkills, []),
      interviewFocus: String(analysis.interviewFocus || "").trim(),
    });
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path);
    return res.status(500).json({ message: error.message });
  }
};


export const generateQuestion = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills, jobDescriptionText, jobDescriptionInsights, questionCount, durationMinutes, topicAllocation } = req.body;
    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();
    const safeResume = resumeText?.trim();
    const safeJobDescription = jobDescriptionText?.trim() || "";

    if (!role || !experience || !mode) {
      return res.status(400).json({ message: "Role, Experience and Mode are required." });
    }
    if (!["Technical", "HR"].includes(mode)) {
      return res.status(400).json({ message: "Choose either a Technical or HR interview." });
    }
    if (!safeResume) {
      return res.status(400).json({ message: "A analyzed resume is required before starting an interview." });
    }

    const blueprint = sanitizeInterviewBlueprint(mode, questionCount, durationMinutes, topicAllocation);
    const topicLabelsForMode = mode === "Technical" ? technicalTopics : hrTopics;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.credits < 50) {
      return res.status(400).json({ message: "Not enough credits. Minimum 50 required." });
    }

    const priorInterviews = await Interview.find({ userId: user._id, role, mode })
      .sort({ createdAt: -1 })
      .limit(12)
      .select("questions.question")
      .lean();
    const previousQuestions = priorInterviews
      .flatMap((item) => item.questions || [])
      .map((item) => item.question)
      .filter(Boolean)
      .slice(0, 60);

    const projectText = Array.isArray(projects) && projects.length ? projects.join(", ") : "No projects extracted";
    const skillsText = Array.isArray(skills) && skills.length ? skills.join(", ") : "No skills extracted";
    const retrievalQuery = `${role} ${mode} ${experience} ${skillsText} ${safeJobDescription.slice(0, 1500)}`;
    const resumeContext = retrieveDocumentContext(safeResume, retrievalQuery).join("\n- ");
    const jobContext = safeJobDescription
      ? retrieveDocumentContext(safeJobDescription, retrievalQuery).join("\n- ")
      : "No job description was provided. Ground questions in the candidate's resume instead.";
    const uniqueBrief = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const messages = [
      {
        role: "system",
        content: `You are a professional interviewer designing a realistic, tailored five-question mock interview.

This is a paid interview. Every interview must be substantively different. Do not reuse, paraphrase closely, or test the same primary competency as any question in the previous-question exclusion list. Use the supplied document passages as evidence; do not invent candidate experience or job requirements.

Return only valid JSON in this exact format:
{
  "questions": [
    {"question": "...", "focus": "specific competency", "topic": "selected-topic-key", "requiresCode": true, "codingInstructions": "what to implement or explain", "starterCode": "optional short starter template"}
  ]
}

Question design requirements:
- Return exactly the requested number of questions, each one sentence, professional and conversational.
- Keep the exact requested count for every topic key. The topic key must be one from the allocation, exactly as written.
- Progress from a targeted warm-up to applied evidence, scenario reasoning, trade-offs, and difficult role-relevant challenges.
- Ask about a concrete résumé project or skill when the documents support it.
- When a job description exists, assess its responsibilities and required skills—not generic interview trivia.
- For DSA, ask a solvable coding/algorithm problem and assess approach, edge cases, complexity, and data-structure choice. For OOP, DBMS, operating systems, and computer architecture, test practical application and trade-offs rather than definitions alone.
- Every DSA question must set requiresCode to true and ask for a genuine implementation or clear pseudocode solution. OOP and DBMS questions may set requiresCode to true when the candidate should implement classes or write a SQL query; set it false for conceptual questions. Only DSA, OOP, and DBMS may require code.
- When requiresCode is true, provide concise codingInstructions and an optional short starterCode. Do not put an answer or solution in starterCode.
- Avoid the generic prompts “tell me about yourself”, “why should we hire you”, and “what are your strengths/weaknesses”.
- Do not mention the documents, RAG, prompt, or question history to the candidate.`,
      },
      {
        role: "user",
        content: `Interview uniqueness token: ${uniqueBrief}
Target role: ${role}
Candidate experience: ${experience}
Interview mode: ${mode}
Requested number of questions: ${blueprint.questionCount}
Approximate interview duration: ${blueprint.durationMinutes} minutes
Required topic allocation (follow exactly): ${JSON.stringify(blueprint.topicAllocation)}
Topic labels: ${JSON.stringify(Object.fromEntries(Object.keys(blueprint.topicAllocation).map((topic) => [topic, topicLabelsForMode[topic]])))}
Extracted projects: ${projectText}
Extracted skills: ${skillsText}
Job-description analysis: ${JSON.stringify(jobDescriptionInsights || {})}

Most relevant resume passages:
- ${resumeContext}

Most relevant job-description passages:
- ${jobContext}

Previous-question exclusion list (do not repeat or closely paraphrase these):
${previousQuestions.length ? previousQuestions.map((question) => `- ${question}`).join("\n") : "- No previous interview questions exist for this role and mode."}`,
      },
    ];

    let questionPlan;
    try {
      questionPlan = normalizeQuestionPlan(parseAiJson(await askAi(messages)), blueprint);
    } catch (error) {
      console.error("AI question generation failed:", error.message);
      return res.status(503).json({ message: "AI question generation is temporarily unavailable. No credits were used; please try again." });
    }

    user.credits -= 50;
    await user.save();

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      jobDescriptionText: safeJobDescription,
      documentInsights: jobDescriptionInsights || {},
      interviewBlueprint: {
        questionCount: blueprint.questionCount,
        durationMinutes: blueprint.durationMinutes,
        topicAllocation: blueprint.topicAllocation,
      },
      questions: questionPlan.map((item, index) => ({
        question: item.question,
        focus: item.focus,
        topic: item.topic,
        requiresCode: item.requiresCode,
        codingInstructions: item.codingInstructions,
        starterCode: item.starterCode,
        difficulty: index < Math.ceil(blueprint.questionCount * 0.3) ? "easy" : index < Math.ceil(blueprint.questionCount * 0.75) ? "medium" : "hard",
        timeLimit: blueprint.timeLimits[index],
      }))
    })

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      questions: interview.questions
    });
  } catch (error) {
    return res.status(500).json({message:`failed to create interview ${error}`})
  }
}


export const getProgressiveHint = async (req, res) => {
  try {
    const { interviewId, questionIndex } = req.body;
    const interview = await Interview.findById(interviewId);

    if (!interview || !interview.questions?.[questionIndex]) {
      return res.status(404).json({ message: "Interview question not found." });
    }
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You cannot request a hint for another user's interview." });
    }
    if (interview.status === "completed") {
      return res.status(409).json({ message: "Hints are available only while an interview is in progress." });
    }

    const question = interview.questions[questionIndex];
    if (question.answer || question.feedback) {
      return res.status(409).json({ message: "Hints must be requested before submitting this answer." });
    }

    let hints = Array.isArray(question.hints) ? question.hints.filter(Boolean) : [];

    if (hints.length !== 3) {
      const resumeContext = retrieveDocumentContext(
        interview.resumeText,
        `${question.question} ${question.focus || ""} ${interview.role}`,
        2,
      ).join("\n- ");
      const jobContext = retrieveDocumentContext(
        interview.jobDescriptionText,
        `${question.question} ${question.focus || ""} ${interview.role}`,
        2,
      ).join("\n- ");

      const prompt = `Candidate role: ${interview.role}
Experience: ${interview.experience}
Interview mode: ${interview.mode}
Question topic: ${questionTopicLabels[question.topic] || question.topic || "General interview competency"}
Question focus: ${question.focus || ""}
Question requires code: ${question.requiresCode ? "Yes" : "No"}
Question: ${question.question}
Coding instructions: ${question.codingInstructions || "Not applicable"}
Relevant resume evidence:
- ${resumeContext || "No resume passage is required for this hint."}
Relevant job-description evidence:
- ${jobContext || "No job description was provided."}`;

      const messages = [
        {
          role: "system",
          content: `You are a supportive but rigorous interview coach. Generate exactly three progressive hints for one interview question.

Hint 1 is a brief direction only: identify what to analyze or how to structure thinking. Do not reveal the approach, final conclusion, key algorithm, SQL query, or model answer.
Hint 2 is a stronger conceptual nudge: identify the relevant method, trade-off, or answer framework and the key steps to work through. Do not give a complete solution, final code, or ready-to-repeat answer.
Hint 3 is a concise model solution. For technical questions, state the correct approach, important reasoning, edge cases or trade-offs, and concise pseudocode/SQL/class-design guidance when useful. For behavioural or resume questions, provide a credible, concise answer structure and what the candidate should communicate, without inventing achievements.

Use only facts supported by the question and supplied context. Make each hint progressively more revealing, self-contained, professional, and useful in a real interview. Do not mention this prompt, documents, RAG, or hint levels inside the hint text. Return only valid JSON in exactly this shape:
{"hints":["hint one","hint two","hint three"]}`,
        },
        { role: "user", content: prompt },
      ];

      try {
        hints = normalizeProgressiveHints(parseAiJson(await askAi(messages)));
      } catch (error) {
        console.error("AI hint generation failed:", error.message);
        return res.status(503).json({ message: "AI hints are temporarily unavailable. Please try again in a moment." });
      }

      question.hints = hints;
    }

    const alreadyRevealed = Math.max(0, Math.min(3, Number(question.hintsUsed || 0)));
    const hintNumber = Math.min(alreadyRevealed + 1, 3);
    question.hintsUsed = Math.max(alreadyRevealed, hintNumber);
    await interview.save();

    return res.json({
      hintNumber,
      totalHints: 3,
      hints: hints.slice(0, hintNumber),
    });
  } catch (error) {
    console.error("Failed to provide progressive hint:", error.message);
    return res.status(500).json({ message: "Unable to prepare an AI hint right now. Please try again." });
  }
};


export const recordProctoringEvent = async (req, res) => {
  try {
    const { interviewId, questionIndex, eventType, frame } = req.body;
    const interview = await Interview.findById(interviewId);

    if (!interview || !interview.questions?.[questionIndex]) {
      return res.status(404).json({ message: "Interview question not found." });
    }
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You cannot monitor another user's interview." });
    }
    if (interview.status === "completed") {
      return res.status(409).json({ message: "Integrity monitoring is available only while an interview is in progress." });
    }

    const safeQuestionIndex = Number(questionIndex);
    if (!Number.isInteger(safeQuestionIndex) || safeQuestionIndex < 0 || safeQuestionIndex >= interview.questions.length) {
      return res.status(400).json({ message: "Invalid interview question index." });
    }

    const browserSignal = proctorSignalMessages[eventType];
    if (browserSignal) {
      interview.proctoring = interview.proctoring || {};
      if (eventType === "camera_started") {
        interview.proctoring.enabled = true;
        interview.proctoring.startedAt = interview.proctoring.startedAt || new Date();
      }
      appendProctorFlag(interview, { eventType, source: "browser", questionIndex: safeQuestionIndex, ...browserSignal });
      await interview.save();
      return res.json({ flags: [browserSignal], reviewCount: interview.proctoring.flags.filter((flag) => flag.severity === "review").length });
    }

    const safeFrame = typeof frame === "string"
      && /^data:image\/(png|jpeg);base64,/i.test(frame)
      && frame.length <= 900_000
      ? frame
      : "";
    if (!safeFrame) {
      return res.status(400).json({ message: "A valid camera frame is required for an AI visual integrity check." });
    }

    const question = interview.questions[safeQuestionIndex];
    const messages = [
      {
        role: "system",
        content: `You are an integrity-review assistant for a voluntary mock interview. Analyze only directly visible scene facts in this single webcam frame. Do not identify the person, estimate age, gender, race, emotion, gaze direction, disability, or intent. Never claim cheating. Only report a concern when it is clearly visible; uncertainty should produce no observation. A normal laptop, headset, glasses, background object, or one candidate alone is not a concern.

Return only valid JSON in exactly this format:
{"observations":[{"type":"no_face|multiple_people|visible_phone|visible_secondary_screen","confidence":0.0,"message":"short neutral observable description"}]}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Current question topic: ${questionTopicLabels[question.topic] || question.topic || "General"}. Inspect this webcam frame for the allowed, clearly observable integrity-review signals only.` },
          { type: "image_url", image_url: { url: safeFrame } },
        ],
      },
    ];

    let flags;
    try {
      flags = normalizeProctorObservations(parseAiJson(await askAi(messages)));
    } catch (error) {
      console.error("AI visual integrity check failed:", error.message);
      return res.status(503).json({ message: "AI visual review is temporarily unavailable. Browser integrity signals remain active." });
    }

    interview.proctoring = interview.proctoring || {};
    interview.proctoring.enabled = true;
    interview.proctoring.startedAt = interview.proctoring.startedAt || new Date();
    flags.forEach((flag) => appendProctorFlag(interview, { ...flag, questionIndex: safeQuestionIndex }));
    await interview.save();

    return res.json({
      flags,
      reviewCount: interview.proctoring.flags.filter((flag) => flag.severity === "review").length,
    });
  } catch (error) {
    console.error("Failed to record proctoring event:", error.message);
    return res.status(500).json({ message: "Unable to record the integrity check right now." });
  }
};


export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken, code, codeLanguage, codeVersion, scribbleImage } = req.body

    const interview = await Interview.findById(interviewId)
    if (!interview || !interview.questions?.[questionIndex]) {
      return res.status(404).json({ message: "Interview question not found." });
    }
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You cannot update another user's interview." });
    }
    const question = interview.questions[questionIndex]
    const safeAnswer = String(answer || "").trim();
    const safeCode = question.requiresCode ? String(code || "").slice(0, 20000) : "";
    const safeCodeLanguage = question.requiresCode ? String(codeLanguage || "").slice(0, 50) : "";
    const safeCodeVersion = question.requiresCode ? String(codeVersion || "").slice(0, 50) : "";
    const safeScribbleImage = typeof scribbleImage === "string"
      && /^data:image\/(png|jpeg);base64,/i.test(scribbleImage)
      && scribbleImage.length <= 1_200_000
      ? scribbleImage
      : "";
    const hasResponse = Boolean(safeAnswer || safeCode || safeScribbleImage);

    // If no answer
    if (!hasResponse) {
      question.score = 0;
      question.feedback = "You did not submit an answer.";
      question.answer = "";

      await interview.save();

      return res.json({
        feedback: question.feedback
      });
    }

    // If time exceeded
    if (timeTaken > question.timeLimit) {
      question.score = 0;
      question.feedback = "Time limit exceeded. Answer not evaluated.";
      question.answer = safeAnswer;
      question.code = safeCode;
      question.codeLanguage = safeCodeLanguage;
      question.codeVersion = safeCodeVersion;

      await interview.save();

      return res.json({
        feedback: question.feedback
      });
    }

    const resumeAssessmentContext = retrieveDocumentContext(
      interview.resumeText,
      `${question.question} ${safeAnswer.slice(0, 1000)} ${safeCode.slice(0, 1000)}`,
      2
    ).join("\n- ");
    const jobAssessmentContext = retrieveDocumentContext(
      interview.jobDescriptionText,
      `${question.question} ${safeAnswer.slice(0, 1000)} ${safeCode.slice(0, 1000)}`,
      2
    ).join("\n- ");

    const evaluationText = `
Candidate role: ${interview.role}
Experience: ${interview.experience}
Interview mode: ${interview.mode}
Question topic: ${question.topic || "General interview competency"}
Question focus: ${question.focus || ""}
Question requires code: ${question.requiresCode ? "Yes" : "No"}
Question: ${question.question}
Candidate explanation: ${safeAnswer || "No spoken or typed explanation supplied."}
Code language: ${safeCodeLanguage || "Not selected"}
Code version: ${safeCodeVersion || "Not selected"}
Submitted code or pseudocode:
${safeCode || "No code supplied."}
${safeScribbleImage ? "A candidate scribble/drawing is attached after this text. Include it in the evaluation when it is legible." : "No scribble/drawing was attached."}
Relevant resume evidence:
- ${resumeAssessmentContext || "No additional resume passage is needed for this assessment."}
Relevant job-description evidence:
- ${jobAssessmentContext || "No job description was provided."}
`;

    const messages = [
      {
        role: "system",
        content: `
You are a senior interviewer giving a rigorous, useful evaluation of one interview answer.

Judge the answer against the specific question and the candidate's role, experience, and interview mode. For technical questions, check factual correctness, depth, trade-offs, and missing technical details. For HR questions, check whether the candidate gives a credible, structured example with ownership and outcome. Do not reward confident wording if the answer is vague, off-topic, or incorrect.

Use the question topic to apply an appropriate technical rubric: for DSA assess algorithm choice, correctness, complexity, edge cases, and data-structure reasoning; for OOP assess principles, design choices, and trade-offs; for DBMS assess data modelling, query/transaction/indexing reasoning; for operating systems assess process, memory, concurrency, or system trade-offs; for computer architecture assess hardware-performance reasoning. State a correction clearly when a technical claim is inaccurate.

When code is supplied, inspect its logic, language-appropriate syntax, completeness, complexity, edge cases, and whether it solves the stated task. When a drawing is supplied, inspect the diagram, pseudocode, query plan, class design, or annotation as evidence; do not claim you can read a detail that is not visible. If the question required code but none was supplied, say so clearly and score the missing implementation appropriately.

Score each category from 0 to 10:
- confidence: clarity, ownership, and conviction without unsupported claims
- communication: structure, concision, and understandable explanation
- correctness: factual accuracy, relevance, completeness, and practical reasoning

Be direct and specific. Mention details that are actually present or absent in the answer; never give generic feedback. The feedback must be 80 to 130 words. Provide exactly two strengths and exactly three actionable improvements. Do not use Markdown and do not use a code fence.

Return only valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "Detailed 80 to 130 word evaluation",
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"]
}
`
      }
      ,
      {
        role: "user",
        content: safeScribbleImage
          ? [
            { type: "text", text: evaluationText },
            { type: "image_url", image_url: { url: safeScribbleImage } },
          ]
          : evaluationText,
      }
    ];


    let parsed = null;

    try {
      const aiResponse = await askAi(messages)
      parsed = normalizeEvaluation(parseAiJson(aiResponse));
    } catch (error) {
      console.error("AI evaluation unavailable, using transparent fallback:", error.message);
      parsed = fallbackEvaluation(safeAnswer || safeCode || "A diagram was submitted without text.");
    }

    question.answer = safeAnswer;
    question.code = safeCode;
    question.codeLanguage = safeCodeLanguage;
    question.codeVersion = safeCodeVersion;
    question.confidence = parsed.confidence;
    question.communication = parsed.communication;
    question.correctness = parsed.correctness;
    question.score = parsed.finalScore;
    question.feedback = parsed.feedback;
    question.strengths = parsed.strengths;
    question.improvements = parsed.improvements;
    question.evaluationSource = parsed.evaluationSource;
    await interview.save();


    return res.status(200).json({
      feedback: parsed.feedback,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      confidence: parsed.confidence,
      communication: parsed.communication,
      correctness: parsed.correctness,
      score: parsed.finalScore,
      evaluationSource: parsed.evaluationSource,
    })
  } catch (error) {
    return res.status(500).json({message:`failed to submit answer ${error}`})

  }
}


export const finishInterview = async (req,res) => {
  try {
    const {interviewId} = req.body
    const interview = await Interview.findById(interviewId)
    if(!interview){
      return res.status(400).json({message:"failed to find Interview"})
    }
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You cannot finish another user's interview." });
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions
      ? totalScore / totalQuestions
      : 0;

    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

    const roundedFinalScore = Number(finalScore.toFixed(1));
    const fallbackCoachingReport = buildFallbackCoachingReport(interview.questions, roundedFinalScore);
    const questionDigest = interview.questions.map((question, index) => ({
      number: index + 1,
      topic: questionTopicLabels[question.topic] || question.topic || "General",
      question: question.question,
      score: question.score || 0,
      answer: String(question.answer || "").slice(0, 900),
      code: String(question.code || "").slice(0, 900),
      feedback: String(question.feedback || "").slice(0, 900),
      strengths: question.strengths || [],
      improvements: question.improvements || [],
    }));

    let coachingReport = fallbackCoachingReport;
    try {
      const aiResponse = await askAi([
        {
          role: "system",
          content: `You are an expert interview coach writing a concrete post-interview learning report. Base every conclusion only on the submitted interview evidence. Do not give generic praise, invent skills, or claim a question was answered well when its score or feedback says otherwise.

Return only valid JSON in exactly this structure:
{
  "executiveSummary": "80-120 word evidence-based summary",
  "readiness": "short readiness assessment",
  "strongestAreas": [{"topic": "topic key", "label": "display name", "score": number, "reason": "specific evidence"}],
  "improvementAreas": [{"topic": "topic key", "label": "display name", "score": number, "priority": "high|medium|low", "diagnosis": "specific gap from answers", "actions": ["specific practice action 1", "specific practice action 2"]}],
  "practicePlan": [{"day": "Day 1", "task": "specific 30-60 minute task"}],
  "interviewAdvice": "specific final advice"
}

List at most three strongest areas and three improvement areas. Give a seven-day practice plan when there are enough weaknesses, otherwise a shorter focused plan. For technical gaps, mention the precise reasoning, complexity, SQL, design, or systems concept to practise.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            candidateRole: interview.role,
            experience: interview.experience,
            interviewMode: interview.mode,
            finalScore: roundedFinalScore,
            confidence: Number(avgConfidence.toFixed(1)),
            communication: Number(avgCommunication.toFixed(1)),
            correctness: Number(avgCorrectness.toFixed(1)),
            topicAnalysis: buildTopicAnalysis(interview.questions),
            questions: questionDigest,
          }),
        },
      ]);
      coachingReport = normalizeCoachingReport(parseAiJson(aiResponse), fallbackCoachingReport);
    } catch (error) {
      console.error("AI coaching report unavailable, using transparent fallback:", error.message);
    }

    interview.finalScore = finalScore;
    interview.status = "completed";
    interview.coachingReport = coachingReport;

    await interview.save();

    return res.status(200).json({
       finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
       coachingReport,
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
         topic: q.topic || "generic",
         focus: q.focus || "",
         requiresCode: Boolean(q.requiresCode),
         code: q.code || "",
         codeLanguage: q.codeLanguage || "",
         codeVersion: q.codeVersion || "",
         answer: q.answer || "",
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
        strengths: q.strengths || [],
        improvements: q.improvements || [],
        evaluationSource: q.evaluationSource || "ai",
      })),
    })
  } catch (error) {
    return res.status(500).json({message:`failed to finish Interview ${error}`})
  }
}


export const getMyInterviews = async (req,res) => {
  try {
    const interviews = await Interview.find({userId:req.userId})
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status createdAt");

    return res.status(200).json(interviews)

  } catch (error) {
     return res.status(500).json({message:`failed to find currentUser Interview ${error}`})
  }
}

export const getInterviewReport = async (req,res) => {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You cannot view another user's interview." });
    }


    const totalQuestions = interview.questions.length;

    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });
    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

       return res.json({
      finalScore: interview.finalScore,
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      coachingReport: interview.coachingReport || buildFallbackCoachingReport(interview.questions, Number((interview.finalScore || 0).toFixed(1))),
      questionWiseScore: interview.questions
    });

  } catch (error) {
    return res.status(500).json({message:`failed to find currentUser Interview report ${error}`})
  }
}




