const express = require('express');
const route = express.Router();
const User = require("../models/user.js")
const Class = require("../models/class.js")
const passport = require('passport')
const multer = require('multer')
const {storage} = require("../cloudConfig.js")

const upload = multer({ storage })

route.post("/");