// controllers/quiz/vlsi/vlsi.controller.js

import VLSIPathway from '../../../models/quiz/vlsi/VLSI.model.js';
import Question from '../../../models/quiz/Questions.model.js';

// GET /vlsi/chapters
export const getAllChapters = async (req, res) => {
  try {
    const vlsiDoc = await VLSIPathway.findOne(
      { 'subjects.subject_name': 'VLSI' },  // <-- updated here
      { 'subjects.$': 1 }
    );

    if (!vlsiDoc || !vlsiDoc.subjects?.length) {
      return res.status(404).json({ error: 'VLSI subject not found' });
    }

    const vlsiSubject = vlsiDoc.subjects[0];

    const chapterList = vlsiSubject.chapters.map(({ chapter_id, chapter_name }) => ({
      chapter_id,
      chapter_name,
    }));

    res.status(200).json(chapterList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /vlsi/chapters/:chapterId
export const getChapterById = async (req, res) => {
  const { chapterId } = req.params;

  if (!chapterId) {
    return res.status(400).json({ error: 'Chapter Id is required' });
  }

  try {
    const result = await VLSIPathway.aggregate([
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

// GET /vlsi/chapters/:chapterId/subtopics
export const getSubtopicsByChapter = async (req, res) => {
  const { chapterId } = req.params;

  if (!chapterId || isNaN(Number(chapterId))) {
    return res.status(400).json({ error: 'Valid chapterId is required' });
  }

  try {
    const result = await VLSIPathway.aggregate([
      { $unwind: '$subjects' },
      { $match: { 'subjects.subject_name': 'VLSI' } },  // <-- updated here
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

// GET /vlsi/chapters/:chapterId/subtopics/:subtopicId
export const getAllQuestionsBySubtopic = async (req, res) => {
  const { chapterId, subtopicId } = req.params;

  if (!chapterId || !subtopicId) {
    return res.status(400).json({ error: 'chapterId and subtopicId are required' });
  }

  const chapterIdNum = Number(chapterId);
  const subtopicIdNum = Number(subtopicId);

  if (isNaN(chapterIdNum) || isNaN(subtopicIdNum)) {
    return res.status(400).json({ error: 'Invalid chapterId or subtopicId. Must be a number.' });
  }

  try {
    const doc = await VLSIPathway.findOne();

    if (!doc) return res.status(404).json({ error: 'No data found' });

    // updated subject_name to 'VLSI' here:
    const vlsi = doc.subjects.find((s) => s.subject_name === 'VLSI');
    if (!vlsi) return res.status(404).json({ error: 'VLSI subject not found' });

    const chapter = vlsi.chapters.find((c) => c.chapter_id === chapterIdNum);
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

// GET /vlsi/chapters/:chapterId/subtopics/:subtopicId/fillUps
export const getFillUpsBySubtopic = async (req, res) => {
  const { chapterId, subtopicId } = req.params;

  try {
    const tagQuery = [`chapter:${chapterId}`, `subtopic:${subtopicId}`];

    const questions = await Question.find({
      tags: { $all: tagQuery },
      type: 'fillblank',
    });

    if (!questions.length) {
      return res.status(404).json({ error: 'No fill-in-the-blank questions found' });
    }

    res.json(questions);
  } catch (err) {
    console.error('Error fetching fill-in-the-blank questions:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// GET /vlsi/chapters/:chapterId/subtopics/:subtopicId/flashcards
export const getFlashcardsBySubtopic = async (req, res) => {
  const { chapterId, subtopicId } = req.params;

  if (!chapterId || !subtopicId) {
    return res.status(400).json({ error: 'chapterId and subtopicId are required' });
  }

  const chapterIdNum = Number(chapterId);
  const subtopicIdNum = Number(subtopicId);

  if (isNaN(chapterIdNum) || isNaN(subtopicIdNum)) {
    return res.status(400).json({ error: 'Invalid chapterId or subtopicId. Must be a number.' });
  }

  try {
    const doc = await VLSIPathway.findOne();

    if (!doc) return res.status(404).json({ error: 'No data found' });

    const vlsi = doc.subjects.find((s) => s.subject_name === 'VLSI');
    if (!vlsi) return res.status(404).json({ error: 'VLSI subject not found' });

    const chapter = vlsi.chapters.find((c) => c.chapter_id === chapterIdNum);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const subtopic = chapter.subtopics.find((st) => st.subtopic_id === subtopicIdNum);
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

    const flashcards = subtopic.questions?.flashcard || [];

    if (flashcards.length === 0) {
      return res.status(404).json({ error: 'No flashcards found for this subtopic' });
    }

    return res.json({ flashcards });
  } catch (err) {
    console.error('Error fetching flashcards:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

