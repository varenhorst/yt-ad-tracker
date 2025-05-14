from flask import Flask, jsonify
from youtube_transcript_api import YouTubeTranscriptApi
from google import genai
from flask import Flask
from flask_cors import CORS
import re
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def extract_json_from_gemini_response(text):
    """
    Extracts JSON data from a text string that might contain surrounding text.

    Args:
        text: The string containing the potential JSON data.

    Returns:
        A Python list or dictionary if valid JSON is found, otherwise None.
    """
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            print("Error decoding JSON from the matched block.")
            return None
    else:
        try:
            # Attempt to parse the entire string in case it's just JSON
            return json.loads(text)
        except json.JSONDecodeError:
            print("No JSON block found and failed to parse the entire string as JSON.")
            return None


@app.route('/get-transcripts/<video_id>')
def get_transcripts(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        # Replace with your actual Gemini API key
        client = genai.Client(api_key="")

        transcript_text = "\n".join([f"{entry['start']} - {entry['text']}" for entry in transcript])

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"""Identify timestamps for advertisements in the following transcript.
            Respond in JSON format each having a "start_time", "end_time", and optional "description".

            Transcript:
            {transcript_text}
            """
        )

         # Extract the JSON from Gemini's response
        extracted_data = extract_json_from_gemini_response(response.text)

        if extracted_data:
            return jsonify(extracted_data), 200
        else:
            return jsonify({"error": "Failed to extract JSON from Gemini response"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)