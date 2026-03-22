import requests
import json
import time
import random
from datetime import datetime, timedelta

BACKEND_URL = "http://localhost:8000/events/batch"

def generate_sample_journey():
    session_id = f"demo_sess_{random.randint(1000, 9999)}"
    user_id = "user_demo_1"
    
    # 1. Google Search
    events = []
    base_time = datetime.utcnow() - timedelta(minutes=30)
    
    events.append({
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": (base_time).isoformat(),
        "domain": "google.com",
        "url": "https://www.google.com/search?q=how+to+use+fastapi",
        "page_title": "how to use fastapi - Google Search",
        "event_type": "input",
        "metadata": {"element": "INPUT", "text": "how to use fastapi"}
    })
    
    # 2. Click Result
    events.append({
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": (base_time + timedelta(seconds=15)).isoformat(),
        "domain": "google.com",
        "url": "https://www.google.com/search?q=how+to+use+fastapi",
        "page_title": "how to use fastapi - Google Search",
        "event_type": "click",
        "metadata": {"element": "A", "text": "FastAPI Documentation", "xpath": "//*[@id='rso']/div[1]/div/div/div/div/div/a"}
    })
    
    # 3. Documentation Page
    events.append({
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": (base_time + timedelta(seconds=45)).isoformat(),
        "domain": "fastapi.tiangolo.com",
        "url": "https://fastapi.tiangolo.com/tutorial/first-steps/",
        "page_title": "First Steps - FastAPI",
        "event_type": "scroll",
        "metadata": {"element": "BODY"}
    })
    
    # 4. Copy Code
    events.append({
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": (base_time + timedelta(seconds=120)).isoformat(),
        "domain": "fastapi.tiangolo.com",
        "url": "https://fastapi.tiangolo.com/tutorial/first-steps/",
        "page_title": "First Steps - FastAPI",
        "event_type": "copy",
        "metadata": {"element": "PRE", "text": "from fastapi import FastAPI..."}
    })
    
    # 5. Open GitHub
    events.append({
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": (base_time + timedelta(seconds=300)).isoformat(),
        "domain": "github.com",
        "url": "https://github.com/new",
        "page_title": "Create a New Repository",
        "event_type": "paste",
        "metadata": {"element": "TEXTAREA"}
    })
    
    # 6. Submit
    events.append({
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": (base_time + timedelta(seconds=350)).isoformat(),
        "domain": "github.com",
        "url": "https://github.com/new",
        "page_title": "Create a New Repository",
        "event_type": "submit",
        "metadata": {"element": "FORM"}
    })

    print(f"Sending batch for {session_id}...")
    try:
        resp = requests.post(BACKEND_URL, json={"events": events})
        print(f"Response: {resp.status_code}, {resp.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_sample_journey()
