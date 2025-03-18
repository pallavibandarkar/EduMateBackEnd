const User = require("../models/user.js")
const passport = require('passport')
const Submission = require("../models/submission.js")
const Class = require("../models/class.js")
const Assignment = require("../models/assignment.js")
const multer = require('multer')
const {storage} = require("../cloudConfig.js");
const upload = multer({storage})
const axios = require('axios')
const Aigrade = require('../models/aigrading.js')
const cloudinary = require('cloudinary').v2;
const agenda = require("../utils/ajenda.js")
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,  
        pass: process.env.EMAIL_PASSWORD 
    }
});



module.exports.createClass = async(req,res)=>{
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
}


module.exports.joinClass =  async (req, res) => {
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
}

module.exports.aiGradingAndSubmission = async (req, res) => {
    try {
        const assignmentId = req.params.id
        console.log(req.user._id)
        const studentId = req.user._id
    
        const assignment = await Assignment.findById(assignmentId);
        const student = await User.findById(studentId);

        if (!assignment || !student) {
            return res.status(404).json({ error: "Assignment or Student not found" });
        }

        const classData = await Class.findOne({ assignments: assignmentId });
        if (!classData) {
            return res.status(404).json({ error: "Class not found" });
        }
        if (!classData.students.includes(studentId)) {
            return res.status(401).send({msg:"You are not a student of the class"});
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

        const gradingResult = response.data[0]; 
        
        const newAigrading = new Aigrade({
            score: gradingResult.marks,
            remarks: gradingResult.remarks.join(', '),
            suggestions: gradingResult.suggestions.join(', '),
            errors: gradingResult.errors.join(', ')
        });

        const result = await newAigrading.save();
        submission.aiGrade = result._id;
        submission.submitted = true;
        const finalSubmission = await submission.save();
        assignment.submissions.push(finalSubmission._id);
        await assignment.save();
        res.status(200).json({ message: 'Grading completed', result ,finalSubmission});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to grade submission' });
    }
}

module.exports.uploadAss =async(req,res)=>{
    try{
        let {id} = req.params;
        const uploadedFile = req.file;

        const findClass = await Class.findById(id).populate({ path: "students", select: "email name" }).populate("classTeacher");;
        console.log("class is : "+findClass)

        if(!findClass.classTeacher.equals(req.user._id)){
           const result = await cloudinary.uploader.destroy(uploadedFile.filename); 
           console.log(result)
           return res.status(401).send({msg:"You dont have permission to access this class!"})
        }

        const { title, description, deadline} = req.body;
    
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

        findClass.students.forEach(student => {
            transporter.sendMail({
                from: process.env.EMAIL,
                to: student.email,
                subject: "New Assignment Uploaded",
                text: `Hello ${student.name},\n\nA new assignment '${title}' has been uploaded.\nDeadline: ${deadline}\n\nPlease submit it before the deadline.\n\nBest,\nYour ${findClass.classTeacher.username}`
            });
        });

        const reminderTime = new Date(deadline);
        reminderTime.setDate(reminderTime.getDate() - 1); 

        const agendaSchedule = await agenda.schedule(reminderTime, "send assignment reminder", { assignmentId: newAssignment._id });
        console.log("Agenda Schedule : ",agendaSchedule)

        res.status(201).send({ message: "Assignment uploaded & emails scheduled!",assignment: newAssignment });

       // res.status(201).json({ message: "Assignment uploaded successfully!", assignment: newAssignment });
       }catch(err){
        console.log(err)
        res.status(500).json({ error: "Failed to upload assignment." });
       }
    
}

module.exports.getallClasses = async(req,res)=>{
    try {
        let { _id } = req.user;
        const classes = await Class.find({$or: [{ students: _id }, { classTeacher: _id }]})
        .populate({ path: "classTeacher" }) 
        .populate({ path: "students" }) 
        .populate({ path: "assignments",populate: { path: "submissions" } }) 
        res.status(200).send({ classes:classes });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch classes." });
    }
}

module.exports.viewClass = async(req,res)=>{
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
}