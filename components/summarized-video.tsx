"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import VideoPlayer from "@/components/video-player"

interface SummarizedVideoProps {
  videoId: string
  targetDuration: number
}

interface VideoSegment {
  id: number
  startTime: number
  endTime: number
  title: string
  importance: "high" | "medium" | "low"
}

export default function SummarizedVideo({ videoId, targetDuration }: SummarizedVideoProps) {
  const [segments, setSegments] = useState<VideoSegment[]>([])
  const [activeSegment, setActiveSegment] = useState<number | null>(null)

  useEffect(() => {
    // In a real application, this would come from the AI analysis
    // Here we're generating fake segments based on the target duration
    const generateSegments = () => {
      // Convert minutes to seconds
      const totalSeconds = targetDuration * 60

      // Create 3-5 segments depending on duration
      const segmentCount = Math.max(3, Math.min(5, Math.floor(targetDuration * 1.5)))

      // Average segment length
      const avgSegmentLength = totalSeconds / segmentCount

      const newSegments: VideoSegment[] = []
      let currentTime = 0

      for (let i = 0; i < segmentCount; i++) {
        // Vary segment length slightly
        const variance = avgSegmentLength * 0.3 // 30% variance
        const segmentLength = avgSegmentLength + (Math.random() * variance * 2 - variance)

        const startTime = Math.floor(currentTime)
        currentTime += segmentLength
        const endTime = Math.floor(currentTime)

        // Assign importance - make sure we have at least one high importance segment
        let importance: "high" | "medium" | "low"
        if (i === 0) {
          importance = "high"
        } else {
          const rand = Math.random()
          if (rand > 0.7) importance = "high"
          else if (rand > 0.3) importance = "medium"
          else importance = "low"
        }

        newSegments.push({
          id: i,
          startTime,
          endTime,
          title: getSegmentTitle(i),
          importance,
        })
      }

      setSegments(newSegments)
      setActiveSegment(0) // Set first segment as active
    }

    generateSegments()
  }, [videoId, targetDuration])

  // Generate fake segment titles
  const getSegmentTitle = (index: number) => {
    const titles = [
      "Introduction and Overview",
      "Key Concept Explanation",
      "Main Point Discussion",
      "Important Example",
      "Critical Analysis",
      "Summary of Findings",
      "Practical Application",
      "Expert Perspective",
      "Conclusion and Takeaways",
    ]

    return titles[index % titles.length]
  }

  // Get importance badge color
  const getImportanceColor = (importance: "high" | "medium" | "low") => {
    switch (importance) {
      case "high":
        return "bg-red-100 text-red-800 hover:bg-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 hover:bg-green-200"
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">AI Summary</TabsTrigger>
          <TabsTrigger value="original">Original Video</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            {activeSegment !== null && segments[activeSegment] && (
              <VideoPlayer
                videoId={videoId}
                startTime={segments[activeSegment].startTime}
                endTime={segments[activeSegment].endTime}
                autoplay={true}
              />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium">Key Segments</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Our AI identified these {segments.length} segments as the most important parts of the video.
            </p>

            <div className="grid gap-2">
              {segments.map((segment, index) => (
                <Card
                  key={segment.id}
                  className={`cursor-pointer transition-all ${activeSegment === index ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setActiveSegment(index)}
                >
                  <CardContent className="p-3 flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{segment.title}</span>
                        <Badge className={getImportanceColor(segment.importance)} variant="outline">
                          {segment.importance}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}(
                        {formatDuration(segment.endTime - segment.startTime)})
                      </p>
                    </div>
                    {activeSegment === index && <div className="h-2 w-2 rounded-full bg-primary"></div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="original">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            <VideoPlayer videoId={videoId} />
          </div>
          <p className="text-sm text-muted-foreground mt-2">This is the original video without AI summarization.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper function to format time as MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`
  } else {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }
}

