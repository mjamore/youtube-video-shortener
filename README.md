# YouTube Video Shortener
This is an application that allows you to enter a YouTube URL and a desired video length, and the application will will extract the most important parts of the original video and create a shortened video based on your desired length.

### TO-DO:
- [] Update processing state to show estimated time
- [] Reenable getting of metadata, including description, closed captioning?
  - [] Extract the transcript from the youtube video
- [] Pass the transcript to an AI model along with the desired length and get back the important parts of the transcripts with their timestamps
- [] From the full length file in s3, make a video clip for each timestamp range returned from AI response
- [] Stitch the clips back together and save new file to s3
- [] Display the new video file on the webpage

### Completed:
- [x] Save downloaded videos to AWS storage bucket