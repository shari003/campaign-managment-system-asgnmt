import multer from "multer";

const storage = multer.memoryStorage();

export const csvUpload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // limited to max 50MB uploads
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
            cb(null, true);
        } else {
            cb(new Error("Only CSV files are allowed"));
        }
    },
}).single("file");
