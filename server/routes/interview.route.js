import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { upload } from "../middlewares/multer.js"
import { analyzeJobDescription, analyzeResume, finishInterview, generateQuestion, getInterviewReport, getMyInterviews, getProgressiveHint, recordProctoringEvent, submitAnswer } from "../controllers/interview.controller.js"




const interviewRouter = express.Router()

interviewRouter.post("/resume",isAuth,upload.single("resume"),analyzeResume)
interviewRouter.post("/job-description",isAuth,upload.single("jobDescription"),analyzeJobDescription)
interviewRouter.post("/generate-questions",isAuth,generateQuestion)
interviewRouter.post("/hint",isAuth,getProgressiveHint)
interviewRouter.post("/proctor-check",isAuth,recordProctoringEvent)
interviewRouter.post("/submit-answer",isAuth,submitAnswer)
interviewRouter.post("/finish",isAuth,finishInterview)

interviewRouter.get("/get-interview",isAuth,getMyInterviews)
interviewRouter.get("/report/:id",isAuth,getInterviewReport)



export default interviewRouter
