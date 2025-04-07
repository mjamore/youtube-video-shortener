export interface ProcessVideoResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface VideoMetadata {
  title: string;
  duration: number;
  author: string;
}
