const express = require("express");
const router = express.Router();
const {transactionalControllerWrapper} = require('../utils/controllerWrapper');
const { authenticate } = require("../middlewares/auth");
const {login} = require("../controllers/auth")
const {getCatalogueFilterMasters, getComponents, settings,collectionUrls,getyCatalogueFilterMasters} = require("../controllers/utils")
const {getDsgCollections} = require("../controllers/dsgPrm")
const {getCatalog, createOrder,getCatalogDetails} = require("../controllers/ordDsg")
const { insertCsFltrs,getCsFilters } = require("../controllers/yCsFltr")

// Valid routes
router.post("/login", transactionalControllerWrapper(login));

router.get("/resource/settings", settings);
router.get("/collection-urls",authenticate,transactionalControllerWrapper(collectionUrls))
router.get("/getComponents", getComponents);

router.post("/getCatalog", authenticate, transactionalControllerWrapper(getCatalog));
router.get("/getyCatalogueFilterMasters", transactionalControllerWrapper(getyCatalogueFilterMasters))
router.get("/getDsgCollections", authenticate, transactionalControllerWrapper(getDsgCollections));
router.get("/getCatalogueFilterMasters", authenticate, transactionalControllerWrapper(getCatalogueFilterMasters));
router.get("/getCatalogueDetails", authenticate, transactionalControllerWrapper(getCatalogDetails));
router.get("/getCsFilters",authenticate, transactionalControllerWrapper(getCsFilters))


router.post("/insertCsFltrs",authenticate,transactionalControllerWrapper(insertCsFltrs))
router.post("/login", transactionalControllerWrapper(login));
router.post("/createOrder",authenticate, transactionalControllerWrapper(createOrder));

// Catch-all route for invalid API endpoints
router.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Invalid route. Please check the API endpoint.",
  });
});

module.exports = router;

