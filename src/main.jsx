import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import App from './App'
import './index.css'
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary'
import { startRuntimeMonitor } from './lib/runtimeMonitor'

startRuntimeMonitor()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
