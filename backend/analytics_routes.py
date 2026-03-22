from analytics.processor import JourneyProcessor
from backend.main import app, events_collection, sessions_collection
from fastapi import APIRouter

router = APIRouter(prefix="/analytics")

@router.get("/sessions/{session_id}/journey")
async def get_journey(session_id: str):
    cursor = events_collection.find({"session_id": session_id}).sort("timestamp", 1)
    events = []
    async for event in cursor:
        event["_id"] = str(event["_id"])
        events.append(event)
    
    if not events:
        return {"error": "No events found for session"}
    
    processor = JourneyProcessor(events)
    journey = processor.reconstruct_journeys()
    transitions = processor.get_transition_matrix()
    
    return {
        "session_id": session_id,
        "tasks": journey,
        "transitions": transitions
    }

app.include_router(router)
