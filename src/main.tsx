import React from 'react'
import ReactDOM from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { Providers } from '@/components/providers'

import { routeTree } from './routeTree.gen'
import './styles/globals.css'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 5000,
  scrollRestoration: true
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById('root') as HTMLElement

if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
  document.documentElement.dataset.platform = 'android'
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>
)
