import '../styles/globals.css'
import { TooltipProvider } from '@medusajs/ui'

function MyApp({ Component, pageProps }) {
  return (
    <TooltipProvider>
      <Component {...pageProps} />
    </TooltipProvider>
  )
}

export default MyApp
