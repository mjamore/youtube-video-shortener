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
      return match[1]
    }
  }

  return null
}

/**
 * Gets video metadata from YouTube (in a real app)
 * This is a placeholder function
 */
export async function getVideoMetadata(videoId: string) {
  // In a real application, this would call the YouTube API
  // to get video metadata like title, duration, etc.

  // For this demo, we'll return mock data
  return {
    title: "Sample YouTube Video",
    duration: 600, // 10 minutes in seconds
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  }
}

