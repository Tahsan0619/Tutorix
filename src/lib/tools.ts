import {
  Brain, Calculator, CalendarClock, CalendarRange, ClipboardCheck, FileQuestion, GalleryVerticalEnd, KeyRound, Languages,
  Layers, Lightbulb, ListTodo, MessageSquareText, Network, NotebookPen, ScrollText, ShieldCheck, Split, Target, WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from './types';

export interface ToolMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  role: 'teacher' | 'student';
  icon: LucideIcon;
  gradient: string;
}

export const TEACHER_TOOLS: ToolMeta[] = [
  {
    id: 'blooms-analyzer', name: "Bloom's Taxonomy Analyzer", tagline: 'Single & bulk question analysis', role: 'teacher', icon: Layers,
    gradient: 'from-violet-500 to-indigo-600',
    description: 'Classify any question by cognitive level with evidence, or audit an entire question set for Bloom balance with charts and fixes.',
  },
  {
    id: 'lesson-plan', name: 'Lesson Plan Generator', tagline: 'Classroom-ready plans in minutes', role: 'teacher', icon: NotebookPen,
    gradient: 'from-sky-500 to-blue-600',
    description: 'Objectives, timed lesson flow, differentiation, assessment, misconceptions and homework, aligned and ready to teach.',
  },
  {
    id: 'rubric', name: 'Rubrics Generator', tagline: 'Analytic, holistic & single-point', role: 'teacher', icon: ClipboardCheck,
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Observable criteria, clear performance levels and point weights that always add up, plus a student self-check list.',
  },
  {
    id: 'question-worksheet', name: 'Question & Worksheet Generator', tagline: 'Question banks and printable worksheets', role: 'teacher', icon: FileQuestion,
    gradient: 'from-fuchsia-500 to-pink-600',
    description: 'Six question types across Bloom levels, from a topic or your own material, with answer key and print layout.',
  },
  {
    id: 'test-quality', name: 'Standardized Test Quality Tester', tagline: 'Audit items like a psychometrician', role: 'teacher', icon: ShieldCheck,
    gradient: 'from-amber-500 to-orange-600',
    description: 'Item-by-item flaw detection, quality dimensions, rewrites, and real item analysis (difficulty, discrimination, KR-20) from response data.',
  },
  {
    id: 'answer-key', name: 'Answer Key & Marking Scheme', tagline: 'Model answers with mark breakdowns', role: 'teacher', icon: KeyRound,
    gradient: 'from-rose-500 to-red-600',
    description: 'Paste any question paper to get model answers, point-by-point marks, acceptable alternatives and common mistakes.',
  },
  {
    id: 'differentiated', name: 'Differentiated Content Generator', tagline: 'One lesson, three readiness levels', role: 'teacher', icon: Split,
    gradient: 'from-cyan-500 to-sky-600',
    description: 'Rewrites a lesson or activity into Support, Core and Extension tiers with scaffolds, questions and ELL supports.',
  },
  {
    id: 'learning-objectives', name: 'Learning Objectives Generator', tagline: "SMART outcomes tagged by Bloom's", role: 'teacher', icon: Target,
    gradient: 'from-lime-500 to-green-600',
    description: 'Measurable objectives with SMART breakdowns, assessment ideas and student-friendly success criteria.',
  },
  {
    id: 'report-comments', name: 'Report Card & Feedback Comments', tagline: 'Personal comments for the whole class', role: 'teacher', icon: MessageSquareText,
    gradient: 'from-purple-500 to-violet-600',
    description: 'Enter scores and notes (or import CSV) and get unique, specific, growth-focused comments with next steps.',
  },
  {
    id: 'term-planner', name: 'Syllabus / Term Planner', tagline: 'Week-by-week scheme of work', role: 'teacher', icon: CalendarRange,
    gradient: 'from-indigo-500 to-blue-700',
    description: 'Spreads your syllabus across real term dates, skipping holidays, with objectives, activities and an assessment calendar.',
  },
];

