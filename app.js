const express = require('express');

const app = express();

app.get("/hello",(req,res)=>{
    res.send("Welcome to edumate!!!");
})

app.listen(8080,()=>{
    console.log("Listening on port 8080");
})
