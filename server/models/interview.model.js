import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema({
     question: String,
  focus: String,
  topic: String,
  requiresCode: { type: Boolean, default: false },
  codingInstructions: { type: String, default: "" },
  starterCode: { type: String, default: "" },
  code: { type: String, default: "" },
  codeLanguage: { type: String, default: "" },
  codeVersion: { type: String, default: "" },
  difficulty: String,
  timeLimit: Number,
  answer: String,
  feedback: String,
  strengths: { type: [String], default: [] },
  improvements: { type: [String], default: [] },
  evaluationSource: { type: String, default: "ai" },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
communication: { type: Number, default: 0 },
correctness: { type: Number, default: 0 },
})


const interviewSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    role:{
        type:String,
        required:true
    },
    experience:{
        type:String,
        required:true
    },
    mode:{
        type:String,
        enum:["HR" ,"Technical"],
        required:true
    },
    resumeText:{
     type:String
    },
    jobDescriptionText: {
      type: String,
      default: "",
    },
    documentInsights: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    interviewBlueprint: {
      questionCount: Number,
      durationMinutes: Number,
      topicAllocation: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    coachingReport: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    questions:[questionsSchema],

    finalScore: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Incompleted", "completed"],
      default: "Incompleted",
    }
},{timestamps:true})

const Interview = mongoose.model("Interview" , interviewSchema)


export default Interview
