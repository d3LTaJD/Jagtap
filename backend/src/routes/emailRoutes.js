const express = require('express');
const { protect, requirePermission } = require('../middleware/auth');
const emailController = require('../controllers/emailController');

const router = express.Router();

router.use(protect); // Secure outbound email API

router.post('/send', requirePermission('Email', 'send'), emailController.sendCustomEmail);

module.exports = router;
