import { getFunctionsInstance, httpsCallable } from '../core/firebase-init.js';
import ProgressService from './progress.service.js';

class QuizService {
  /**
   * Fetches quiz questions from the secure backend.
   * @param {string} moduleId - The ID of the module being tested.
   * @param {string|null} chapterId - Optional chapter ID for chapter-based quizzes.
   * @returns {Promise<Object>} The quiz payload from the backend.
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
   * @param {string} moduleId - The ID of the module being tested.
   * @param {Object} answers - A map of question IDs to the selected answer index.
   * @returns {Promise<Object>} The grading result including score and pass status.
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
