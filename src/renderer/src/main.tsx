import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'
// Side-effect import: resolves & applies the saved theme before first paint.
import './stores/useThemeStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
