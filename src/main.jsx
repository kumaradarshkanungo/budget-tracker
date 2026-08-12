import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import App from './App.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
import { ManageBillsPage } from './pages/ManageBillsPage.jsx'
import { CreditCardsPage } from './pages/CreditCardsPage.jsx'
import { CreditCardInsightsPage } from './pages/CreditCardInsightsPage.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import './styles.css'

// HashRouter (URLs like /#/settings) is used so the app works on any static
// host without server-side rewrite rules — refreshing a deep link never 404s.
const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'credit-cards', element: <CreditCardsPage /> },
      { path: 'credit-cards/insights', element: <CreditCardInsightsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'manage-bills', element: <ManageBillsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  </React.StrictMode>
)
