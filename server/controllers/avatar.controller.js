import {
  createTalkingVideo,
  getTalkingVideo,
} from "../services/did.service.js";

export const generateAvatarVideo = async (req, res) => {
  try {
    const { questionText } = req.body;

    if (!questionText) {
      return res.status(400).json({ message: "Question text is required" });
    }

    const talkId = await createTalkingVideo(questionText);

    return res.status(202).json({
      talkId,
      status: "created",
    });
  } catch (error) {
    console.log(error.response?.data || error.message);

    return res.status(500).json({
      message: "Failed to generate avatar video",
    });
  }
};

export const getAvatarVideoStatus = async (req, res) => {
  try {
    const { talkId } = req.params;

    if (!talkId) {
      return res.status(400).json({ message: "Talk id is required" });
    }

    const videoData = await getTalkingVideo(talkId);

    return res.status(200).json({
      status: videoData.status,
      videoUrl: videoData.result_url || null,
      error: videoData.error || null,
    });
  } catch (error) {
    console.log(error.response?.data || error.message);

    return res.status(500).json({
      message: "Failed to get avatar video status",
    });
  }
};
