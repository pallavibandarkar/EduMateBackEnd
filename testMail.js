if(process.env.NODE_ENV != "production"){
    require('dotenv').config();
}


const nodemailer = require("nodemailer");

// Replace with your Gmail and generated App Password
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,  // Your Gmail ID
        pass: process.env.EMAIL_PASSWORD     // Your App Password (Not your Gmail password)
    }
});

const mailOptions = {
    from: "your-email@gmail.com",
    to: "recipient-email@gmail.com",  // Change this to your own email for testing
    subject: "Test Email from Nodemailer",
    text: "Hello! This is a test email to check if Nodemailer is working."
};

// Send email
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log("Error:", error);
    } else {
        console.log("Email sent successfully:", info.response);
    }
});
