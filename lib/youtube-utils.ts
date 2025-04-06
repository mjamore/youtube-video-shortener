/**
 * Extracts the YouTube video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null

  // Handle various YouTube URL formats
  const regexPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/watch\?.*v=)([^#&?]*).*/,
    /(?:youtube\.com\/shorts\/)([^#&?]*).*/,
  ]

  for (const regex of regexPatterns) {
    const match = url.match(regex)
    if (match && match[1] && match[1].length === 11) {
      console.log(`match[1]: ${match[1]}`);
      return match[1]
    }
  }

  return null
}
