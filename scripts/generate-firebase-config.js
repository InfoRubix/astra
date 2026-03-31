/**
 * Generate Firebase config file for service worker
 * This script reads .env file (if exists) or uses process.env and creates public/firebase-config.js
 */

const fs = require('fs');
const path = require('path');

// Try to read .env file, fallback to process.env
const envPath = path.join(__dirname, '..', '.env');
let envVars = {};

if (fs.existsSync(envPath)) {
  // Read from .env file (local development)
  const envContent = fs.readFileSync(envPath, 'utf8');

  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} else {
  // Use process.env (Netlify, production)
  console.log('No .env file found, using process.env');
  envVars = process.env;
}

// Generate firebase-config.js content
const configContent = `// Firebase configuration for service worker
const firebaseConfig = {
  apiKey: "${envVars.REACT_APP_FIREBASE_API_KEY || ''}",
  authDomain: "${envVars.REACT_APP_FIREBASE_AUTH_DOMAIN || ''}",
  projectId: "${envVars.REACT_APP_FIREBASE_PROJECT_ID || ''}",
  storageBucket: "${envVars.REACT_APP_FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${envVars.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${envVars.REACT_APP_FIREBASE_APP_ID || ''}"
};
`;

// Write to public/firebase-config.js
const outputPath = path.join(__dirname, '..', 'public', 'firebase-config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✅ Firebase config file generated at:', outputPath);
