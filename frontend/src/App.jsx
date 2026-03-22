import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Activity, Clock, MousePointer, Globe, Search, ArrowRight, LayoutDashboard, Database, Zap, Sparkles } from 'lucide-react';

const App = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [journeyData, setJourneyData] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    // Fetch sessions
    fetch('http://localhost:8000/sessions')
      .then(res => res.json())
      .then(data => {
        setSessions(data);
        if (data.length > 0) setSelectedSession(data[0].session_id);
      })
      .catch(err => console.error("Error fetching sessions:", err));
  }, []);

  useEffect(() => {
    if (selectedSession) {
      setAiSummary(""); // Reset AI summary when session changes
      fetch(`http://localhost:8000/analytics/sessions/${selectedSession}/journey`)
        .then(res => res.json())
        .then(data => setJourneyData(data))
        .catch(err => console.error("Error fetching journey:", err));
    }
  }, [selectedSession]);

  const generateAiSummary = () => {
    if (!selectedSession) return;
    setIsAiLoading(true);
    fetch(`http://localhost:8000/analytics/sessions/${selectedSession}/ai-summary`)
      .then(res => res.json())
      .then(data => {
        setAiSummary(data.summary);
        setIsAiLoading(false);
      })
      .catch(err => {
        console.error("Error generating AI summary:", err);
        setIsAiLoading(false);
      });
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <Activity color="#007bff" size={32} />
          <h2 style={{ margin: 0 }}>Journey Miner</h2>
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px', fontWeight: 'bold' }}>SESSIONS</div>
        {sessions.map(s => (
          <div 
            key={s.session_id} 
            className={`session-item ${selectedSession === s.session_id ? 'active' : ''}`}
            onClick={() => setSelectedSession(s.session_id)}
          >
            <div style={{ fontSize: '14px', fontWeight: '500' }}>{s.session_id.substring(0, 12)}...</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Last active: {new Date(s.last_updated).toLocaleTimeString()}</div>
          </div>
        ))}
      </aside>

      <main className="main-content">
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Session Insights</h1>
            <p style={{ color: 'var(--text-muted)' }}>Analyzing user behavior patterns and cross-domain task flows.</p>
          </div>
          <button 
            className="ai-power-btn"
            onClick={generateAiSummary}
            disabled={isAiLoading}
          >
            {isAiLoading ? <Zap className="spinning" size={18} /> : <Sparkles size={18} />}
            AI POWER
          </button>
        </header>

        {aiSummary && (
          <div className="glass-card ai-insight-card animate" style={{ marginBottom: '40px', border: '1px solid rgba(0, 123, 255, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Zap color="#007bff" size={20} />
              <h3 style={{ margin: 0, color: '#007bff' }}>Gemini AI Analysis</h3>
            </div>
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary}</ReactMarkdown>
            </div>
          </div>
        )}

        {journeyData ? (
          <div className="animate">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '40px' }}>
              <div className="glass-card">
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Total Tasks</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{journeyData.tasks.length}</div>
              </div>
              <div className="glass-card">
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Event Density</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {(journeyData.tasks.reduce((acc, t) => acc + t.event_count, 0) / journeyData.tasks.length).toFixed(1)}
                </div>
              </div>
              <div className="glass-card">
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Dominant Intent</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '10px' }}>
                  {journeyData.tasks[0]?.intent || 'General'}
                </div>
              </div>
            </div>

            <h2>User Journey Map</h2>
            <div className="glass-card">
              {journeyData.tasks.map((task, idx) => (
                <div key={idx} className="timeline-event">
                  <div className="event-icon">
                    <Globe size={14} color="white" />
                  </div>
                  <div className="event-details">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>{task.domain}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         {task.events.some(e => e.metadata?.search_query) && (
                            <span className="badge" style={{ background: '#28a74522', color: '#28a745' }}>
                              <Search size={10} style={{ marginRight: '4px' }} />
                              {task.events.find(e => e.metadata?.search_query)?.metadata.search_query}
                            </span>
                         )}
                         <span className="badge">{task.intent}</span>
                      </div>
                    </div>
                    
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
                      {task.event_count} actions • {new Date(task.start_time).toLocaleTimeString()}
                      {task.events[0]?.metadata?.page_h1 && <span style={{ marginLeft: '12px', opacity: 0.8 }}>• {task.events[0].metadata.page_h1}</span>}
                    </div>

                    {task.events[0]?.metadata?.page_snippet && (
                      <div style={{ 
                        fontSize: '12px', 
                        fontStyle: 'italic', 
                        opacity: 0.6, 
                        marginBottom: '15px', 
                        paddingLeft: '10px', 
                        borderLeft: '2px solid rgba(255,255,255,0.1)' 
                      }}>
                        "{task.events[0].metadata.page_snippet.substring(0, 150)}..."
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                      {task.events.slice(0, 5).map((e, i) => (
                        <div key={i} style={{ 
                          fontSize: '11px', 
                          background: 'rgba(255,255,255,0.05)', 
                          padding: '6px 10px', 
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <span style={{ opacity: 0.6, marginRight: '4px' }}>{e.event_type}</span>
                          {e.metadata?.link_url ? (
                            <span style={{ color: '#007bff' }}>→ {new URL(e.metadata.link_url).hostname || 'link'}</span>
                          ) : (
                            <span>{e.metadata?.element || 'action'}</span>
                          )}
                        </div>
                      ))}
                      {task.event_count > 5 && <span style={{ opacity: 0.5, fontSize: '11px', alignSelf: 'center' }}>+{task.event_count - 5} more</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ marginTop: '40px' }}>Transition probabilities</h2>
            <div className="glass-card" style={{ height: '300px' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Markov Chain Visualization of event sequences (Next Step likelihood)</p>
               {/* Simplified graph placeholder */}
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
                 {Object.entries(journeyData.transitions).map(([from, toMap]) => (
                   Object.entries(toMap).map(([to, prob]) => (
                     <div key={`${from}-${to}`} style={{ 
                       background: `rgba(0, 123, 255, ${prob})`, 
                       padding: '10px', 
                       borderRadius: '8px',
                       fontSize: '12px',
                       border: '1px solid var(--border)'
                     }}>
                       {from} <ArrowRight size={12} /> {to} ({Math.round(prob * 100)}%)
                     </div>
                   )).slice(0, 2)
                 ))}
               </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
            <Database size={48} style={{ marginBottom: '16px' }} />
            <p>Select a session to explore the user journey map.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
