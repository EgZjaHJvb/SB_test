import Question from '../../../models/quiz/Questions.model.js';
import Flashcard from '../../../models/quiz/Flashcard.model.js';
import PhysicsPathway from '../../../models/quiz/physics/Physics.model.js';
import MathsPathway from '../../../models/quiz/maths/Maths.model.js';
import ChemistryPathway from '../../../models/quiz/chemistry/Chemistry.model.js';
import BiologyPathway from '../../../models/quiz/biology/Biology.model.js';
import VLSIPathway from '../../../models/quiz/vlsi/VLSI.model.js';

export const getFlashcardsBySubtopic = async (req, res) => {
    const { subject, chapterId, subtopicId } = req.params;

    if (!subject || !chapterId || !subtopicId) {
        return res.status(400).json({ error: 'subject, chapterId, and subtopicId are required' });
    }

    const chapterIdNum = Number(chapterId);
    const subtopicIdNum = Number(subtopicId);

    if (isNaN(chapterIdNum) || isNaN(subtopicIdNum)) {
        return res.status(400).json({ error: 'Invalid chapterId or subtopicId. Must be a number.' });
    }

    // Determine correct model based on subject
    let Model;
    switch (subject.toLowerCase()) {
        case 'physics':
            Model = PhysicsPathway;
            break;
        case 'maths':
        case 'math':
        case 'mathematics':
            Model = MathsPathway;
            break;
        case 'chemistry':
            Model = ChemistryPathway;
            break;
        case 'biology':
            Model = BiologyPathway;
            break;
         case 'vlsi':
            Model = VLSIPathway;
            break;
        default:
            return res.status(400).json({ error: 'Invalid subject. Must be Physics, Maths, CHemistry or Biology' });
    }

    try {
        const doc = await Model.findOne();
        if (!doc) return res.status(404).json({ error: 'No data found for the given subject' });

        const subjectData = doc.subjects.find((s) => s.subject_name.toLowerCase() === subject.toLowerCase());
        if (!subjectData) return res.status(404).json({ error: 'Subject not found in dataset' });

        const chapter = subjectData.chapters.find((c) => c.chapter_id === chapterIdNum);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const subtopic = chapter.subtopics.find((st) => st.subtopic_id === subtopicIdNum);
        if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

        const { flashcard = [] } = subtopic.questions || {};

        if (!flashcard.length) {
            return res.status(404).json({ error: 'No flashcards found for this subtopic' });
        }

        return res.json({
            subject: subjectData.subject_name,
            flashcards: flashcard
        });
    } catch (err) {
        console.error('Error fetching flashcards:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
