# LED Sign Harper Integration Design

**Date:** 2026-01-06
**Status:** Approved
**Author:** Design Session with Ivan

## Overview

Refactor the Vue LED sign control interface to use Harper as the central data store and MQTT broker. The Vue component will read and write directly to Harper's database via REST API, with real-time updates via Server-Sent Events (SSE). Harper automatically syncs between its Topics table and MQTT messages.

## Goals

1. Use Harper as single source of truth for LED sign state
2. Enable bidirectional real-time sync between Vue UI and LED signs
3. Support multiple LED signs with generic topic-based architecture
4. Maintain existing Vue UI appearance (no visual changes)
5. Minimize implementation complexity (leverage Harper's built-in capabilities)

## Architecture

### System Components

1. **Harper (Database + MQTT Broker)**
   - Acts as MQTT broker (enabled by default)
   - Persists MQTT state in Topics table
   - Exposes REST API for CRUD operations
   - Provides SSE for real-time updates
   - Automatically syncs: MQTT ↔ Database

2. **LED Signs (MQTT Clients)**
   - Connect directly to Harper's MQTT broker
   - Subscribe to: `led-sign/<sign_id>/#`
   - Publish state updates to same topics
   - Topics:
     - `led-sign/<sign_id>/message` - Display text
     - `led-sign/<sign_id>/brightness` - 0-15 integer
     - `led-sign/<sign_id>/power` - "on" or "off"

3. **Vue Frontend**
   - Connects to Harper via REST + SSE
   - Optimistic UI updates (instant feedback)
   - SSE provides real-time state sync
   - Same visual design, functional wiring

### Topics Table Schema

```graphql
type Topics @table @export (name: "") {
  topic: String @primaryKey
  value: String
  updated_at: DateTime
}
```

**Design Decisions:**
- Minimal schema (just topic path and value)
- Generic structure supports any MQTT device
- Primary key on `topic` ensures uniqueness
- `@export` enables REST API auto-generation

## Data Flow

### Write Path (User → LED Sign)

1. **User Action** - User changes value in Vue UI (message, brightness, power)
2. **Optimistic Update** - Vue immediately updates local state for instant feedback
3. **REST API Call** - Vue sends `PUT /Topics/<topic-path>` with new value
4. **Harper Persists** - Harper updates Topics table in database
5. **MQTT Publish** - Harper automatically publishes to MQTT topic
6. **LED Sign Updates** - Sign receives MQTT message and updates display/state

**Example:**
```
User types "Hello World" →
Vue updates UI immediately →
PUT /Topics/led-sign/2FE598/message { value: "Hello World" } →
Harper saves to database →
Harper publishes to MQTT topic led-sign/2FE598/message →
LED sign receives and displays message
```

### Read Path (LED Sign → User)

1. **LED Sign Publishes** - Sign publishes state to Harper MQTT broker
   - On startup, state change, or periodic heartbeat
2. **Harper Receives** - Harper's MQTT broker receives message
3. **Database Update** - Harper automatically updates Topics table
4. **SSE Broadcast** - Harper sends update event to connected SSE clients
5. **Vue Receives** - Vue's SSE listener receives update event
6. **UI Sync** - Vue updates component state to match actual sign state

**Example:**
```
LED sign boots up →
Publishes "on" to led-sign/2FE598/power →
Harper updates Topics table →
SSE event sent to Vue →
Vue updates power toggle to ON
```

### Initial State Load

On Vue component mount:
1. Vue makes GET requests to fetch current topic values
2. Populates UI with actual LED sign state from Harper
3. Opens SSE connection for ongoing updates

## Implementation Details

### Harper Changes

**1. Update schema.graphql:**
```graphql
type Topics @table @export (name: "") {
  topic: String @primaryKey
  value: String
  updated_at: DateTime
}
```

**That's it!** No other Harper changes needed.

Harper automatically provides:
- MQTT broker (port 1883, enabled by default)
- REST API endpoints (config.yaml already has REST enabled)
- MQTT ↔ Database sync
- SSE/real-time subscriptions

### Vue Changes

**1. Create API Service (`src/services/harperApi.js`):**

```javascript
const HARPER_URL = import.meta.env.VITE_HARPER_URL || 'http://localhost:9926'
const SIGN_ID = import.meta.env.VITE_SIGN_ID || '2FE598'

// Helper to build topic paths
export function buildTopic(property) {
  return `led-sign/${SIGN_ID}/${property}`
}

// Update topic value (triggers MQTT publish)
export async function updateTopic(topic, value) {
  const response = await fetch(`${HARPER_URL}/Topic/${encodeURIComponent(topic)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  })
  if (!response.ok) throw new Error('Failed to update topic')
  return response.json()
}

// Get current topic value
export async function getTopic(topic) {
  const response = await fetch(`${HARPER_URL}/Topic/${encodeURIComponent(topic)}`)
  if (!response.ok) return null
  return response.json()
}

