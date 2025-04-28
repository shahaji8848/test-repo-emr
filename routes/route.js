const express = require("express");
const router = express.Router();
const {transactionalControllerWrapper} = require('../utils/controllerWrapper');
const { authenticate } = require("../middleware/auth");
const {login} = require("../controllers/auth")

// Valid routes

router.post("/login", transactionalControllerWrapper(login));


// Catch-all route for invalid API endpoints
router.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Invalid route. Please check the API endpoint.",
  });
});

module.exports = router;

