import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@tope/ui/styles' // Import shared design system

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
