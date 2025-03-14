const express = require('express')
const router = express.Router()
const passport = require('passport')
const User = require("../models/user.js")
const userControllers = require('../controllers/user.js')


router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.post("/signup",userControllers.registeredUser)
router.post("/login",passport.authenticate("local",{ failureRedirect: "/login", failureFlash: true }),userControllers.loginUser)

module.exports = router;