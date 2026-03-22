import pandas as pd
from datetime import timedelta

class JourneyProcessor:
    def __init__(self, events):
        self.events = sorted(events, key=lambda x: x['timestamp'])
        self.df = pd.DataFrame(self.events)

    def reconstruct_journeys(self):
        if self.df.empty:
            return []

        # Convert timestamp to datetime
        self.df['timestamp'] = pd.to_datetime(self.df['timestamp'])
        
        # Segment into tasks based on 5-minute inactivity or domain change
        self.df['time_diff'] = self.df['timestamp'].diff().dt.total_seconds()
        self.df['domain_change'] = self.df['domain'] != self.df['domain'].shift()
        
        # Trigger new task if diff > 300s or domain changed
        self.df['task_id'] = ((self.df['time_diff'] > 300) | self.df['domain_change']).cumsum()
        
        tasks = []
        for task_id, group in self.df.groupby('task_id'):
            # Keep original timestamps for start/end time calculation
            start_ts = group['timestamp'].iloc[0]
            end_ts = group['timestamp'].iloc[-1]
            
            # Convert to dict and drop internal NaNs
            task_events = group.drop(columns=['time_diff', 'domain_change', 'next_event'], errors='ignore').to_dict('records')
            
            # Serialize timestamps for the event list
            for e in task_events:
                if hasattr(e['timestamp'], 'isoformat'):
                    e['timestamp'] = e['timestamp'].isoformat()
                elif not isinstance(e['timestamp'], str):
                    e['timestamp'] = str(e['timestamp'])

            intent = self.infer_intent(task_events)
            tasks.append({
                "task_id": int(task_id),
                "start_time": start_ts.isoformat() if hasattr(start_ts, 'isoformat') else str(start_ts),
                "end_time": end_ts.isoformat() if hasattr(end_ts, 'isoformat') else str(end_ts),
                "domain": str(group['domain'].iloc[0]),
                "intent": intent,
                "event_count": len(task_events),
                "events": task_events
            })
        
        return tasks

    def infer_intent(self, events):
        # Enhanced heuristic using rich metadata
        urls = [e['url'] for e in events]
        event_types = [e['event_type'] for e in events]
        
        # Check for explicit search queries in metadata
        has_query = any(e.get('metadata', {}).get('search_query') for e in events)
        has_form_submission = "submit" in event_types
        has_deep_navigation = len(set(urls)) > 4
        
        # New Contextual Intent logic
        schema_types = [e.get('metadata', {}).get('page_schema', {}).get('type') for e in events if e.get('metadata', {}).get('page_schema')]
        headings = " ".join([h for e in events for h in (e.get('metadata', {}).get('page_headings') or [])]).lower()

        if "Product" in schema_types or "Offer" in schema_types or "price" in headings:
            return "Shopping / Ecommerce Analysis"
        if "Article" in schema_types or "NewsArticle" in schema_types or len(headings) > 200:
            return "Deep Content Consumption (Reading)"
        if has_query:
            return "Intent-driven Search: " + (events[0].get('metadata', {}).get('search_query') or "Query")
        if has_form_submission:
            return "Task Completion / Submission"
        if has_deep_navigation:
            return "Broad Discovery & Exploration"
        
        return "General Browsing"

    def get_transition_matrix(self):
        # Calculate state transitions [state_t -> state_t+1]
        if self.df.empty: return {}
        
        self.df['next_event'] = self.df['event_type'].shift(-1)
        transitions = self.df.dropna(subset=['next_event'])
        
        matrix = transitions.groupby(['event_type', 'next_event']).size().unstack(fill_value=0)
        # Normalize and fill NaNs
        matrix_prob = matrix.div(matrix.sum(axis=1), axis=0).fillna(0)
        
        # Ensure it's JSON serializable (standard floats)
        return {k: {sk: float(sv) for sk, sv in v.items()} for k, v in matrix_prob.to_dict().items()}
