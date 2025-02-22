export interface Meme {
  id: string;
  uri: string;
  title?: string;
  tags: string[];
  createdAt: Date;
  modifiedAt: Date;
  size: number;
  width: number;
  height: number;
  favorite: boolean;
}

export type MemeCollection = {
  id: string;
  name: string;
  memes: Meme[];
  createdAt: Date;
  modifiedAt: Date;
}

export interface TagSuggestion {
  tag: string;
  confidence: number;
  type: 'text' | 'emotion' | 'subject' | 'meaning';
}

export interface AutoTagSettings {
  enabled: boolean;
  apiKey: string;
  maxTags: number;
} 