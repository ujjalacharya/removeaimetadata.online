import { createRootRoute, Outlet } from '@tanstack/react-router'
import '@fontsource-variable/archivo/wdth.css'
import '../styles.css'

export const Route = createRootRoute({
  component: () => <Outlet />,
})
