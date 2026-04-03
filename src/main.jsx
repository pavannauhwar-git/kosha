import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import App from './App'
import './index.css'
import { GlobalErrorBoundary } from './components/errors/GlobalErrorBoundary'
import { startRuntimeMonitor } from './lib/runtimeMonitor'

startRuntimeMonitor()

const RootMode = import.meta.env.DEV ? React.Fragment : React.StrictMode

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </RootMode>
)
