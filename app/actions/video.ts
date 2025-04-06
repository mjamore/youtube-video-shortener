'use server'

import ytdl from '@distube/ytdl-core'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { PassThrough } from 'stream'
// import { VideoDownloadResult, VideoMetadata } from '@/types/video'
import { VideoDownloadResult } from '@/types/video'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'youtube-video-shortener'

// async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
//   console.log(`[Metadata] Fetching metadata for video ID: ${videoId}`);
//   const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  
//   try {
//     console.log(`[Metadata] Getting video info from URL: ${videoUrl}`);
//     const info = await ytdl.getInfo(videoUrl)
    
//     const metadata = {
//       title: info.videoDetails.title,
//       duration: parseInt(info.videoDetails.lengthSeconds),
//       author: info.videoDetails.author.name
//     }
    
//     console.log('[Metadata] Successfully retrieved metadata:', metadata);
//     return metadata;
    
//   } catch (error) {
//     console.error('[Metadata] Error fetching video metadata:', error);
//     if (error instanceof Error) {
//       console.error('[Metadata] Error stack:', error.stack);
//     }
//     return null;
//   }
// }

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
    // Check if file already exists in S3
    const exists = await checkFileExistsInS3(BUCKET_NAME, s3Key)
    if (exists) {
      console.log('[Download] Video already exists in S3, skipping download')
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
    const totalTime = ((uploadEnd - downloadStart) / 1000).toFixed(2)
    
    console.log(`[Download] Complete! Download: ${downloadTime}s, Upload: ${uploadTime}s, Total: ${totalTime}s`)

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
