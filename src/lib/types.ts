export type Role = 'teacher' | 'student' | 'admin';
export type Language = 'English' | 'Bangla' | 'Bilingual';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: 'active' | 'suspended';
  institution: string | null;
  grade_level: string | null;
  subject: string | null;
  language: Language;
  created_at: string;
}

export interface Generation<O = any, I = any> {
  id: string;
  user_id: string;
  tool: string;
  title: string;
  input: I;
  output: O;
  state: Record<string, any>;
  is_favorite: boolean;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  title: string;
  kind: 'pdf' | 'text';
  char_count: number;
  chunk_count: number;
  embedded_count: number;
  created_at: string;
}

/** How a generation used reference material: preloaded whole (cag) or retrieved passages (rag). */
export interface Grounding {
  mode: 'cag' | 'rag';
  sources: { title: string; used: number | 'full'; total: number }[];
  query: string;
  matched: number | null;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  generation_id: string | null;
  subject: string | null;
  topic: string | null;
  score: number;
  max_score: number;
  percentage: number;
  results: QuizResultItem[];
  created_at: string;
}

export interface QuizResultItem {
  id: string;
  subtopic: string;
  bloom_level: string;
  type: string;
  prompt: string;
  response: string;
  answer: string;
  awarded: number;
  max: number;
  correct: boolean;
  feedback?: string;
}

export const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];
