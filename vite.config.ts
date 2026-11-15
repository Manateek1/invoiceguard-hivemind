import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { handleAgents } from './api/agents.js'
import { handleCognee } from './api/cognee.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const serverEnvironment = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [
      react(),
      {
        name: 'invoiceguard-cognee-cloud-dev-api',
        configureServer(server) {
          server.middlewares.use('/api/agents', (request, response, next) => {
            void handleAgents(request, response, serverEnvironment).catch(next)
          })
          server.middlewares.use('/api/cognee', (request, response, next) => {
            void handleCognee(request, response, serverEnvironment).catch(next)
          })
        },
      },
    ],
  }
})
