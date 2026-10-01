import type { ToolModule } from './types';

type Loader = () => Promise<{ default: ToolModule }>;

export const toolLoaders: Record<string, Loader> = {
  'blooms-analyzer': () => import('./teacher/BloomsAnalyzer'),
  'lesson-plan': () => import('./teacher/LessonPlan'),
  rubric: () => import('./teacher/Rubric'),
  'question-worksheet': () => import('./teacher/QuestionWorksheet'),
  'test-quality': () => import('./teacher/TestQuality'),
  'answer-key': () => import('./teacher/AnswerKey'),
  differentiated: () => import('./teacher/Differentiated'),
  'learning-objectives': () => import('./teacher/LearningObjectives'),
  'report-comments': () => import('./teacher/ReportComments'),
  'term-planner': () => import('./teacher/TermPlanner'),
  'smart-notes': () => import('./student/SmartNotes'),
  todo: () => import('./student/Todo'),
  'study-planner': () => import('./student/StudyPlanner'),
  flashcards: () => import('./student/Flashcards'),
  'practice-quiz': () => import('./student/PracticeQuiz'),
  'mind-map': () => import('./student/MindMap'),
  'concept-explainer': () => import('./student/ConceptExplainer'),
  'problem-solver': () => import('./student/ProblemSolver'),
  mnemonics: () => import('./student/Mnemonics'),
  vocabulary: () => import('./student/Vocabulary'),
};
