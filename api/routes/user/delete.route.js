import express from "express";
import { deleteUserById } from "../../controllers/user/delete.controller.js";

const router = express.Router();

// DELETE user by ID
router.delete("/:id", deleteUserById);

export default router;