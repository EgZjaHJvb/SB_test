import Material from '../../models/material/material.model.js';
import { uploadToCloudinary } from '../../middleware/cloudinaryUpload.js';
import { TestPodcast } from '../../models/material/TestPodcast.model.js';

export async function uploadMaterial(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Get user ID from auth middleware
        const uploadedBy = req.user?.id || req.user?._id;
        if (!uploadedBy) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        // Validate category and subject from req.body
        const { category, subject, syllabus, title, description, isPublic } = req.body;

        if (!category || !['video', 'podcast', 'notes'].includes(category)) {
            return res.status(400).json({ message: 'Invalid or missing category.' });
        }

        if (!subject || !['Maths', 'Physics', 'Chemistry', 'Biology', "PYQ's"].includes(subject)) {
            return res.status(400).json({ message: 'Invalid or missing subject.' });
        }

        if (!syllabus || !['JEE', 'NEET'].includes(syllabus)) {
            return res.status(400).json({ message: 'Invalid or missing syllabus.' });
        }

        // Upload file buffer to Cloudinary
        const uploadResult = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // Handle podcasts separately
        if (category === 'podcast') {
            const podcast = new TestPodcast({
                chapter: title || req.file.originalname,
                subtopic: description || '',
                subject,
                url: uploadResult.secure_url,
                uploadedBy,
                createdAt: new Date(),
                // Optionally add syllabus & isPublic if your model supports it
            });
            await podcast.save();

            return res.status(201).json({ message: 'Podcast uploaded successfully.', podcast });
        }

        // For video, notes and others
        const material = new Material({
            title: title || req.file.originalname,
            description: description || '',
            category,
            subject,
            syllabus,
            fileUrl: uploadResult.secure_url,
            uploadedBy,
            isPublic: false, // Always make materials private by default
        });

        await material.save();

        res.status(201).json({ message: 'Material uploaded successfully.', material });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed.', error: error.message });
    }
}

export const getMaterials = async (req, res) => {
    try {
        const { category, subject, syllabus, isPublic } = req.query;

        if (category === 'podcast') {
            const filter = {};
            if (subject) filter.subject = decodeURIComponent(subject);

            const podcasts = await TestPodcast.find(filter).sort({ createdAt: -1 });

            const formatted = podcasts.map((p) => ({
                _id: p._id,
                title: p.chapter,
                subtopic: p.subtopic,
                description: p.description || '',
                category: 'podcast',
                subject: p.subject,
                syllabus: 'NEET', // Or dynamically set if available in model
                fileUrl: p.url,
                isPublic: true, // Assuming podcasts are public
                createdAt: p.createdAt,
            }));

            return res.json({ materials: formatted });
        }

        // For other categories
        const filter = {};
        if (category) filter.category = category;
        if (subject) filter.subject = decodeURIComponent(subject);
        if (syllabus) filter.syllabus = syllabus;
        if (isPublic !== undefined) filter.isPublic = isPublic === 'true';

        const materials = await Material.find(filter).populate('uploadedBy', 'name');
        res.json({ materials });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch materials', error: error.message });
    }
};

export const togglePublicStatus = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        if (!material) return res.status(404).json({ message: 'Material not found' });

        if (String(material.uploadedBy) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        material.isPublic = !material.isPublic;
        await material.save();

        res.json({ message: 'Visibility updated', isPublic: material.isPublic });
    } catch (error) {
        res.status(500).json({ message: 'Failed to toggle visibility', error: error.message });
    }
};

export const getAllAccessibleMaterials = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        // Build filter for materials
        const baseFilter = {};
        const { category, subject, syllabus } = req.query;
        if (category) baseFilter.category = category;
        if (subject) baseFilter.subject = decodeURIComponent(subject);
        if (syllabus) baseFilter.syllabus = syllabus;

        // Fetch all public materials with filters
        const publicMaterials = await Material.find({ ...baseFilter, isPublic: true });
        // Fetch all private materials uploaded by the current user with filters
        const privateMaterials = await Material.find({
            ...baseFilter,
            isPublic: false,
            uploadedBy: userId,
        });

        // Fetch all podcasts (treated as public), filter by subject if provided
        if (category === 'podcast') {
            let podcastFilter = {};
            if (subject) podcastFilter.subject = decodeURIComponent(subject);
            const podcasts = await TestPodcast.find(podcastFilter).sort({ createdAt: -1 });
            const formattedPodcasts = podcasts.map((p) => ({
                _id: p._id,
                title: p.chapter,
                subtopic: p.subtopic,
                description: p.description || '',
                category: 'podcast',
                subject: p.subject,
                syllabus: 'NEET', // Or dynamically set if available in model
                fileUrl: p.url,
                isPublic: true,
                createdAt: p.createdAt,
                type: 'podcast',
            }));

            // Group by chapter
            const grouped = {};
            for (const p of formattedPodcasts) {
                if (!grouped[p.title]) grouped[p.title] = [];
                grouped[p.title].push(p);
            }

            return res.json({ materials: grouped });
        }

        // Format materials
        const formatMaterial = (m, isPublic) => ({
            _id: m._id,
            title: m.title,
            description: m.description || '',
            category: m.category,
            subject: m.subject,
            syllabus: m.syllabus,
            fileUrl: m.fileUrl,
            isPublic: isPublic,
            createdAt: m.uploadDate || m.createdAt,
            uploadedBy: m.uploadedBy,
            type: 'material',
        });

        const allMaterials = [
            ...publicMaterials.map((m) => formatMaterial(m, true)),
            ...privateMaterials.map((m) => formatMaterial(m, false)),
        ];

        res.json({ materials: allMaterials });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to fetch accessible materials',
            error: error.message,
        });
    }
};
