export interface Meme {
  id: string;
  uri: string;
  title?: string;
  tags?: string[];
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