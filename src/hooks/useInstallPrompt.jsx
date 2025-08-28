// simple install prompt hook
import { useEffect, useState } from 'react'

export function useInstallPrompt() {
    const [deferred, setDeferred] = useState(null)
    useEffect(() => {
        const onBeforeInstall = (e) => { e.preventDefault(); setDeferred(e) }
        window.addEventListener('beforeinstallprompt', onBeforeInstall)
        return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }, [])
    const promptInstall = async () => {
        if (!deferred) return false
        deferred.prompt()
        const { outcome } = await deferred.userChoice
        setDeferred(null)
        return outcome === 'accepted'
    }
    return { canInstall: !!deferred, promptInstall }
}
