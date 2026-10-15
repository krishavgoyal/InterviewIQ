import jwt from "jsonwebtoken"


const isAuth = async (req,res,next) => {
    try {
        let {token} = req.cookies

        if(!token){
            return res.status(401).json({message:"Authentication is required."})
        }
        const verifyToken = jwt.verify(token , process.env.JWT_SECRET)
        
        if(!verifyToken){
            return res.status(401).json({message:"Your session is invalid or has expired."})
        }
        req.userId = verifyToken.userId

        next()
   

    } catch (error) {
        return res.status(401).json({message:"Your session is invalid or has expired."})
    }
    
}

export default isAuth
