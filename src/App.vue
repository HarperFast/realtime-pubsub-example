<template>
  <div id="app">
    <div class="logo-container">
      <img src="/public/harper-logo.png" alt="Harper Logo">
    </div>

    <div class="card">
      <div class="card-header">
        <h1>Real-time LED Sign Control</h1>
        <div class="status-badge">
          <span class="status-indicator"></span>
          <span>Connected</span>
        </div>
      </div>

      <div class="card-body">
        <div class="section" :class="{ inactive: !selectedSignId }">
          <div class="section-title">Display Message</div>
          <div class="input-group">
            <input
              type="text"
              v-model="message"
              placeholder="Enter your message..."
              @keyup.enter="sendMessage"
              :disabled="!selectedSignId"
            >
            <button class="btn" @click="sendMessage" :disabled="!selectedSignId">Send</button>
          </div>
          <div class="current-message-label">Current Message:</div>
          <div class="current-message">{{ currentMessage || 'No message' }}</div>
        </div>

        <div class="section" :class="{ inactive: !selectedSignId }">
          <div class="section-title">Brightness</div>
          <div class="brightness-control">
            <div class="slider-container">
              <input
                type="range"
                min="0"
                max="15"
                v-model="brightness"
                @input="updateBrightness"
                :disabled="!selectedSignId"
              >
            </div>
            <div class="brightness-value">{{ brightness }}</div>
          </div>
        </div>

        <div class="section" :class="{ inactive: !selectedSignId }">
          <div class="section-title">Display Power</div>
          <div class="toggle-container">
            <div
              class="toggle-switch"
              :class="{ off: !displayPower, disabled: !selectedSignId }"
              @click="togglePower"
            >
              <div class="toggle-knob"></div>
            </div>
            <div class="toggle-label" :class="{ off: !displayPower }">
              {{ displayPower ? 'ON' : 'OFF' }}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">LED Sign</div>
          <select v-model="selectedSignId" @change="onSignChange" class="sign-selector">
            <option value="" disabled>Select a sign...</option>
            <option v-for="signId in availableSigns" :key="signId" :value="signId">
              LED Sign {{ signId }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      harperUrl: import.meta.env.VITE_HARPER_URL || 'http://localhost:9926',
      availableSigns: [],
      selectedSignId: '',
      message: '',
      currentMessage: '',
      brightness: 8,
      displayPower: false,
      sseConnection: null
    }
  },
  async mounted() {
    await this.discoverSigns()
    this.setupSSE()
  },
  beforeUnmount() {
    if (this.sseConnection) {
      this.sseConnection.close()
    }
  },
  methods: {
    async discoverSigns() {
      try {
        const response = await fetch(`${this.harperUrl}/Topics`)
        if (!response.ok) throw new Error('Failed to fetch topics')

        const topics = await response.json()
        const signIds = new Set()

        topics.forEach(topic => {
          const match = topic.topic?.match(/^led-sign\/([^/]+)\//)
          if (match) {
            signIds.add(match[1])
          }
        })

        this.availableSigns = Array.from(signIds).sort()

        if (this.availableSigns.length > 0 && !this.selectedSignId) {
          this.selectedSignId = this.availableSigns[0]
          await this.loadSignState()
        }
      } catch (error) {
        console.error('Error discovering signs:', error)
      }
    },

    buildTopic(property) {
      return `led-sign/${this.selectedSignId}/${property}`
    },

    async loadSignState() {
      if (!this.selectedSignId) return

      try {
        const [messageData, brightData, powerData] = await Promise.all([
          this.getTopic(this.buildTopic('message')),
          this.getTopic(this.buildTopic('brightness')),
          this.getTopic(this.buildTopic('power'))
        ])

        if (messageData?.value) this.currentMessage = messageData.value
        if (brightData?.value) this.brightness = parseInt(brightData.value) || 8
        if (powerData?.value) this.displayPower = powerData.value === 'on'
      } catch (error) {
        console.error('Error loading sign state:', error)
      }
    },

    async getTopic(topic) {
      try {
        const response = await fetch(`${this.harperUrl}/Topics/${encodeURIComponent(topic)}`)
        if (!response.ok) return null
        return await response.json()
      } catch (error) {
        console.error('Error fetching topic:', error)
        return null
      }
    },

    async updateTopic(topic, value) {
      try {
        const response = await fetch(`${this.harperUrl}/Topics/${encodeURIComponent(topic)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, value, updated_at: new Date().toISOString() })
        })
        if (!response.ok) throw new Error('Failed to update topic')
      } catch (error) {
        console.error('Error updating topic:', error)
      }
    },

    async sendMessage() {
      if (this.message.trim() && this.selectedSignId) {
        this.currentMessage = this.message
        await this.updateTopic(this.buildTopic('message'), this.message)
        this.message = ''
      }
    },

    async updateBrightness() {
      if (this.selectedSignId) {
        await this.updateTopic(this.buildTopic('brightness'), this.brightness.toString())
      }
    },

    async togglePower() {
      if (!this.selectedSignId) return
      this.displayPower = !this.displayPower
      await this.updateTopic(this.buildTopic('power'), this.displayPower ? 'on' : 'off')
    },

    async onSignChange() {
      await this.loadSignState()
    },

    setupSSE() {
      try {
        this.sseConnection = new EventSource(`${this.harperUrl}/subscribe?table=Topics`)

        this.sseConnection.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (!data.topic || !this.selectedSignId) return

            if (data.topic === this.buildTopic('message')) {
              this.currentMessage = data.value || ''
            } else if (data.topic === this.buildTopic('brightness')) {
              this.brightness = parseInt(data.value) || 8
            } else if (data.topic === this.buildTopic('power')) {
              this.displayPower = data.value === 'on'
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error)
          }
        }

        this.sseConnection.onerror = (error) => {
          console.error('SSE error:', error)
        }
      } catch (error) {
        console.error('Error setting up SSE:', error)
      }
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
#app {
  width: 100%;
  max-width: 500px;
}
.logo-container {
  text-align: center;
  margin-bottom: 30px;
}
.logo-container img {
  max-width: 200px;
  height: auto;
}
.card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.card-header {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
  color: white;
  padding: 30px;
  text-align: center;
}
.card-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-top: 5px;
}
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.card-body {
  padding: 30px;
}
.section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  transition: opacity 0.3s, filter 0.3s;
}
.section:last-child {
  margin-bottom: 0;
}
.section.inactive {
  opacity: 0.5;
  filter: grayscale(50%);
  pointer-events: none;
  user-select: none;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 15px;
}
.sign-selector {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}
.sign-selector:focus {
  outline: none;
  border-color: #667eea;
}
.input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}
input[type="text"] {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}
input[type="text"]:focus {
  outline: none;
  border-color: #667eea;
}
input[type="text"]::placeholder {
  color: #9ca3af;
}
input[type="text"]:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}
.btn {
  padding: 12px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) {
  background: #5568d3;
}
.btn:active:not(:disabled) {
  transform: scale(0.98);
}
.btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  opacity: 0.6;
}
.current-message {
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  color: #333;
  font-family: monospace;
  font-size: 13px;
  margin-top: 8px;
}
.current-message-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}
.brightness-control {
  display: flex;
  align-items: center;
  gap: 15px;
}
.slider-container {
  flex: 1;
}
input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
}
input[type="range"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
input[type="range"]:disabled::-webkit-slider-thumb {
  background: #cbd5e1;
  cursor: not-allowed;
}
input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
input[type="range"]:disabled::-moz-range-thumb {
  background: #cbd5e1;
  cursor: not-allowed;
}
.brightness-value {
  min-width: 30px;
  font-size: 18px;
  font-weight: 600;
  color: #667eea;
  text-align: center;
}
.toggle-container {
  display: flex;
  align-items: center;
  gap: 15px;
}
.toggle-switch {
  position: relative;
  width: 60px;
  height: 32px;
  background: #667eea;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.3s;
}
.toggle-switch.off {
  background: #cbd5e1;
}
.toggle-switch.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.toggle-knob {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.toggle-switch:not(.off) .toggle-knob {
  transform: translateX(28px);
}
.toggle-label {
  font-size: 16px;
  font-weight: 600;
  color: #667eea;
}
.toggle-label.off {
  color: #64748b;
}
</style>
