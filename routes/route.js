const express = require("express");
const router = express.Router();
const {transactionalControllerWrapper} = require('../utils/controllerWrapper');
const { authenticate } = require("../middleware/auth");
const {login} = require("../controllers/auth")
const {getCatalogueFilters,getDsgConfig} = require("../controllers/utils")
const {getDsgCollections} = require("../controllers/dsgPrm")

// Valid routes
router.get("/getCatalogueFilters", authenticate, transactionalControllerWrapper(getCatalogueFilters));
router.get("/getDsgConfig", authenticate, transactionalControllerWrapper(getDsgConfig));
router.get("/getDsgCollections", authenticate, transactionalControllerWrapper(getDsgCollections));

router.post("/login", transactionalControllerWrapper(login));

// Catch-all route for invalid API endpoints
router.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Invalid route. Please check the API endpoint.",
  });
});

module.exports = router;

