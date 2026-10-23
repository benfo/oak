import { createRoot } from 'react-dom/client'
import App from './App'
import './tokens.css'
import './styles.css'
import { initTheme } from './theme'
import { initUpdates } from './updates'
import { initSettings } from './settings'
import { installFocusRing } from './lib/focusRing'

document.documentElement.dataset.platform = window.bridge.platform
initSettings()
installFocusRing()
initTheme()
initUpdates()
createRoot(document.getElementById('root')!).render(<App />)
