import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // or whatever framework plugin you’re using

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '5173-ashong-shirt-ajdi14e5z3z.ws-us121.gitpod.io'
    ]
  }
})
