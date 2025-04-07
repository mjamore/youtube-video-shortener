'use server'

import ytdl from '@distube/ytdl-core'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { PassThrough } from 'stream'
import { VideoDownloadResult } from '@/types/video'
import { YoutubeTranscript } from 'youtube-transcript';
import { youtube_v3 } from '@googleapis/youtube'
import { convertIsoDurationToMinutesSeconds } from '@/lib/youtube-utils'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'youtube-video-shortener'

const youtube = new youtube_v3.Youtube({
  auth: process.env.YOUTUBE_API_KEY,
})

async function getYouTubeMetadata(videoId: string) {
  try {
    const response = await youtube.videos.list({
      part: [
        'snippet',
        'contentDetails',
        // 'player' 
      ],
      id: [videoId],
    })

    const video = response.data.items?.[0]
    if (!video) {
      throw new Error('Video not found')
    }

    const duration = video?.contentDetails?.duration;

    return {
      title: (video.snippet?.localized?.title || video.snippet?.title) ?? 'Unknown Title',
      description: (video.snippet?.localized?.description || video.snippet?.description) ?? 'No description available',
      caption: video.contentDetails?.caption,
      duration: duration ? convertIsoDurationToMinutesSeconds(duration) : null, // ISO 8601 duration
      thumbnail: video.snippet?.thumbnails?.standard?.url,
    }
  } catch (error) {
    console.error('[YouTube API] Error fetching metadata:', error)
    throw error
  }
}

async function checkFileExistsInS3(bucket: string, key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFound') {
      console.log(`[S3] File does not exist: ${key}`)
      return false
    }
    return false
  }
}

export async function downloadYouTubeVideo(videoId: string): Promise<VideoDownloadResult> {
  console.log(`[Download] Starting process for video: ${videoId}`)
  const s3Key = `videos/full-length/${videoId}.mp4`
  
  try {
    // Fetch metadata first
    const metadataStart = Date.now();
    const metadata = await getYouTubeMetadata(videoId)
    const metadataEnd = Date.now();
    console.log(`[YouTube API] Fetching metadata took ${(metadataEnd - metadataStart) / 1000}s`);
    console.log('[YouTube API] Metadata:', metadata)
    
    // Fetch transcript
    const transcriptStart = Date.now();
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const transcriptEnd = Date.now();
    console.log(`[Transcript] Fetching transcript took ${(transcriptEnd - transcriptStart) / 1000}s`);
    console.log(`transcript: ${JSON.stringify(transcript)}`);

    // Check if file already exists in S3
    const checkS3Start = Date.now();
    const exists = await checkFileExistsInS3(BUCKET_NAME, s3Key)
    const checkS3End = Date.now();
    console.log(`[S3] Checking file existence in s3 took ${(checkS3End - checkS3Start) / 1000}s`);
    if (exists) {
      console.log('[Download] Video already exists in S3, skipping download')

      const totalTime = (
        (metadataEnd - metadataStart) +
        (transcriptEnd - transcriptStart) +
        (checkS3End - checkS3Start)
      ) / 1000;
      console.log(`Process Complete! Metadata Fetch: ${(metadataEnd - metadataStart) / 1000}s, Transcript Fetch: ${(transcriptEnd - transcriptStart) / 1000}s, S3 Check: ${(checkS3End - checkS3Start) / 1000}s, Total: ${totalTime}s`)

      return {
        success: true,
        filePath: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
      }
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
    const passThrough = new PassThrough()
    let downloadStart: number = 0
    let downloadEnd: number = 0
    let uploadEnd: number = 0

    // Start the upload to S3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: passThrough,
        ContentType: 'video/mp4'
      }
    })

    // Create video download stream
    downloadStart = Date.now()
    /**
     * Creates a video stream from a YouTube URL using the `ytdl` library.
     *
     * @param youtubeUrl - The URL of the YouTube video to download.
     * @returns A readable stream containing the video and audio data.
     *
     * The `quality` property specifies the desired quality of the video stream.
     * Available options for the `quality` property include:
     * - `'highest'`: Selects the highest quality available.
     * - `'lowest'`: Selects the lowest quality available.
     * - `'highestaudio'`: Selects the highest quality audio stream.
     * - `'lowestaudio'`: Selects the lowest quality audio stream.
     * - `'highestvideo'`: Selects the highest quality video stream.
     * - `'lowestvideo'`: Selects the lowest quality video stream.
     * - A specific itag value (e.g., `'18'`, `'137'`): Selects a stream with the specified itag.
     *
     * The `filter` property can also be used to further refine the stream selection.
     *
     * Note: If you want to retrieve only the video transcription or closed captioning,
     * you can use the `ytdl.getInfo` method to fetch video details and extract the
     * captions from the `info.player_response.captions` property. This requires
     * additional parsing and handling of the captions data.
     */
    const videoStream = ytdl(youtubeUrl, {
      quality: 'highest',
      filter: 'audioandvideo',
    })

    let lastProgress = 0
    videoStream.on('progress', (_, downloaded, total) => {
      const percentage = Math.floor(downloaded / total * 100)
      if (percentage >= lastProgress + 10) {
        console.log(`[Download] Progress: ${percentage}%`)
        lastProgress = percentage
      }
      if (percentage === 100) {
        downloadEnd = Date.now()
      }
    })

    // Pipe the video stream through to S3
    videoStream.pipe(passThrough)

    // Wait for upload to complete
    await upload.done()
    uploadEnd = Date.now()
    
    const downloadTime = ((downloadEnd - downloadStart) / 1000).toFixed(2)
    const uploadTime = ((uploadEnd - downloadEnd) / 1000).toFixed(2)
    const totalTime = (
      (metadataEnd - metadataStart) +
      (transcriptEnd - transcriptStart) +
      (checkS3End - checkS3Start) +
      (downloadEnd - downloadStart) +
      (uploadEnd - downloadEnd)
    ) / 1000
    
    console.log(`Process Complete! Metadata Fetch: ${(metadataEnd - metadataStart) / 1000}s, Transcript Fetch: ${(transcriptEnd - transcriptStart) / 1000}s, S3 Check: ${(checkS3End - checkS3Start) / 1000}s, Download: ${downloadTime}s, Upload: ${uploadTime}s, Total: ${totalTime}s`)

    return {
      success: true,
      filePath: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
    }
  } catch (error) {
    console.error('[Download] Error:', error instanceof Error ? error.message : 'Unknown error')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download video'
    }
  }
}
