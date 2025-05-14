# AI YouTube Sponsor Tracker
### AI YouTube Sponsor Tracker:

Chrome Extension, and Flask Backend. 

This fetches the transcript from the current youtube you are watching if available.
Then we use these transcripts to detect advertisement timing with Gemini. 

Advertisements are skipped, and shown on the progress bar with a description if available. 

All data is stored in Chrome's indexedDb, to reduce the # of fetches.

**Key Technologies (Planned/Used):**
* Python / Flask
* Google GenAI
* Chrome Libaries
* yt-transcripts-api
---

Steps: 
1.) install requiremnts from requirements.txt

2.) Run app.py

3.) Load /extention in ( chrome://extensions/ ) -> Load Unpacked

4.) Test out a video : ( https://www.youtube.com/watch?v=dwUdFfz75aQ ) 



