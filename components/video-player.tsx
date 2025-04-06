"use client"

import { useRef } from "react"

interface VideoPlayerProps {
  videoId: string
  startTime?: number
  endTime?: number
  autoplay?: boolean
}

export default function VideoPlayer({ videoId, startTime, endTime, autoplay = false }: VideoPlayerProps) {
  const playerRef = useRef<HTMLIFrameElement>(null)

  // Build the YouTube embed URL with parameters
  const getEmbedUrl = () => {
    let url = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`

    if (autoplay) {
      url += "&autoplay=1"
    }

    if (startTime !== undefined) {
      url += `&start=${startTime}`
    }

    if (endTime !== undefined) {
      url += `&end=${endTime}`
    }

    return url
  }

  return (
    <iframe
      ref={playerRef}
      width="100%"
      height="100%"
      src={getEmbedUrl()}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="absolute inset-0"
    ></iframe>
  )
}

