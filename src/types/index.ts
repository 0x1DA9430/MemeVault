export interface MemeImage {
  id: string;
  uri: string;
  fileName: string;
  createdAt: Date;
  tags: string[];
  description?: string;
} 