'use server'

import ytdl from '@distube/ytdl-core'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { PassThrough } from 'stream'
import { ProcessVideoResult } from '@/types/video'
import { youtube_v3 } from '@googleapis/youtube'
import { convertIsoDurationToMinutesSeconds } from '@/lib/youtube-utils'
// import { Innertube } from 'youtubei.js/web';
import { YoutubeTranscript } from 'youtube-transcript'

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
      description: ((video.snippet?.localized?.description || video.snippet?.description) ?? 'No description available').slice(0, 200),
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

interface MetadataResult {
  metadata: {
    existedInS3: boolean;
    timeToCheckS3: number;
    timeToGetMetadataFromApi?: number;
    timeToUploadToS3?: number;
    data?: {
      title: string;
      description: string;
      caption: string | undefined;
      duration: string | null;
      thumbnail: string | undefined;
    };
  };
}

async function getOrCreateMetadata(videoId: string, s3Directory: string): Promise<MetadataResult> {
  const metadataKey = `${s3Directory}/metadata.json`;
  const s3CheckStart = Date.now();
  const existedInS3 = await checkFileExistsInS3(BUCKET_NAME, metadataKey);
  const timeToCheckS3 = Date.now() - s3CheckStart;

  if (existedInS3) {
    console.log('Metadata already exists in S3, skipping fetch');
    return {
      metadata: {
        existedInS3: true,
        timeToCheckS3,
      }
    };
  }

  const apiStart = Date.now();
  const rawMetadata = await getYouTubeMetadata(videoId);
  const timeToGetMetadataFromApi = Date.now() - apiStart;

  const data = {
    ...rawMetadata,
    caption: rawMetadata.caption ?? undefined,
    thumbnail: rawMetadata.thumbnail ?? undefined,
  };

  const uploadStart = Date.now();
  const metadataUpload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: metadataKey,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    },
  });
  await metadataUpload.done();
  const timeToUploadToS3 = Date.now() - uploadStart;

  return {
    metadata: {
      existedInS3: false,
      timeToCheckS3,
      timeToGetMetadataFromApi,
      timeToUploadToS3,
      data
    }
  };
}

interface TranscriptResult {
  transcript: {
    existedInS3: boolean;
    timeToCheckS3: number;
    timeToGetTranscriptFromApi?: number;
    timeToUploadToS3?: number;
    data?: Array<{
      text: string;
      duration: number;
      offset: number;
    }>;
  };
}

async function getOrCreateTranscript(videoId: string, s3Directory: string): Promise<TranscriptResult> {
  const transcriptKey = `${s3Directory}/transcript.json`;
  const s3CheckStart = Date.now();
  const existedInS3 = await checkFileExistsInS3(BUCKET_NAME, transcriptKey);
  const timeToCheckS3 = Date.now() - s3CheckStart;

  if (existedInS3) {
    console.log('[S3] Transcript already exists in S3, skipping fetch');
    return {
      transcript: {
        existedInS3: true,
        timeToCheckS3,
      }
    };
  }

  const apiStart = Date.now();
  const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
  const timeToGetTranscriptFromApi = Date.now() - apiStart;

  const data = rawTranscript.map(entry => ({
    ...entry,
    text: entry.text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' '),
  }));

  const uploadStart = Date.now();
  const transcriptUpload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: transcriptKey,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    },
  });
  await transcriptUpload.done();
  const timeToUploadToS3 = Date.now() - uploadStart;

  return {
    transcript: {
      existedInS3: false,
      timeToCheckS3,
      timeToGetTranscriptFromApi,
      timeToUploadToS3,
      data
    }
  };
}

export async function processYouTubeVideo(videoId: string, desiredDuration: number): Promise<ProcessVideoResult> {
  const s3Directory = `videos/${videoId}`;
  const timings: Record<string, number> = {};

  console.log(`desiredDuration: ${desiredDuration}`);

  try {
    // handle metadata
    const metadataResult = await getOrCreateMetadata(videoId, s3Directory);
    console.log('Metadata Operation completed:', metadataResult.metadata);
    
    if (!metadataResult.metadata.existedInS3) {
      timings.metadataFetch = metadataResult.metadata.timeToGetMetadataFromApi || 0;
      timings.metadataUpload = metadataResult.metadata.timeToUploadToS3 || 0;
    }
    timings.metadataS3Check = metadataResult.metadata.timeToCheckS3;

    // handle transcript
    const transcriptResult = await getOrCreateTranscript(videoId, s3Directory);
    console.log('Transcript Operation completed:', transcriptResult.transcript);

    if (!transcriptResult.transcript.existedInS3) {
      timings.transcriptFetch = transcriptResult.transcript.timeToGetTranscriptFromApi || 0;
      timings.transcriptUpload = transcriptResult.transcript.timeToUploadToS3 || 0;
    }
    timings.transcriptS3Check = transcriptResult.transcript.timeToCheckS3;

    // Check if video file already exists in S3
    const s3VideoKey = `${s3Directory}/${videoId}.mp4`;
    const checkS3Start = Date.now();
    const exists = await checkFileExistsInS3(BUCKET_NAME, s3VideoKey);
    timings.videoS3Check = Date.now() - checkS3Start;

    if (exists) {
      console.log('[Download] Video already exists in S3, skipping download');
      console.log('Timings:', timings);
      return {
        success: true,
        filePath: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3VideoKey}`,
      };
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const passThrough = new PassThrough();

    const downloadStart = Date.now();
    const videoStream = ytdl(youtubeUrl, {
      quality: 'highest',
      filter: 'audioandvideo',
    });

    let lastProgress = 0;
    videoStream.on('progress', (_, downloaded, total) => {
      const percentage = Math.floor((downloaded / total) * 100);
      if (percentage >= lastProgress + 10) {
        console.log(`[Download] Progress: ${percentage}%`);
        lastProgress = percentage;
      }
    });

    videoStream.pipe(passThrough);

    const uploadStart = Date.now();
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: s3VideoKey,
        Body: passThrough,
        ContentType: 'video/mp4',
      },
    });

    await upload.done();
    timings.download = Date.now() - downloadStart;
    timings.upload = Date.now() - uploadStart;

    console.log('Timings:', timings);
    return {
      success: true,
      filePath: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3VideoKey}`,
    };
  } catch (error) {
    console.log('Timings:', timings);
    console.error('[Download] Error:', error instanceof Error ? error.message : 'Unknown error');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download video',
    };
  }
}
