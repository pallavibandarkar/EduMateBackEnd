module.exports.isLoggedin = async(req,res,next)=>{
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized: Please log in first" });
    }
    next();
}