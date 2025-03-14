const User = require("../models/user.js")
const passport = require('passport')

module.exports.registeredUser = async (req,res)=>{
    const {username,email,password} = req.body
    let newUser= new User({
        username:username,
        email:email,
    })
    try{
        let registeredUser = await User.register(newUser,password);
        req.login(registeredUser,((err)=>{
            if(err){
               console.log(err)
            }
        }))
        res.status(200).send({success:true,mas:"User Signed Up Successfully ", data: registeredUser});
    }
    catch(err){
        res.status(400).send({success:false,msg:'User does not sign up successfully',error:err.message})
    }
}

module.exports.loginUser = (req, res) => {
    if (req.isAuthenticated()) { 
        console.log("user is"+req.user)
        res.status(200).send({
            success: true,
            message: "Logged in successfully",
            data: req.user
        });
    } else {
        res.status(401).send({ success: false, message: "Login failed" });
    }
};