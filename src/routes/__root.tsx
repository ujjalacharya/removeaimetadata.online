import { createRootRoute, Outlet } from '@tanstack/react-router'
import { PostHogErrorBoundary, PostHogProvider } from 'posthog-js/react'
import '@fontsource-variable/archivo/wdth.css'
import '../styles.css'

const posthogProjectToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

function RootComponent() {
  if (!posthogProjectToken || !posthogHost) {
    if (import.meta.env.DEV) {
      const missingVariable = posthogProjectToken
        ? 'VITE_PUBLIC_POSTHOG_HOST'
        : 'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN'

      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      )
    }

    return <Outlet />
  }

  return (
    <PostHogProvider
      apiKey={posthogProjectToken}
      options={{
        api_host: posthogHost,
        capture_exceptions: true,
        debug: import.meta.env.DEV,
        defaults: '2025-05-24',
        logs: {
          serviceName: 'image-evidence-desk-web',
          environment: import.meta.env.MODE,
        },
      }}
    >
      <PostHogErrorBoundary
        fallback={<div>Something went wrong. Please try again later.</div>}
      >
        <Outlet />
      </PostHogErrorBoundary>
    </PostHogProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
