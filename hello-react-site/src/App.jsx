import React from 'react'

export default function App() {
  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      display: 'flex',
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f7fb',
      color: '#0f172a'
    }}>
      <div style={{textAlign: 'center'}}>
        <h1 style={{fontSize: '2.25rem', margin: 0}}>Hello, world!</h1>
        <p style={{marginTop: '0.5rem', color: '#475569'}}>This is a tiny React + Vite site.</p>
      </div>
    </div>
  )
}
