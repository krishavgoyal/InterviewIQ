import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const uploadDir = path.join(process.cwd(), "public");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(req, file , cb){
        cb(null , uploadDir)
    },
    filename: function(req , file , cb){
        const filename = `${Date.now()}-${crypto.randomUUID()}.pdf`;
        cb(null , filename)
    }
})


export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf" || path.extname(file.originalname).toLowerCase() !== ".pdf") {
            return cb(new Error("Only PDF files up to 5 MB are allowed."));
        }
        cb(null, true);
    },
});
