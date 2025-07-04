import axios from 'axios';
import FormData from 'form-data';
import { Buffer } from 'buffer';

export const checkFileNSFW = async (req, res) => {
    try {
        const { fileUrl } = req.body;

        const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });

        const form = new FormData();
        form.append('file', Buffer.from(fileResponse.data), {
            filename: 'uploaded_file',
            contentType: 'application/octet-stream', // or infer from mime
        });

        // Send to the Python service
        const pythonResponse = await axios.post('http://localhost:5001/detect', form, {
            headers: form.getHeaders(),
        });

        const result = pythonResponse.data.result;

        if (result === 'NSFW') {
            return res.status(450).json({ message: 'NSFW content detected' });
        } else {
            return res.status(200).json({ message: 'SAFE' });
        }
    } catch (err) {
        console.error('[NSFW Check Error]', err.message);
        return res.status(500).json({ error: 'Failed to check NSFW content' });
    }
};
