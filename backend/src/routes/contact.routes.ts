import { Router } from "express";

import { csvUpload } from "../middleware/upload.middleware";

import { uploadContacts, getAllContacts, getContactById, getContactCount, remove } from "../controllers/contact.controller";

const router = Router();

router.post("/upload", csvUpload, uploadContacts);
router.get("/", getAllContacts);
router.get("/count", getContactCount);
router.get("/:id", getContactById);
router.delete("/:id", remove);

export default router;
