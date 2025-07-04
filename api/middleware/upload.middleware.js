import multer from 'multer';

const storage = multer.memoryStorage(); // store file in memory buffer

export const upload = multer({ storage });

export const uploadMultiple = multer({ storage }).array("podcasts", 100); // Accept up to 10 files

