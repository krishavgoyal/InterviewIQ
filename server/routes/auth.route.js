import express from "express"
import { createSession, googleAuth, logOut } from "../controllers/auth.controller.js"

const authRouter = express.Router()


authRouter.post("/session", createSession)
authRouter.post("/google",googleAuth)
authRouter.get("/logout",logOut)


export default authRouter
