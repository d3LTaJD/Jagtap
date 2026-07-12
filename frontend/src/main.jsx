import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Sync sessionStorage with localStorage on load to support seamless cross-tab authentication
const storedToken = localStorage.getItem('token');
const storedUser = localStorage.getItem('user');
if (storedToken && !sessionStorage.getItem('token')) {
  sessionStorage.setItem('token', storedToken);
}
if (storedUser && !sessionStorage.getItem('user')) {
  sessionStorage.setItem('user', storedUser);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
