if(process.env.NODE_ENV != "production"){
    require('dotenv').config();
}

const express = require('express');
const app = express();
const mongoose = require('mongoose')
const cors = require('cors')
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo');
const User = require("./models/user.js")
const userRouter = require("./routes/user.js")
const classRouter = require("./routes/class.js")

const dburl =process.env.ATLAS_DBURL
main()
.then(()=>{
    console.log("Connected to the atlas db")
})
.catch((err)=>{
    console.log("Error occurred!!")
})

async function main() {
    await mongoose.connect(dburl)
}

const sessionOptions = {
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false,
    store: MongoStore.create({
        mongoUrl: process.env.ATLAS_DBURL, 
        
    }),
    cookie:{
        expires:Date.now()+7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true,
        SameSite:'lax'
    }
}

app.use(cors( {
        origin: true, 
        credentials: true,  
}))

app.use(express.json());  
app.use(express.urlencoded({ extended: true }));

app.use(session(sessionOptions));

app.use(passport.initialize())
app.use(passport.session())

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use("/profile",userRouter);
app.use('/class',classRouter)



app.get("/hello",(req,res)=>{
    console.log(req.user)
    console.log(req.session)
    res.send("Welcome to edumate!!!");
})

app.get("/debug-session", (req, res) => {
    console.log("Session:", req.session);
    console.log("User:", req.user);
    res.json({ session: req.session, user: req.user });
});

app.listen(8080,()=>{
    console.log("Listening on port 8080");
})
