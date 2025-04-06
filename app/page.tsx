import { Suspense } from "react"
import VideoSummarizer from "@/components/video-summarizer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="border-none shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">AI Video Summarizer</CardTitle>
            <CardDescription className="text-lg">
              Enter a YouTube URL and desired duration to create an AI-summarized version
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading...</div>}>
              <VideoSummarizer />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

