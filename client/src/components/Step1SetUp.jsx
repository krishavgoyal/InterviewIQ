import React from 'react'
import { motion } from "motion/react"
import {
    FaUserTie,
    FaBriefcase,
    FaFileUpload,
    FaMicrophoneAlt,
    FaChartLine,
} from "react-icons/fa";
import { useState } from 'react';
import axios from "axios"
import { ServerUrl } from '../config/api';
import { useDispatch, useSelector } from 'react-redux';
import { setUserData } from '../redux/userSlice';
const MotionDiv = motion.div;
const MotionButton = motion.button;
const durationOptions = [5, 10, 15, 20, 30, 45, 60];

const interviewTopics = {
    Technical: [
        { id: "dsa", label: "DSA & Coding", description: "Algorithms, data structures, complexity, and edge cases" },
        { id: "oops", label: "OOP / Design", description: "Object-oriented design, principles, and trade-offs" },
        { id: "dbms", label: "DBMS / SQL", description: "Data modelling, queries, transactions, and indexes" },
        { id: "operatingSystems", label: "Operating Systems", description: "Processes, memory, concurrency, and scheduling" },
        { id: "computerArchitecture", label: "Computer Architecture", description: "CPU, memory, performance, and systems fundamentals" },
        { id: "resume", label: "Resume & Projects", description: "Your concrete work, decisions, and impact" },
        { id: "generic", label: "Technical Reasoning", description: "Debugging, trade-offs, and practical problem solving" },
    ],
    HR: [
        { id: "resume", label: "Resume & Projects", description: "Your work, ownership, and impact" },
        { id: "behavioral", label: "Behavioral", description: "Collaboration, conflict, and leadership examples" },
        { id: "situational", label: "Situational", description: "Professional judgement in realistic scenarios" },
        { id: "motivation", label: "Motivation", description: "Career direction and role alignment" },
        { id: "generic", label: "Communication", description: "Professional communication and self-awareness" },
    ],
};

const makeDefaultAllocation = (mode, total) => {
    const allocation = Object.fromEntries(interviewTopics[mode].map(({ id }) => [id, 0]));
    const priority = mode === "Technical"
        ? ["resume", "generic", "dsa", "oops", "dbms", "operatingSystems", "computerArchitecture"]
        : ["resume", "behavioral", "situational", "motivation", "generic"];

    for (let index = 0; index < total; index += 1) {
        const topic = priority[index % priority.length];
        allocation[topic] += 1;
    }
    return allocation;
};

