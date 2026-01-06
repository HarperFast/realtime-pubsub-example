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
        <div class="section">
          <div class="section-title">Display Message</div>
          <div class="input-group">
            <input
              type="text"
              v-model="message"
              placeholder="Enter your message..."
              @keyup.enter="sendMessage"
            >
            <button class="btn" @click="sendMessage">Send</button>
          </div>
          <div class="current-message-label">Current Message:</div>
          <div class="current-message">{{ currentMessage }}</div>
        </div>

        <div class="section">
          <div class="section-title">Brightness</div>
          <div class="brightness-control">
            <div class="slider-container">
              <input
                type="range"
                min="0"
                max="15"
                v-model="brightness"
                @input="updateBrightness"
              >
            </div>
            <div class="brightness-value">{{ brightness }}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Display Power</div>
          <div class="toggle-container">
            <div
              class="toggle-switch"
              :class="{ off: !displayPower }"
              @click="togglePower"
            >
              <div class="toggle-knob"></div>
            </div>
            <div class="toggle-label" :class="{ off: !displayPower }">
              {{ displayPower ? 'ON' : 'OFF' }}
            </div>
          </div>
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
      message: '',
      currentMessage: 'This is a live message Ivan sent!',
      brightness: 8,
      displayPower: true
    }
  },
  methods: {
    sendMessage() {
      if (this.message.trim()) {
        this.currentMessage = this.message
        this.message = ''
        // In a real app, this would send to the ESP32
        console.log('Sending message:', this.currentMessage)
      }
    },
    updateBrightness() {
      // In a real app, this would send to the ESP32
      console.log('Brightness:', this.brightness)
    },
    togglePower() {
      this.displayPower = !this.displayPower
      // In a real app, this would send to the ESP32
      console.log('Display power:', this.displayPower)
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
}
.section:last-child {
  margin-bottom: 0;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 15px;
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
.btn:hover {
  background: #5568d3;
}
.btn:active {
  transform: scale(0.98);
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
input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
