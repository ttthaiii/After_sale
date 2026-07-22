import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Firestore sync (users AS->Labor, projects Labor->AS) is handled by deployed
// Cloud Functions, NOT by dev-server listeners. Nothing sync-related here.
export default defineConfig({
  plugins: [react()],
})
