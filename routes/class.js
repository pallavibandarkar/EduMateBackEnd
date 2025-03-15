const express = require('express');
const route = express.Router();
const User = require("../models/user.js")
const Submission = require("../models/submission.js")
const Class = require("../models/class.js")
const Assignment = require("../models/assignment.js")
const passport = require('passport')
const multer = require('multer')
const {storage} = require("../cloudConfig.js");
const submission = require('../models/submission.js');
const upload = multer({storage})
const axios = require('axios')
const Aigrade = require('../models/aigrading.js')

route.use(express.json());
route.use(express.urlencoded({extended:true}));

function ensureAuthenticated(req, res, next) {
    console.log(req.user)
    if (req.isAuthenticated()) {
        console.log(req.user)
        return next();
    }
    res.status(401).json({ error: "Unauthorized: Please log in first" });
}


route.post("/create",ensureAuthenticated,async(req,res)=>{
    try{
        let {_id} = req.user;
        let {className , div}=req.body;
        const updateUser = await User.findByIdAndUpdate(_id,{role:"teacher"},{new:true});
        console.log("Updated User is ",updateUser)
        const newClass = new Class({
            className:className,
            classTeacher:req.user._id,
        })

        if(div){
            newClass.div = div;
        }
        const result = await newClass.save();

        const res2 = await User.findByIdAndUpdate(
            _id,
            { $push: { classTeacher: result._id } },
            { new: true }
        );
        
        res.status(201).send({ message: "Class created successfully!", class: result});
    }catch(err){
        console.log(err)
        res.status(500).send({ error: "Server error, please try again.",error:err });
    }
})

route.post("/join", ensureAuthenticated, async (req, res) => {
    try {
        let { _id } = req.user; // Logged-in user
        let { classCode } = req.body;

        // Find class by classCode
        const foundClass = await Class.findOne({ classCode });

        if (!foundClass) {
            return res.status(404).json({ error: "Class not found!" });
        }

        if (foundClass.students.includes(_id)) {
            return res.status(400).json({ error: "You are already in this class!" });
        }

        // Update class to add student
        const result = await Class.findByIdAndUpdate(
            foundClass._id,
            { $push: { students: _id } },
            { new: true }
        );

        // Update user to add class reference
        const res2 = await User.findByIdAndUpdate(
            _id,
            { $push: { enrolledIn: foundClass._id } },
            { new: true }
        );

        res.status(200).json({ message: "Successfully joined the class!", class: foundClass,result:result,res2:res2 });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Server error, please try again." });
    }
});

route.post('/grade-submission/:id',upload.single('file'),async (req, res) => {
    try {
        const assignmentId = req.params.id
        console.log(req.user._id)
        const studentId = req.user._id
        console.log("*************************************")
        console.log(req.file)

        const assignment = await Assignment.findById(assignmentId);
        const student = await User.findById(studentId);
        if (!assignment || !student) {
            return res.status(404).json({ error: "Assignment or Student not found" });
        }

        const newSubmission = new Submission({
            assignmentId,
            studentId,
            file: {
                url: req.file.path,
                filename: req.file.filename,
            },
        });
        const newSub = await newSubmission.save()
        const submission = await Submission.findById(newSub._id);

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const fileUrl = submission.file.url;

        const response = await axios.post('http://127.0.0.1:5001/grade', { file_url: fileUrl });
        console.log(response.data[0])

        if (!response.data || response.data.length === 0) {
            return res.status(500).json({ error: 'Failed to get valid grading results' });
        }

        // Extract the first result from the response
        const gradingResult = response.data[0]; // Access the first item in the data array

        // Create a new Aigrade document
        const newAigrading = new Aigrade({
            score: gradingResult.marks,
            remarks: gradingResult.remarks.join(', '), // Convert array to string if needed
            suggestions: gradingResult.suggestions.join(', '),
            errors: gradingResult.errors.join(', ')
        });

        // Save the Aigrade document
        const result = await newAigrading.save();
        
        // Update the submission with the AI grade
        submission.aiGrade = result._id;
        const finalSubmission = await submission.save();

        res.status(200).json({ message: 'Grading completed', result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to grade submission' });
    }
});

route.post("/upload/:id",upload.single('file'),async(req,res)=>{
    try{
        let {id} = req.params;

        const findClass = await Class.findById(id);

        if(!findClass.classTeacher.equals(req.user._id)){
            console.log(findClass.classTeacher)
            console.log(req.user._id)
           return res.send({msg:"You dont have permission to access this class!"})
        }

        const { title, description, deadline} = req.body;
        const uploadedFile = req.file;
        console.log(uploadedFile)

        const newAssignment = new Assignment({
          title:title,
          description:description,
          deadline:deadline,
          file:{
            url: uploadedFile.path,
            filename: uploadedFile.filename
          },
          class:id,
          uploaded_by:req.user._id,
        })

        const result = await newAssignment.save();
        await Class.findByIdAndUpdate(id, { $push: { assignments: newAssignment._id } });
        res.status(201).json({ message: "Assignment uploaded successfully!", assignment: newAssignment });

       }catch(err){
        console.error(err);
        res.status(500).json({ error: "Failed to upload assignment." });
       }
    
})


route.post("/uploadAss",async(req,res)=>{
    const newSubmission = new Submission({
        assignment:"67d2e7aa113bbc014f42dc82",
        studentId:"67c9ea20bdcd846a3c1ca944",
        file:{
            url:"https://res.cloudinary.com/dvqkoleje/image/upload/v1741875116/EduMate/fcrikg6o5twe58iyqo7v.pdf",
            filename:"EduMate/fcrikg6o5twe58iyqo7v"
        }
    })
    const result = await newSubmission.save();

    res.send({data:result});
})

route.get("/getClasses",async(req,res)=>{
    try {
        let { _id } = req.user;
        const classes = await Class.find({ students: _id })
        .populate({ path: "classTeacher" }) 
        .populate({ path: "students" }) 
        .populate({ path: "assignments" }) 
        
;
        res.status(200).send({ classes:classes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch classes." });
    }
})

route.get("/getClass/:id",async(req,res)=>{
    try{
        let {id} = req.params;
        const result = await Class.findById(id)
        .populate({ path: "classTeacher" }) 
        .populate({ path: "students" }) 
        .populate({ path: "assignments" }) ;
        if(!result){
            return res.send({msg:"Class Not found for given id"})
        }
        res.send({msg:"Class found",class:result})
    }catch(err){
        res.send({msg:"Class Not found for given id",error:err})
    }
})


module.exports = route;


