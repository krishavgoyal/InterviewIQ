import axios from "axios";

const didHeaders = () => ({
  Authorization: `Basic ${process.env.DID_API_KEY}`,
  "Content-Type": "application/json",
});

export const createTalkingVideo = async (questionText) => {
  const response = await axios.post(
    "https://api.d-id.com/talks",
    {
      source_url:
        "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.png",
      script: {
        type: "text",
        input: questionText,
        provider: {
          type: "microsoft",
          voice_id: "en-US-JennyNeural",
        },
      },
    },
    {
      headers: didHeaders(),
    }
  );

  return response.data.id;
};

export const getTalkingVideo = async (talkId) => {
  const response = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
    headers: didHeaders(),
  });

  return response.data;
};
