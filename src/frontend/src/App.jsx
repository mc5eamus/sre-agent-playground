import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = window.__API_BASE__ || "";

export default function App() {
  const [message, setMessage] = useState("Hello from Chaos Studio!");
  const [count, setCount] = useState(5);
  const [events, setEvents] = useState([]);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventsEndRef = useRef(null);
  const wsRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  // Connect to Web PubSub
  useEffect(() => {
    let ws;
    async function connect() {
      try {
        const res = await fetch(`${API_BASE}/api/negotiate`);
        if (!res.ok) throw new Error("Failed to negotiate");
        const { url } = await res.json();
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        };
        ws.onerror = () => setConnected(false);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("Received WebSocket message:", data);
            // Web PubSub wraps messages in a data envelope
            const payload = data.data ? JSON.parse(data.data) : data;
            setEvents((prev) => [
              ...prev,
              { ...payload, receivedAt: new Date().toISOString() },
            ]);
          } catch {
            // handle non-JSON messages
            setEvents((prev) => [
              ...prev,
              { raw: event.data, receivedAt: new Date().toISOString() },
            ]);
          }
        };
      } catch (err) {
        console.error("WebSocket connection error:", err);
        setError("Failed to connect to WebSocket. Retrying...");
        setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, count: parseInt(count, 10) }),
      });
      if (!res.ok) throw new Error("Failed to send messages");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>AKS Chaos Studio Demo</h1>

      <div style={styles.controlPanel}>
        <div style={styles.status}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: connected ? "#4caf50" : "#f44336",
            }}
          />
          {connected ? "Connected" : "Disconnected"}
        </div>

        <div style={styles.form}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message text"
            style={styles.input}
          />
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            min="1"
            max="100"
            style={{ ...styles.input, width: "80px" }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !message}
            style={styles.button}
          >
            {sending ? "Sending..." : "Send"}
          </button>
          <button
            onClick={() => setEvents([])}
            style={{ ...styles.button, backgroundColor: "#757575" }}
          >
            Clear
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
      </div>

      <div style={styles.eventsPanel}>
        <h2 style={styles.eventsTitle}>
          Events ({events.length})
        </h2>
        <div style={styles.eventsList}>
          {events.length === 0 && (
            <div style={styles.noEvents}>
              No events yet. Send a message to get started.
            </div>
          )}
          {events.map((evt, idx) => (
            <div key={idx} style={styles.eventItem}>
              <span style={styles.eventIndex}>#{idx + 1}</span>
              <span style={styles.eventMessage}>
                {evt.message || evt.raw || "Unknown"}
              </span>
              <span style={styles.eventMeta}>
                {evt.index}/{evt.total} | {evt.processingNode || ""}
              </span>
              <span style={styles.eventTime}>
                {evt.processedAt
                  ? new Date(evt.processedAt).toLocaleTimeString()
                  : ""}
              </span>
            </div>
          ))}
          <div ref={eventsEndRef} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "900px",
    margin: "0 auto",
    padding: "20px",
  },
  title: {
    textAlign: "center",
    color: "#1976d2",
  },
  controlPanel: {
    background: "#f5f5f5",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "20px",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
    fontSize: "14px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    display: "inline-block",
  },
  form: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    padding: "8px 12px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontSize: "14px",
    flex: "1",
    minWidth: "120px",
  },
  button: {
    padding: "8px 20px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#1976d2",
    color: "white",
    fontSize: "14px",
    cursor: "pointer",
  },
  error: {
    marginTop: "8px",
    color: "#d32f2f",
    fontSize: "14px",
  },
  eventsPanel: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    overflow: "hidden",
  },
  eventsTitle: {
    margin: 0,
    padding: "12px 16px",
    backgroundColor: "#1976d2",
    color: "white",
    fontSize: "16px",
  },
  eventsList: {
    height: "400px",
    overflowY: "auto",
    padding: "8px",
  },
  noEvents: {
    textAlign: "center",
    color: "#999",
    padding: "40px",
  },
  eventItem: {
    display: "flex",
    gap: "12px",
    padding: "8px",
    borderBottom: "1px solid #eee",
    fontSize: "13px",
    alignItems: "center",
  },
  eventIndex: {
    color: "#999",
    fontWeight: "bold",
    minWidth: "40px",
  },
  eventMessage: {
    flex: 1,
  },
  eventMeta: {
    color: "#666",
    fontSize: "12px",
    minWidth: "120px",
  },
  eventTime: {
    color: "#999",
    fontSize: "12px",
    minWidth: "80px",
  },
};
