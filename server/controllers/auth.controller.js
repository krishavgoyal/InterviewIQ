import genToken from "../config/token.js"
import User from "../models/user.model.js"
import { verifyFirebaseIdToken } from "../services/firebaseAdmin.service.js";


export const createSession = async (req,res) => {
    try {
        const { idToken } = req.body;
        if (!idToken || typeof idToken !== "string") {
            return res.status(400).json({ message: "A Firebase ID token is required." });
        }

        const decodedToken = await verifyFirebaseIdToken(idToken);
        const email = decodedToken.email?.toLowerCase();
        const name = decodedToken.name || email?.split("@")[0] || "InterviewIQ User";
        const signInProvider = decodedToken.firebase?.sign_in_provider;
        if (!email || (signInProvider === "google.com" && decodedToken.email_verified === false)) {
            return res.status(401).json({ message: "Use a valid account with a verified email address to continue." });
        }
        let user = await User.findOne({email})
        if(!user){
            user = await User.create({
                name , 
                email
            })
        }
        let token = await genToken(user._id)
        res.cookie("token" , token , {
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            sameSite:process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge:7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json(user)



    } catch (error) {
        console.error("Firebase session creation failed:", error.message);
        return res.status(401).json({message:"Your sign-in could not be verified. Please try again."})
    }
    
}

// Kept temporarily so existing browser sessions using the prior endpoint continue to work.
export const googleAuth = createSession;

export const logOut = async (req,res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        })
        return res.status(200).json({message:"LogOut Successfully"})
    } catch (error) {
         console.error("Logout failed:", error.message);
         return res.status(500).json({message:"Could not log out. Please try again."})
    }
    
}
