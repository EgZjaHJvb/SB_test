import Question from '../../../models/quiz/Questions.model.js';
import ChemistryPathway from '../../../models/quiz/chemistry/Chemistry.model.js'; // Assuming a Chemistry model

// GET /chemistry/chapters
export const getAllChapters = async (req, res) => {
    try {
        const chemistryPathwayDoc = await ChemistryPathway.findOne(
            { 'subjects.subject_name': 'Chemistry' }, // Target 'Chemistry'
            { 'subjects.$': 1 }
        );

        if (!chemistryPathwayDoc || !chemistryPathwayDoc.subjects?.length) {
            return res.status(404).json({ error: 'Chemistry subject not found' });
        }

        const chemistrySubject = chemistryPathwayDoc.subjects[0];

        const chapterList = chemistrySubject.chapters.map(({ chapter_id, chapter_name }) => ({
            chapter_id,
            chapter_name,
        }));

        res.status(200).json(chapterList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /chemistry/chapters/:chapterId
export const getChapterById = async (req, res) => {
    const { chapterId } = req.params;

    if (!chapterId) {
        return res.status(400).json({ error: 'Chapter Id is required' });
    }

    try {
        const result = await ChemistryPathway.aggregate([ // Target ChemistryPathway
            { $unwind: '$subjects' },
            { $unwind: '$subjects.chapters' },
            { $match: { 'subjects.chapters.chapter_id': parseInt(chapterId) } },
            {
                $project: {
                    _id: 0,
                    chapter_id: '$subjects.chapters.chapter_id',
                    chapter_name: '$subjects.chapters.chapter_name',
                    subtopics: '$subjects.chapters.subtopics',
                },
            },
        ]);

        if (!result.length) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        return res.json(result[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /chemistry/chapters/:chapterId/subtopics
export const getSubtopicsByChapter = async (req, res) => {
    const { chapterId } = req.params;

    if (!chapterId || isNaN(Number(chapterId))) {
        return res.status(400).json({ error: 'Valid chapterId is required' });
    }

    try {
        const result = await ChemistryPathway.aggregate([ // Target ChemistryPathway
            { $unwind: '$subjects' },
            { $match: { 'subjects.subject_name': 'Chemistry' } }, // Target 'Chemistry'
            { $unwind: '$subjects.chapters' },
            { $match: { 'subjects.chapters.chapter_id': parseInt(chapterId) } },
            {
                $project: {
                    chapter_id: '$subjects.chapters.chapter_id',
                    chapter_name: '$subjects.chapters.chapter_name',
                    subtopics: '$subjects.chapters.subtopics',
                },
            },
        ]);

        if (!result.length) {
            return res.status(404).json({ error: 'Subtopics not found for the chapter' });
        }

        return res.status(200).json(result[0].subtopics);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// GET /chemistry/chapters/:chapterId/subtopics/:subtopicId
export const getAllQuestionsBySubtopic = async (req, res) => {
    const { chapterId, subtopicId } = req.params;

    if (!chapterId || !subtopicId) {
        return res.status(400).json({ error: 'chapterId and subtopicId are required' });
    }

    const chapterIdNum = Number(chapterId);
    const subtopicIdNum = Number(subtopicId);

    if (isNaN(chapterIdNum) || isNaN(subtopicIdNum)) {
        return res
            .status(400)
            .json({ error: 'Invalid chapterId or subtopicId. Must be a number.' });
    }

    try {
        const doc = await ChemistryPathway.findOne(); // Target ChemistryPathway

        if (!doc) return res.status(404).json({ error: 'No data found' });

        const chemistry = doc.subjects.find((s) => s.subject_name === 'Chemistry'); // Target 'Chemistry'
        if (!chemistry) return res.status(404).json({ error: 'Chemistry subject not found' });

        const chapter = chemistry.chapters.find((c) => c.chapter_id === chapterIdNum);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const subtopic = chapter.subtopics.find((st) => st.subtopic_id === subtopicIdNum);
        if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

        const {
            mcq = [],
            fillInTheBlanks = [],
            trueFalse = [],
            matchthefollowing = [],
            flashcard = [],
        } = subtopic.questions || {};

        if (
            !mcq.length &&
            !fillInTheBlanks.length &&
            !trueFalse.length &&
            !matchthefollowing.length &&
            !flashcard.length
        ) {
            return res.status(404).json({ error: 'No questions found for this subtopic' });
        }

        return res.json({ mcq, fillInTheBlanks, trueFalse, matchthefollowing, flashcard });
    } catch (err) {
        console.error('Error fetching questions:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// GET /chemistry/chapters/:chapterId/subtopics/:subtopicId/fillUps
export const getFillUpsBySubtopic = async (req, res) => {
    const { chapterId, subtopicId } = req.params;

    const chapterIdNum = Number(chapterId);
    const subtopicIdNum = Number(subtopicId);

    if (isNaN(chapterIdNum) || isNaN(subtopicIdNum)) {
        return res.status(400).json({ error: 'Invalid chapterId or subtopicId. Must be numbers.' });
    }

    try {
        const doc = await ChemistryPathway.findOne(); // Target ChemistryPathway

        if (!doc) {
            return res.status(404).json({ error: 'No data found' });
        }

        const chemistry = doc.subjects.find((s) => s.subject_name === 'Chemistry'); // Target 'Chemistry'
        if (!chemistry) {
            return res.status(404).json({ error: 'Chemistry subject not found' });
        }

        const chapter = chemistry.chapters.find((c) => c.chapter_id === chapterIdNum);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const subtopic = chapter.subtopics.find((st) => st.subtopic_id === subtopicIdNum);
        if (!subtopic) {
            return res.status(404).json({ error: 'Subtopic not found' });
        }

        const fillUps = subtopic.questions?.fillInTheBlanks || [];

        if (!fillUps.length) {
            return res.status(404).json({ error: 'No fill-in-the-blank questions found' });
        }

        return res.status(200).json(fillUps);
    } catch (err) {
        console.error('Error fetching fill-in-the-blank questions:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};