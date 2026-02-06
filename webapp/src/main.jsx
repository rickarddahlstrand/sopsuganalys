import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './context/DataContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </ThemeProvider>
  </React.StrictMode>
)
