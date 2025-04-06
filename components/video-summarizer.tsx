"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Clock, Scissors, Play } from "lucide-react"
import { extractVideoId } from "@/lib/youtube-utils"
import VideoPlayer from "@/components/video-player"
import SummarizedVideo from "@/components/summarized-video"
import { downloadYouTubeVideo } from "@/app/actions/video"

export default function VideoSummarizer() {
  const [url, setUrl] = useState("")
  const [duration, setDuration] = useState(2)
  const [videoId, setVideoId] = useState("")
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [activeTab, setActiveTab] = useState("input")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const id = extractVideoId(url)
      if (!id) {
        setError("Invalid YouTube URL. Please enter a valid YouTube URL.")
        return
      }

      setVideoId(id)
      setIsProcessing(true)
      setActiveTab("processing")

      // Download the video first
      const downloadResult = await downloadYouTubeVideo(id)
      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Failed to download video')
      }

      console.log(`Key Segments: ${downloadResult.filePath}`)

      // Then process the summarization
      await processSummarization(id, duration)

      setIsProcessing(false)
      setIsComplete(true)
      setActiveTab("result")
    } catch (err) {
      console.error(`Error:`, err)
      setError(err instanceof Error ? err.message : "An error occurred while processing the video.")
      setIsProcessing(false)
    }
  }

  // Simulate AI processing with a delay
  const processSummarization = async (videoId: string, targetDuration: number) => {
    // In a real app, this would call a server action or API endpoint that processes the video with AI
    console.log(`videoId: ${videoId}`)
    console.log(`targetDuration: ${targetDuration}`)
    return new Promise((resolve) => {
      // Simulate processing time (3-5 seconds)
      const processingTime = 3000 + Math.random() * 2000
      setTimeout(resolve, processingTime)
    })
  }

  const resetForm = () => {
    setUrl("")
    setDuration(2)
    setVideoId("")
    setIsComplete(false)
    setActiveTab("input")
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="input" disabled={isProcessing}>
          Input
        </TabsTrigger>
        <TabsTrigger value="processing" disabled={!isProcessing && !isComplete}>
          Processing
        </TabsTrigger>
        <TabsTrigger value="result" disabled={!isComplete}>
          Result
        </TabsTrigger>
      </TabsList>

      <TabsContent value="input" className="space-y-6 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube Video URL</Label>
            <Input
              id="youtube-url"
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="duration">Target Duration (minutes)</Label>
              <span className="text-sm font-medium">{duration} min</span>
            </div>
            <Slider
              id="duration"
              min={1}
              max={10}
              step={1}
              value={[duration]}
              onValueChange={(value) => setDuration(value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 min</span>
              <span>5 min</span>
              <span>10 min</span>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full">
            <Scissors className="mr-2 h-4 w-4" />
            Summarize Video
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="processing" className="py-6">
        <div className="space-y-8">
          {videoId && (
            <div className="aspect-video w-full overflow-hidden rounded-lg border">
              <VideoPlayer videoId={videoId} />
            </div>
          )}

          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="flex items-center justify-center h-20 w-20 rounded-full bg-primary/10">
                {isProcessing ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                  <Clock className="h-10 w-10 text-primary" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium">
                  {isProcessing ? "AI is analyzing your video" : "Processing complete!"}
                </h3>
                <p className="text-muted-foreground">
                  {isProcessing
                    ? "Our AI is identifying the most important parts of your video to create a concise summary."
                    : "Your summarized video is ready to view."}
                </p>
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary animate-pulse" style={{ width: "60%" }}></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Analyzing content</span>
                  <span>Generating summary</span>
                </div>
              </div>
            )}

            {!isProcessing && (
              <Button className="w-full" onClick={() => setActiveTab("result")}>
                <Play className="mr-2 h-4 w-4" />
                View Summarized Video
              </Button>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="result" className="py-6">
        {isComplete && (
          <div className="space-y-8">
            <SummarizedVideo videoId={videoId} targetDuration={duration} />

            <div className="space-y-4">
              <h3 className="text-xl font-medium">AI Summary Explanation</h3>
              <p className="text-muted-foreground">
                Our AI analyzed the video content and identified the most important segments based on:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Key points and main ideas</li>
                <li>Visual importance of scenes</li>
                <li>Speech content and emphasis</li>
                <li>Audience engagement signals</li>
                <li>Narrative structure and transitions</li>
              </ul>

              <div className="pt-4">
                <Button onClick={resetForm} variant="outline" className="w-full">
                  Summarize Another Video
                </Button>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

