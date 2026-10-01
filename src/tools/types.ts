import type { ComponentType } from 'react';
import type { Generation, Profile } from '@/lib/types';

export interface FormProps<I> {
  onSubmit: (input: I) => void;
  loading: boolean;
  initial?: Partial<I>;
  profile: Profile | null;
}

export interface ResultProps<O, I> {
  output: O;
  input: I;
  generation: Generation<O, I>;
  state: Record<string, any>;
  setState: (patch: Record<string, any>) => void;
}

export interface ToolModule<I = any, O = any> {
  Form: ComponentType<FormProps<I>>;
  Result: ComponentType<ResultProps<O, I>>;
  toMarkdown: (output: O, input: I) => string;
  tabs?: { id: string; label: string; Component: ComponentType }[];
  loadingMessages?: string[];
}
