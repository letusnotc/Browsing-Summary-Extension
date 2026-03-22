import sys
import os
from pathlib import Path

# Add project root to path for local imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.append(str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
import motor.motor_asyncio
from pydantic import BaseModel, Field
import uuid
import math

def sanitize_json(data):
    """Recursively replace NaN, inf, -inf with None for JSON compliance."""
    if isinstance(data, dict):
        return {k: sanitize_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_json(i) for i in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
    return data

app = FastAPI(title="User Journey Mining API")

# Enable CORS for the extension and frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify extension ID and frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Configuration
MONGO_DETAILS = "mongodb://localhost:27017"
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client.journey_mining
events_collection = database.get_collection("events")
sessions_collection = database.get_collection("sessions")

# Models
class EventMetadata(BaseModel):
    element: Optional[str] = None
    xpath: Optional[str] = None
    selector: Optional[str] = None
    text: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    page_description: Optional[str] = None
    page_h1: Optional[str] = None
    page_headings: Optional[List[str]] = None
    page_snippet: Optional[str] = None
    page_schema: Optional[dict] = None
    search_query: Optional[str] = None
    form_data: Optional[dict] = None
    coordinates: Optional[dict] = None

class UserEvent(BaseModel):
    session_id: str
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    domain: str
    url: str
    page_title: str
    event_type: str
    metadata: Optional[EventMetadata] = None

class EventBatch(BaseModel):
    events: List[UserEvent]

# Endpoints
@app.post("/events/batch")
async def ingest_events(batch: EventBatch):
    if not batch.events:
        return {"status": "empty_batch"}
    
    # Insert events into MongoDB
    event_dicts = [event.model_dump() for event in batch.events]
    await events_collection.insert_many(event_dicts)
    
    # Update or create session metadata (simplified)
    for event in batch.events:
        await sessions_collection.update_one(
            {"session_id": event.session_id},
            {
                "$set": {"user_id": event.user_id, "last_updated": event.timestamp},
                "$setOnInsert": {"start_time": event.timestamp}
            },
            upsert=True
        )
    
    return {"status": "success", "count": len(batch.events)}

@app.get("/sessions")
async def list_sessions():
    sessions = []
    cursor = sessions_collection.find().sort("last_updated", -1)
    async for session in cursor:
        session["_id"] = str(session["_id"])
        sessions.append(session)
    return sessions

@app.get("/sessions/{session_id}/events")
async def get_session_events(session_id: str):
    events = []
    cursor = events_collection.find({"session_id": session_id}).sort("timestamp", 1)
    async for event in cursor:
        event["_id"] = str(event["_id"])
        events.append(event)
    return events

from analytics.processor import JourneyProcessor

# Existing models... (keep unchanged)

# Analytics Endpoint
@app.get("/analytics/sessions/{session_id}/journey")
async def get_journey(session_id: str):
    cursor = events_collection.find({"session_id": session_id}).sort("timestamp", 1)
    events = []
    async for event in cursor:
        event["_id"] = str(event["_id"])
        events.append(event)
    
    if not events:
        raise HTTPException(status_code=404, detail="No events found for session")
    
    processor = JourneyProcessor(events)
    journey = processor.reconstruct_journeys()
    transitions = processor.get_transition_matrix()
    
    return sanitize_json({
        "session_id": session_id,
        "tasks": journey,
        "transitions": transitions
    })

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# AI Endpoint
@app.get("/analytics/sessions/{session_id}/ai-summary")
async def get_ai_summary(session_id: str):
    cursor = events_collection.find({"session_id": session_id}).sort("timestamp", 1)
    events = []
    async for event in cursor:
        event["_id"] = str(event["_id"])
        events.append(event)
    
    if not events:
        raise HTTPException(status_code=404, detail="No events found for session")
    
    processor = JourneyProcessor(events)
    journey = processor.reconstruct_journeys()
    
    # Prepare data for Gemini with more context
    summary_input = []
    for task in journey:
        events_context = []
        for e in task['events'][:8]: # Increase event context
            meta = e.get('metadata', {})
            desc = f"{e['event_type']} on {meta.get('element') or 'page'}"
            if meta.get('text'): desc += f" (Content: '{meta['text'][:100]}')"
            if meta.get('link_url'): desc += f" (Link: {meta['link_url']})"
            events_context.append(desc)
            
        summary_input.append({
            "domain": task['domain'],
            "intent": task['intent'],
            "actions": events_context,
            "page_context": task.get('events', [{}])[0].get('metadata', {}).get('page_h1', '')
        })

    prompt = f"""
    You are a high-level browsing session analyst. Analyze this user journey:
    {summary_input}

    REQUIREMENTS:
    1) A 'Browsing Session Details' section with a proper Markdown table.
       Columns: | Domain | Page Context | Primary Intent | Key Actions |
    2) A 'Narrative Summary' (2-3 paragraphs) explaining the user's workflow, what they were looking for, and their probable objective.
    
    Be specific. If they were on Amazon searching for phones, mention that.
    """

    try:
        model = genai.GenerativeModel('gemini-2.5-flash') 
        response = model.generate_content(prompt)
        return {"summary": response.text}
    except Exception as e:
        print(f"Gemini Error: {e}")
        return {"summary": "AI summary failed. Please check your GOOGLE_API_KEY in the .env file."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