// Subscribe to real-time updates
export function subscribeToTopics(callback) {
  const eventSource = new EventSource(`${HARPER_URL}/subscribe?table=Topic`)

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    callback(data)
  }

  eventSource.onerror = (error) => {
    console.error('SSE error:', error)
  }

  return eventSource // Return for cleanup
}
```

**2. Wire Up App.vue Methods:**

```javascript
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { updateTopic, getTopic, buildTopic, subscribeToTopics } from './services/harperApi'

// In setup()...

let sseConnection = null

// Load initial state from Harper
async function loadInitialState() {
  const [msgData, brightData, powerData] = await Promise.all([
    getTopic(buildTopic('message')),
    getTopic(buildTopic('brightness')),
    getTopic(buildTopic('power'))
  ])

  if (msgData) currentMessage.value = msgData.value
  if (brightData) brightness.value = parseInt(brightData.value)
  if (powerData) displayPower.value = powerData.value === 'on'
}

// Handle SSE updates
function handleSSEUpdate(data) {
  const { topic, value } = data

  if (topic === buildTopic('message')) {
    currentMessage.value = value
  } else if (topic === buildTopic('brightness')) {
    brightness.value = parseInt(value)
  } else if (topic === buildTopic('power')) {
    displayPower.value = value === 'on'
  }
}

// Wire up existing methods
async function sendMessage() {
  currentMessage.value = message.value // Optimistic
  await updateTopic(buildTopic('message'), message.value)
  message.value = '' // Clear input
}

async function updateBrightness() {
  // Already updated via v-model (optimistic)
  await updateTopic(buildTopic('brightness'), brightness.value.toString())
}

async function togglePower() {
  displayPower.value = !displayPower.value // Optimistic
  await updateTopic(buildTopic('power'), displayPower.value ? 'on' : 'off')
}

// Lifecycle hooks
onMounted(() => {
  loadInitialState()
  sseConnection = subscribeToTopics(handleSSEUpdate)
})

onBeforeUnmount(() => {
  if (sseConnection) sseConnection.close()
})
```

**3. Environment Configuration (`.env`):**
```env
VITE_HARPER_URL=http://localhost:9926
VITE_SIGN_ID=2FE598
```

## Key Design Decisions

### Why Harper as MQTT Broker?
- Eliminates external broker dependency (Mosquitto, etc.)
- Single source of truth for state
- Built-in database persistence
- Simpler deployment and operations

### Why SSE Instead of WebSocket?
- Simpler protocol (one-way server → client)
- Native browser support (EventSource API)
- Sufficient for read-only real-time updates
- REST handles writes efficiently

### Why Optimistic Updates?
- Better UX (instant feedback)
- No perceived lag
- SSE eventually confirms actual state
- Graceful handling if LED sign is offline

### Why Minimal Topic Schema?
- Generic and flexible (supports any MQTT device)
- Keep parsing logic in application layer
- Future-proof for different device types
- Simpler database schema

## Testing Strategy

### Unit Tests
- Vue component methods (mock Harper API)
- API service functions (mock fetch)

### Integration Tests
1. **REST Write → MQTT Receive**
   - PUT to Harper API
   - Verify MQTT message published
   - Verify Topic table updated

2. **MQTT Publish → SSE Receive**
   - Publish MQTT message to Harper
   - Verify Topic table updated
   - Verify SSE event emitted
   - Verify Vue state updated

3. **End-to-End Flow**
   - User action in Vue
   - Verify LED sign receives MQTT message
   - LED sign publishes confirmation
   - Verify Vue receives SSE update

### Manual Testing
- Multiple LED signs simultaneously
- Network interruption handling
- SSE reconnection behavior
- Concurrent updates from multiple clients

## Migration Path

1. **Update Harper Schema** - Deploy new Topic table structure
2. **Update Vue App** - Add API service and wire up component
3. **Remove Old Code** - Delete mqtt_client.js and resources.js MQTT code
4. **Update LED Sign Firmware** - Point to Harper MQTT broker (if needed)
5. **Testing** - Verify bidirectional sync works
6. **Deployment** - Deploy Vue app to Harper's static file serving

## Success Criteria

- [ ] Vue UI maintains exact visual appearance
- [ ] User changes in Vue appear on LED sign within 1 second
- [ ] LED sign state updates appear in Vue UI in real-time
- [ ] System supports multiple LED signs simultaneously
- [ ] No external MQTT broker required
- [ ] All state persisted in Harper database
- [ ] SSE reconnects automatically on connection loss

## Future Enhancements (Out of Scope)

- Multi-user authentication/authorization
- LED sign discovery and auto-configuration
- Historical state tracking and analytics
- Scheduled messages and automation
- Mobile app (React Native) using same Harper API

## Diagram

See README.md for visual architecture diagram.