export const STUDENT_TOOLS: ToolMeta[] = [
  {
    id: 'smart-notes', name: 'Smart Notes & Revision Sheets', tagline: 'Notes from a topic, text or PDF', role: 'student', icon: ScrollText,
    gradient: 'from-violet-500 to-indigo-600',
    description: 'Outline, Cornell or detailed notes, or a one-page revision sheet of formulas, definitions and exam tips.',
  },
  {
    id: 'todo', name: 'To-Do List Generator', tagline: 'Big goals → small doable tasks', role: 'student', icon: ListTodo,
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Breaks any goal into phased, prioritized tasks with time estimates and due dates you can tick off.',
  },
  {
    id: 'study-planner', name: 'Study Planner / Timetable', tagline: 'A realistic day-by-day schedule', role: 'student', icon: CalendarClock,
    gradient: 'from-sky-500 to-blue-600',
    description: 'Balances subjects by exam date, difficulty and confidence using spaced repetition and smart breaks.',
  },
  {
    id: 'flashcards', name: 'Flashcard Generator', tagline: 'Flip, study and track mastery', role: 'student', icon: GalleryVerticalEnd,
    gradient: 'from-fuchsia-500 to-pink-600',
    description: 'Creates flashcard decks from any topic or material, with a study mode that tracks what you know.',
  },
  {
    id: 'practice-quiz', name: 'Practice Quiz & Weak Topic Analyzer', tagline: 'Test yourself, find your gaps', role: 'student', icon: Brain,
    gradient: 'from-amber-500 to-orange-600',
    description: 'Take AI-generated quizzes with instant grading, then see exactly which topics need work and how to fix them.',
  },
  {
    id: 'mind-map', name: 'Mind Map Generator', tagline: 'See how ideas connect', role: 'student', icon: Network,
    gradient: 'from-cyan-500 to-sky-600',
    description: 'Turns a topic or notes into an interactive, collapsible concept map with notes on every branch.',
  },
  {
    id: 'concept-explainer', name: 'Concept Explainer', tagline: 'Understand anything, your level', role: 'student', icon: Lightbulb,
    gradient: 'from-yellow-500 to-amber-600',
    description: 'Clear explanations with analogies, examples, comparisons and self-checks. Then ask follow-up questions.',
  },
  {
    id: 'problem-solver', name: 'Step-by-Step Problem Solver', tagline: 'Learn the method, not just the answer', role: 'student', icon: Calculator,
    gradient: 'from-rose-500 to-red-600',
    description: 'Math and science solutions broken into reasoned steps with verification and a similar practice problem.',
  },
  {
    id: 'mnemonics', name: 'Mnemonic Generator', tagline: 'Memory tricks that stick', role: 'student', icon: WandSparkles,
    gradient: 'from-purple-500 to-violet-600',
    description: 'Acronyms, acrostic sentences, rhymes, stories and memory-palace images for any list or sequence.',
  },
  {
    id: 'vocabulary', name: 'Vocabulary Builder', tagline: 'Bangla ⇄ English word mastery', role: 'student', icon: Languages,
    gradient: 'from-lime-500 to-green-600',
    description: 'Meanings, IPA, Bangla translations, examples, synonyms and memory tips, plus a self-quiz mode.',
  },
];

export const ALL_TOOLS = [...TEACHER_TOOLS, ...STUDENT_TOOLS];

export function getTool(id: string | undefined) {
  return ALL_TOOLS.find((t) => t.id === id);
}

export function toolsForRole(role: Role | undefined) {
  if (role === 'teacher') return TEACHER_TOOLS;
  if (role === 'student') return STUDENT_TOOLS;
  if (role === 'admin') return ALL_TOOLS;
  return [];
}

export function canUseTool(role: Role | undefined, tool: ToolMeta) {
  return role === 'admin' || role === tool.role;
}
