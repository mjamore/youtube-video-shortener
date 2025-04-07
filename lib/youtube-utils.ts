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

export function convertIsoDurationToMinutesSeconds(isoString: string): string | null {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = isoString.match(regex);

  if (!matches) {
    return null;
  }

  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseInt(matches[3] || '0', 10);

  const totalMinutes = hours * 60 + minutes;
  const formattedMinutes = String(totalMinutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  return `${formattedMinutes}:${formattedSeconds}`;
}