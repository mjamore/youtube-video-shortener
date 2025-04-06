'use server'

import ytdl from '@distube/ytdl-core'
import fsPromises from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { VideoDownloadResult, VideoMetadata } from '@/types/video'

async function getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  console.log(`[Metadata] Fetching metadata for video ID: ${videoId}`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  
  try {
    console.log(`[Metadata] Getting video info from URL: ${videoUrl}`);
    const info = await ytdl.getInfo(videoUrl)
    
    const metadata = {
      title: info.videoDetails.title,
      duration: parseInt(info.videoDetails.lengthSeconds),
      author: info.videoDetails.author.name
    }
    
    console.log('[Metadata] Successfully retrieved metadata:', metadata);
    return metadata;
    
  } catch (error) {
    console.error('[Metadata] Error fetching video metadata:', error);
    if (error instanceof Error) {
      console.error('[Metadata] Error stack:', error.stack);
    }
    return null;
  }
}

export async function downloadYouTubeVideo(videoId: string): Promise<VideoDownloadResult> {
  console.log(`[Download] Starting download for video: ${videoId}`);
  const outputDir = path.join(process.cwd(), 'temp')
  const outputPath = path.join(outputDir, `${videoId}.mp4`)

  // Check if file already exists
  try {
    await fsPromises.access(outputPath)
    console.log(`[Download] Video already exists at: ${outputPath}`)
    return {
      success: true,
      filePath: outputPath
    }
  } catch {
    // File doesn't exist, proceed with download
  }

  try {
    const metadata = await getVideoMetadata(videoId)
    if (!metadata) {
      return { success: false, error: 'Invalid video ID' }
    }
    console.log(`[Download] Found video: "${metadata.title}" by ${metadata.author}`);

    await fsPromises.mkdir(outputDir, { recursive: true })
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath)
      const videoStream = ytdl(videoUrl, {
        quality: 'highest',
        filter: 'audioandvideo',
      })

      let lastProgress = 0
      videoStream.on('progress', (_, downloaded, total) => {
        const percentage = Math.floor(downloaded / total * 100)
        // Only log when percentage changes by 10% or more
        if (percentage >= lastProgress + 10) {
          console.log(`[Download] Progress: ${percentage}%`)
          lastProgress = percentage
        }
      })

      videoStream
        .pipe(writeStream)
        .on('finish', () => {
          console.log('[Download] Successfully downloaded video')
          resolve()
        })
        .on('error', (err) => {
          console.error('[Download] Failed to download:', err.message)
          reject(err)
        })

      writeStream.on('error', (err) => {
        console.error('[Download] Failed to write file:', err.message)
        reject(err)
      })
    })

    return {
      success: true,
      filePath: outputPath
    }
  } catch (error) {
    console.error('[Download] Error:', error instanceof Error ? error.message : 'Unknown error')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download video'
    }
  }
}
