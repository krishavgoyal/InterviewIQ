import express from "express";
import {
  generateAvatarVideo,
  getAvatarVideoStatus,
} from "../controllers/avatar.controller.js";

const avatarRouter = express.Router();

avatarRouter.post("/generate", generateAvatarVideo);
avatarRouter.get("/status/:talkId", getAvatarVideoStatus);

export default avatarRouter;
