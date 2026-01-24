import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { WizardProvider } from './context/WizardContext'
import { PromptProvider } from './context/PromptContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <PromptProvider>
          <WizardProvider>
            <App />
          </WizardProvider>
        </PromptProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