function Step1SetUp({ onStart }) {
    const {userData}= useSelector((state)=>state.user)
    const dispatch = useDispatch()
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [mode, setMode] = useState("Technical");
    const [questionCount, setQuestionCount] = useState(5);
    const [durationMinutes, setDurationMinutes] = useState(15);
    const [topicAllocation, setTopicAllocation] = useState(() => makeDefaultAllocation("Technical", 5));
    const [resumeFile, setResumeFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [skills, setSkills] = useState([]);
    const [resumeText, setResumeText] = useState("");
    const [jobDescriptionFile, setJobDescriptionFile] = useState(null);
    const [jobDescriptionText, setJobDescriptionText] = useState("");
    const [jobDescriptionInsights, setJobDescriptionInsights] = useState({});
    const [jobDescriptionAnalyzing, setJobDescriptionAnalyzing] = useState(false);
    const [jobDescriptionError, setJobDescriptionError] = useState("");
    const [analysisDone, setAnalysisDone] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState("");
    const [microphoneError, setMicrophoneError] = useState("");
    const [startError, setStartError] = useState("");


    const handleUploadResume = async () => {
        if (!resumeFile || analyzing) return;
        setAnalyzing(true)
        setAnalysisError("")

        const formdata = new FormData()
        formdata.append("resume", resumeFile)

        try {
            const result = await axios.post(ServerUrl + "/api/interview/resume", formdata, { withCredentials: true })

            console.log(result.data)

            setRole(result.data.role || "");
            setExperience(result.data.experience || "");
            setProjects(result.data.projects || []);
            setSkills(result.data.skills || []);
            setResumeText(result.data.resumeText || "");
            setAnalysisDone(true);

            setAnalyzing(false);

        } catch (error) {
            console.log(error)
            setAnalysisError(error.response?.data?.message || "Resume analysis failed. Please try another PDF.")
            setAnalyzing(false);
        }
    }

    const requestMicrophoneAccess = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setMicrophoneError("Voice answers need Chrome or Edge on localhost/HTTPS. You can still type answers.");
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            stream.getTracks().forEach((track) => track.stop());
            setMicrophoneError("");
            return true;
        } catch (error) {
            console.log(error);
            setMicrophoneError("Microphone permission was not granted. Allow it in the browser to answer by voice.");
            return false;
        }
    };

    const handleUploadJobDescription = async () => {
        if (!jobDescriptionFile || jobDescriptionAnalyzing) return;
        setJobDescriptionAnalyzing(true);
        setJobDescriptionError("");

        const formdata = new FormData();
        formdata.append("jobDescription", jobDescriptionFile);

        try {
            const result = await axios.post(
                ServerUrl + "/api/interview/job-description",
                formdata,
                { withCredentials: true }
            );
            setJobDescriptionText(result.data.jobDescriptionText || "");
            setJobDescriptionInsights({
                targetRole: result.data.targetRole || "",
                responsibilities: result.data.responsibilities || [],
                requiredSkills: result.data.requiredSkills || [],
                interviewFocus: result.data.interviewFocus || "",
            });
        } catch (error) {
            console.log(error);
            setJobDescriptionError(error.response?.data?.message || "Job description analysis failed. Please try another PDF.");
        } finally {
            setJobDescriptionAnalyzing(false);
        }
    };

    const activeTopics = interviewTopics[mode];
    const allocatedQuestions = Object.values(topicAllocation).reduce((total, amount) => total + amount, 0);
    const allocationRemaining = questionCount - allocatedQuestions;

    const handleModeChange = (nextMode) => {
        setMode(nextMode);
        setTopicAllocation(makeDefaultAllocation(nextMode, questionCount));
    };

    const handleQuestionCountChange = (nextCount) => {
        const count = Number(nextCount);
        setQuestionCount(count);
        setTopicAllocation(makeDefaultAllocation(mode, count));
        setDurationMinutes((currentDuration) => Math.max(currentDuration, durationOptions.find((minutes) => minutes >= count) || 60));
    };

    const updateTopicAllocation = (topic, change) => {
        setTopicAllocation((current) => {
            const currentAmount = current[topic] || 0;
            if (change > 0 && allocatedQuestions >= questionCount) return current;
            if (change < 0 && currentAmount <= 0) return current;
            return { ...current, [topic]: currentAmount + change };
        });
    };

    const handleStart = async () => {
        setLoading(true)
        setStartError("");
        try {
           const microphoneReady = await requestMicrophoneAccess();
           const result = await axios.post(ServerUrl + "/api/interview/generate-questions" , {
            role,
            experience,
            mode,
            resumeText,
            projects,
            skills,
            jobDescriptionText,
            jobDescriptionInsights,
            questionCount,
            durationMinutes,
            topicAllocation,
           } , {withCredentials:true}) 
           console.log(result.data)
           if(userData){
            dispatch(setUserData({...userData , credits:result.data.creditsLeft}))
           }
           setLoading(false)
            onStart({...result.data, microphoneReady})

        } catch (error) {
            console.log(error)
            setStartError(error.response?.data?.message || "Unable to prepare the interview. Please try again.");
            setLoading(false)
        }
    }
    return (
        <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4'>

            <div className='w-full max-w-6xl bg-white rounded-3xl shadow-2xl grid md:grid-cols-2 overflow-hidden'>

                <MotionDiv
                    initial={{ x: -80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className='relative bg-gradient-to-br from-green-50 to-green-100 p-12 flex flex-col justify-center'>

                    <h2 className="text-4xl font-bold text-gray-800 mb-6">
                        Start Your AI Interview
                    </h2>

                    <p className="text-gray-600 mb-10">
                        Practice real interview scenarios powered by AI.
                        Improve communication, technical skills, and confidence.
                    </p>

                    <div className='space-y-5'>

                        {
                            [
                                {
                                    icon: <FaUserTie className="text-green-600 text-xl" />,
                                    text: "Choose Role & Experience",
                                },
                                {
                                    icon: <FaMicrophoneAlt className="text-green-600 text-xl" />,
                                    text: "Smart Voice Interview",
                                },
                                {
                                    icon: <FaChartLine className="text-green-600 text-xl" />,
                                    text: "Performance Analytics",
                                },
                            ].map((item, index) => (
                                <MotionDiv key={index}
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 + index * 0.15 }}
                                    whileHover={{ scale: 1.03 }}
                                    className='flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm cursor-pointer'>
                                    {item.icon}
                                    <span className='text-gray-700 font-medium'>{item.text}</span>

                                </MotionDiv>
                            ))
                        }
                    </div>



                </MotionDiv>



                <MotionDiv
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className="p-12 bg-white">

                    <h2 className='text-3xl font-bold text-gray-800 mb-8'>
                        Interview SetUp
                    </h2>


                    <div className='space-y-6'>

                        <div className='relative'>
                            <FaUserTie className='absolute top-4 left-4 text-gray-400' />

                            <input type='text' placeholder='Enter role'
                                className='w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition'
                                onChange={(e) => setRole(e.target.value)} value={role} />
                        </div>


                        <div className='relative'>
                            <FaBriefcase className='absolute top-4 left-4 text-gray-400' />

                            <input type='text' placeholder='Experience (e.g. 2 years)'
                                className='w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition'
                                onChange={(e) => setExperience(e.target.value)} value={experience} />



                        </div>

                        <select value={mode}
                            onChange={(e) => handleModeChange(e.target.value)}
                            className='w-full py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition'>

                            <option value="Technical">Technical Interview</option>
                            <option value="HR">HR Interview</option>

                        </select>

                        <div className='rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div>
                                    <h3 className='font-semibold text-gray-800'>Customize your interview</h3>
                                    <p className='mt-1 text-xs leading-relaxed text-gray-600'>Set the length and distribute every question across the skills you want to practise.</p>
                                </div>
                                <span className='rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm'>{durationMinutes} min approx.</span>
                            </div>

                            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                                <label className='text-sm font-medium text-gray-700'>
                                    Number of questions
                                    <select value={questionCount} onChange={(e) => handleQuestionCountChange(e.target.value)} className='mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500'>
                                        {[3, 5, 6, 8, 10, 12, 15].map((count) => <option key={count} value={count}>{count} questions</option>)}
                                    </select>
                                </label>
                                <label className='text-sm font-medium text-gray-700'>
                                    Approximate duration
                                    <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className='mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500'>
                                        {durationOptions.filter((minutes) => minutes >= questionCount).map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                                    </select>
                                </label>
                            </div>

                            <div className='mt-5 flex items-center justify-between gap-3'>
                                <div>
                                    <p className='text-sm font-semibold text-gray-800'>{mode === "Technical" ? "Technical question mix" : "Interview question mix"}</p>
                                    <p className={`mt-0.5 text-xs font-medium ${allocationRemaining === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                                        {allocationRemaining === 0 ? `All ${questionCount} questions allocated` : `${allocationRemaining} question${allocationRemaining === 1 ? "" : "s"} left to allocate`}
                                    </p>
                                </div>
                                <button type='button' onClick={() => setTopicAllocation(makeDefaultAllocation(mode, questionCount))} className='text-xs font-semibold text-emerald-700 hover:text-emerald-900'>Reset mix</button>
                            </div>

                            <div className='mt-3 space-y-2'>
                                {activeTopics.map((topic) => (
                                    <div key={topic.id} className='flex items-center gap-3 rounded-xl border border-white bg-white/90 p-3'>
                                        <div className='min-w-0 flex-1'>
                                            <p className='text-sm font-semibold text-gray-800'>{topic.label}</p>
                                            <p className='mt-0.5 text-xs leading-relaxed text-gray-500'>{topic.description}</p>
                                        </div>
                                        <div className='flex shrink-0 items-center gap-2'>
                                            <button type='button' onClick={() => updateTopicAllocation(topic.id, -1)} disabled={!topicAllocation[topic.id]} className='flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-35'>−</button>
                                            <span className='w-5 text-center text-sm font-bold text-emerald-700'>{topicAllocation[topic.id] || 0}</span>
                                            <button type='button' onClick={() => updateTopicAllocation(topic.id, 1)} disabled={allocationRemaining <= 0} className='flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-lg text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35'>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {!analysisDone && (
                            <MotionDiv
                                whileHover={{ scale: 1.02 }}
                                onClick={() => document.getElementById("resumeUpload").click()}
                                className='border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition'>

                                <FaFileUpload className='text-4xl mx-auto text-green-600 mb-3' />

                                <input type="file"
                                    accept="application/pdf"
                                    id="resumeUpload"
                                    className='hidden'
                                    onChange={(e) => setResumeFile(e.target.files[0])} />

                                <p className='text-gray-600 font-medium'>
                                    {resumeFile ? resumeFile.name : "Upload your resume PDF (Required)"}
                                </p>

                                <p className='text-xs text-gray-500 mt-2'>
                                    Your resume is analyzed to create interview questions tailored to your background.
                                </p>

                                {resumeFile && (
                                    <MotionButton
                                        disabled={analyzing}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUploadResume()
                                        }}

                                        className='mt-4 bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-800 disabled:bg-gray-500 transition'>
                                        {analyzing ? "Analyzing..." : "Analyze Resume"}



                                    </MotionButton>)}

                                {analysisError && (
                                    <p className='text-red-500 text-sm mt-3'>{analysisError}</p>
                                )}

                            </MotionDiv>


                        )}

                        {analysisDone && (
                            <MotionDiv
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className='bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4'>
                                <h3 className='text-lg font-semibold text-gray-800'>
                                    Resume Analysis Result</h3>

                                {projects.length > 0 && (
                                    <div>
                                        <p className='font-medium text-gray-700 mb-1'>
                                            Projects:</p>

                                        <ul className='list-disc list-inside text-gray-600 space-y-1'>
                                            {projects.map((p, i) => (
                                                <li key={i}>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {skills.length > 0 && (
                                    <div>
                                        <p className='font-medium text-gray-700 mb-1'>
                                            Skills:</p>

                                        <div className='flex flex-wrap gap-2'>
                                            {skills.map((s, i) => (
                                                <span key={i} className='bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm'>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </MotionDiv>
                        )}

                        <MotionDiv
                            whileHover={{ scale: 1.01 }}
                            onClick={() => document.getElementById("jobDescriptionUpload").click()}
                            className='border-2 border-dashed border-blue-200 rounded-xl p-5 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition'>
                            <FaFileUpload className='text-2xl mx-auto text-blue-600 mb-2' />
                            <p className='text-gray-700 font-medium'>
                                {jobDescriptionFile ? jobDescriptionFile.name : "Add job description PDF (Optional)"}
                            </p>
                            <p className='text-xs text-gray-500 mt-1'>
                                We will match questions to the role requirements and responsibilities.
                            </p>
                            <input
                                type="file"
                                accept="application/pdf"
                                id="jobDescriptionUpload"
                                className='hidden'
                                onChange={(e) => {
                                    setJobDescriptionFile(e.target.files[0] || null);
                                    setJobDescriptionText("");
                                    setJobDescriptionInsights({});
                                }}
                            />

                            {jobDescriptionFile && !jobDescriptionText && (
                                <MotionButton
                                    disabled={jobDescriptionAnalyzing}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUploadJobDescription();
                                    }}
                                    className='mt-3 bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800 disabled:bg-blue-400 transition'>
                                    {jobDescriptionAnalyzing ? "Analyzing role..." : "Analyze Job Description"}
                                </MotionButton>
                            )}

                            {jobDescriptionText && (
                                <div className='mt-3 text-left bg-white border border-blue-100 rounded-lg p-3 text-sm text-gray-700'>
                                    <p className='font-semibold text-blue-800'>Job description analyzed</p>
                                    {jobDescriptionInsights.targetRole && <p className='mt-1'>Target: {jobDescriptionInsights.targetRole}</p>}
                                    {jobDescriptionInsights.requiredSkills?.length > 0 && (
                                        <p className='mt-1'>Focus: {jobDescriptionInsights.requiredSkills.slice(0, 5).join(", ")}</p>
                                    )}
                                </div>
                            )}
                            {jobDescriptionError && <p className='text-red-500 text-sm mt-3'>{jobDescriptionError}</p>}
                        </MotionDiv>


                        <MotionButton
                        onClick={handleStart}
                            disabled={!role || !experience || !analysisDone || !resumeText || allocationRemaining !== 0 || loading}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                            className='w-full disabled:bg-gray-600 bg-green-600 hover:bg-green-700 text-white py-3 rounded-full text-lg font-semibold transition duration-300 shadow-md'>
                            {loading ? "Preparing your AI interview..." : !analysisDone ? "Analyze your resume to continue" : allocationRemaining !== 0 ? "Allocate every question to continue" : "Start 50-credit AI Interview"}


                        </MotionButton>
                        {microphoneError && <p className='text-sm text-amber-700 leading-relaxed'>{microphoneError}</p>}
                        {startError && <p className='text-sm text-red-600 leading-relaxed'>{startError}</p>}
                    </div>

                </MotionDiv>
            </div>

        </MotionDiv>
    )
}

export default Step1SetUp
