# LED Sign Control with Harper & Vue

Real-time LED sign control system built with [Harper](https://www.harperdb.io/) and Vue 3. Control multiple LED signs via MQTT with a responsive web interface featuring bidirectional real-time synchronization.

## Features

- Vue 3 web interface for LED sign control
- Real-time bidirectional sync between UI and hardware
- MQTT communication with Harper as broker
- State persistence in Harper database
- Server-Sent Events (SSE) for live updates
- Support for multiple LED signs
- Control message, brightness (0-15), and power state

## Architecture

```mermaid
%%{init: {'themeVariables': { 'edgeLabelBackground': 'transparent'}}}%%
flowchart TB

BROWSER[Browser<br/>Direct Control]

subgraph HARPER["Harper"]
  direction BT

  subgraph APPLICATION["Application"]
     UI[Vue UI<br/>Message:String<br/>Brightness:Integer<br/>Power Controls:on or off]
  end

  subgraph MESSAGING["Messaging"]
     MQTT["MQTT/MQTTS<br/>Ports: 1883,8883"]
     9926["HTTP/REST/SSE/WS<br/>Port: 9926"]
  end

  subgraph CACHING["Caching<br/>(Not Used)"]
     CACHE["Cache"]
  end

  subgraph DATABASE["Database"]
     DB[(Topics Table<br/>- topic<br/>- value<br/>- updated_at)]
  end

  CACHING  <-.-> | | APPLICATION
  %% DATABASE <--> | | APPLICATION
  DATABASE <--> | | MESSAGING
  DATABASE <-.-> | | CACHING
end

SIGN1[LED Sign X]
SIGN2[LED Sign 2FE598]

UI --> |"HTTP PUT :9926<br/>/Topics/{topic}"| 9926
9926 --> |"SSE :9926<br/>/subscribe?table=Topics"| UI

BROWSER <-.-> |"HTTP :80 (Direct Control)"| SIGN2
BROWSER <-.-> |"HTTP :9926"|HARPER

HARPER <-->|"MQTT :1883<br/>led-sign/#"| SIGN1
HARPER <-->|"MQTT :1883<br/>led-sign/#"| SIGN2

UI@{ shape : rounded }
SIGN1@{ shape : rounded }
SIGN2@{ shape : rounded }
9926@{ shape : rounded }
MQTT@{ shape : rounded }
BROWSER@{ shape : rounded }

linkStyle default stroke-width:2px,fille:none,stroke:#000
CACHE@{ shape: rounded }
style HARPER fill:#9B61FC,stroke:#000000,color:#ffffff
style APPLICATION fill:#c3a1ff,stroke:#000000,color:#ffffff
style CACHING fill:#c3a1ff,stroke:#000000,color:#ffffff
style MESSAGING fill:#c3a1ff,stroke:#000000,color:#ffffff
style DATABASE fill:#c3a1ff,stroke:#000000,color:#ffffff
style DB fill:#48bb78,stroke:#2f855a,color:#fff
style SIGN1 fill:#5d85fc,stroke:#000000,color:#fff
style SIGN2 fill:#5d85fc,stroke:#000000,color:#fff
style BROWSER fill:#fcb45d,stroke:#64748b,color:#1e293b,opacity:0.7
style UI fill:#7221ff,stroke:#fff,color:#fff
style CACHE fill:#7221ff,stroke:#fff,color:#fff
style DB fill:#7221ff,stroke:#fff,color:#fff
style 9926 fill:#7221ff,stroke:#fff,color:#fff
style MQTT fill:#7221ff,stroke:#fff,color:#fff
```

### Data Flow

**Write Path (User → LED Sign):**

1. User changes value in Vue UI (optimistic update)
2. Vue sends REST PUT to Harper `/Topics/{topic-path}`
3. Harper persists to Topics table
4. Harper auto-publishes to MQTT topic
5. LED sign receives MQTT message and updates

**Read Path (LED Sign → User):**

1. LED sign publishes state to Harper MQTT broker
2. Harper updates Topics table automatically
3. Harper sends SSE event to connected clients
4. Vue receives update and syncs UI state

### Topic Structure

```
led-sign/<sign-id>/message     # Display text
led-sign/<sign-id>/brightness  # 0-15 integer
led-sign/<sign-id>/power       # "on" or "off"
```

Example: `led-sign/2FE598/message` with value `"Hello World"`

## Quick Start

### Prerequisites

- [Harper](https://docs.harperdb.io/docs/install-harperdb): `npm install -g harperdb`
- Node.js 16+ for Vue development

### Installation

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment (`.env`):

   ```env
   VITE_HARPER_URL=http://localhost:9926
   VITE_SIGN_ID=2FE598
   ```

4. Start Harper:

   ```bash
   harperdb run .
   ```

5. In development, run Vue dev server:

   ```bash
   npm run dev
   ```

6. For production, build Vue app (outputs to `dist/`):
   ```bash
   npm run build
   ```
   Harper serves the built app automatically from `dist/`

### LED Sign Configuration

Configure your LED sign (ESP32 or similar) to connect to Harper's MQTT broker:

- **Broker (MQTT):** `<your-harper-host>:1883` (TCP) or `:8883` (TLS)
- **Subscribe to:** `led-sign/<your-sign-id>/#`
- **Publish to:** `led-sign/<your-sign-id>/{message|brightness|power}`

### Harper Server Ports

- **HTTP/REST:** `:9926` - REST API endpoints
- **SSE/WebSocket:** `:9926` - Real-time subscriptions
- **MQTT (TCP):** `:1883` - Standard MQTT
- **MQTTS (TLS):** `:8883` - Secure MQTT over TLS

## Project Structure

```
.
├── config.yaml           # Harper configuration (REST & static files)
├── schema.graphql        # Database schema (Topics table)
├── resources.js          # Custom resource logic (optional)
├── src/
│   ├── App.vue          # Main Vue component
│   ├── main.js          # Vue entry point
│   └── services/
│       └── harperApi.js # Harper REST/SSE client
├── docs/
│   └── plans/           # Design documents
└── dist/                # Built Vue app (served by Harper)
```

## Configuration Files

### [config.yaml](./config.yaml)

Harper configuration specifying REST API, static file serving, and schema location.

### [schema.graphql](./schema.graphql)

Database schema defining the Topics table for MQTT state persistence:

```graphql
type Topics @table @export(name: "") {
	topic: String @primaryKey
	value: String
	updated_at: DateTime
}
```

### [resources.js](./resources.js)

Optional JavaScript resource classes for custom endpoint logic.

## Development

### Running Tests

```bash
npm test
```

### MQTT Testing

Use `mqtt-test.js` to send test messages:

```bash
node mqtt-test.js
```

## Design Documentation

See [Design Document](./docs/plans/2026-01-06-led-sign-harper-integration-design.md) for detailed architecture, implementation details, and testing strategy.

## License

Apache 2.0
