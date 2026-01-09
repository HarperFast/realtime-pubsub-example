#!/usr/bin/env node

import * as mqtt from 'mqtt';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

let config = {
	MQTT_HOST: 'mqtt://localhost:1883', // Harper's MQTT broker
	DEVICE_NAME: 'led-sign',
	DEVICE_ID: '2FE598',
};

try {
	const envContent = readFileSync(envPath, 'utf-8');
	envContent.split('\n').forEach((line) => {
		line = line.trim();
		if (line && !line.startsWith('#')) {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length) {
				config[key.trim()] = valueParts.join('=').trim();
			}
		}
	});
} catch {
	console.warn('Warning: Could not load .env file, using defaults');
}

// Parse command line arguments
const args = process.argv.slice(2);
let subject = null;
let payload = null;

for (let i = 0; i < args.length; i++) {
	const arg = args[i];

	if (arg === '-m' && args[i + 1]) {
		subject = 'message';
		payload = args[i + 1];
		i++;
	} else if (arg === '-p' && args[i + 1]) {
		subject = 'power';
		const powerState = args[i + 1].toLowerCase();
		if (powerState !== 'on' && powerState !== 'off') {
			console.error('Error: power must be "on" or "off"');
			process.exit(1);
		}
		payload = powerState;
		i++;
	} else if (arg === '-b' && args[i + 1]) {
		subject = 'brightness';
		const level = parseInt(args[i + 1]);
		if (isNaN(level) || level < 0 || level > 15) {
			console.error('Error: brightness must be a number between 0 and 15');
			process.exit(1);
		}
		payload = level.toString();
		i++;
	}
}

// Validate required parameters
if (!subject || !payload) {
	console.error(`
Usage: node mqtt-test.js [OPTION]

Configuration is loaded from .env file:
  MQTT_HOST     - MQTT broker URL (current: ${config.MQTT_HOST})
  DEVICE_NAME   - Device name (current: ${config.DEVICE_NAME})
  DEVICE_ID     - Device ID (current: ${config.DEVICE_ID})

Options (use one):
  -m <message>    Send message (topic: ${config.DEVICE_NAME}/${config.DEVICE_ID}/message)
  -p <on|off>     Set power state (topic: ${config.DEVICE_NAME}/${config.DEVICE_ID}/power)
  -b <0-15>       Set brightness level (topic: ${config.DEVICE_NAME}/${config.DEVICE_ID}/brightness)

Examples:
  node mqtt-test.js -m "Hello World"
  node mqtt-test.js -p on
  node mqtt-test.js -b 10
`);
	process.exit(1);
}

// Build topic from configuration
const topic = `${config.DEVICE_NAME}/${config.DEVICE_ID}/${subject}`;
const host = config.MQTT_HOST;

console.log(`Connecting to ${host}...`);

// Create MQTT client
const client = mqtt.connect(host);

client.on('connect', () => {
	console.log('✓ Connected to MQTT broker');
	console.log(`Publishing to topic: ${topic}`);
	console.log(`Payload: ${payload}`);

	client.publish(topic, payload, { qos: 1 }, (err) => {
		if (err) {
			console.error('✗ Publish error:', err);
			process.exit(1);
		} else {
			console.log('✓ Message published successfully');
			client.end();
			process.exit(0);
		}
	});
});

client.on('error', (err) => {
	console.error('✗ Connection error:', err.message);
	process.exit(1);
});

client.on('close', () => {
	console.log('Connection closed');
});

// Timeout after 10 seconds
setTimeout(() => {
	console.error('✗ Connection timeout');
	client.end();
	process.exit(1);
}, 10000);
