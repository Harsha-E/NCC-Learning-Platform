import { getFunctionsInstance, httpsCallable } from '../core/firebase-init.js';
import ContentService from './content.service.js'; // Added to fetch curriculum structure

class QuizService {
  /**
   * Aggregates all available quizzes (assessments) for the cadet's certificate.
   * @param {string} certificate - The cadet's certificate (e.g., 'A', 'B', 'C').
   * @returns {Promise<Array>} A flat list of available quiz objects.
   */
  async getAvailableQuizzes(certificate, wing) {
    try {
      // 1. Fetch all modules for the current certificate
      const modules = await ContentService.getModules(certificate, wing);
      const allQuizzes = [];

      // 2. Iterate through modules to find chapters (which serve as quiz topics)
      for (const mod of modules) {
        const chapters = await ContentService.getChapters(certificate, mod.id);
        
        chapters.forEach(chap => {
          // In NCC-v3, every chapter has a corresponding tactical assessment
          allQuizzes.push({
            moduleId: mod.id,
            chapterId: chap.id,
            moduleTitle: mod.title,
            title: `${chap.title} Assessment`,
            description: `Final tactical evaluation for the ${chap.title} phase.`,
            duration: 10, // Standard 10-minute duration
            questionCount: 10 // Standard 10-question evaluation
          });
        });
      }
      
      return allQuizzes;
    } catch (error) {
      console.error('[QuizService] Error aggregating available quizzes:', error);
      throw error;
    }
  }

  /**
   * Fetches quiz questions from the secure backend.
   */
  async fetchQuestions(moduleId, chapterId = null) {
    try {
      const functions = getFunctionsInstance();
      const getQuizQuestions = httpsCallable(functions, 'getQuizQuestions');
      const response = await getQuizQuestions({ moduleId, chapterId });
      return response.data || { questions: [] };
    } catch (error) {
      console.error('Error fetching quiz questions:', error);
      throw new Error('Failed to load quiz questions from the secure backend.');
    }
  }

  /**
   * Submits quiz answers to the backend for validation and grading.
   */
  async submitQuiz(moduleId, answers) {
    try {
      const functions = getFunctionsInstance();
      const validateQuizSubmit = httpsCallable(functions, 'validateQuizSubmit');
      const response = await validateQuizSubmit({ moduleId, answers });
      return response.data;
    } catch (error) {
      console.error('Error submitting quiz:', error);
      throw error;
    }
  }
}

export default new QuizService();
