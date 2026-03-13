const express = require("express");

const router = express.Router();

const controller = require("../controllers/concern.controller");

router.post("/raise",controller.raiseConcern);

router.get("/list",controller.getConcerns);

router.put("/conversation/:id",controller.addConversation);

router.put("/status/:id",controller.updateStatus);

router.delete("/delete/:id",controller.deleteConcern);
router.delete("/delete",controller.deleteConcern);

module.exports = router;