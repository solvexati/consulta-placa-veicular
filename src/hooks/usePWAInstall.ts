import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari no iOS expõe navigator.standalone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se identifica como Mac com tela touch
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export interface PWAInstallState {
  /** Navegador disparou beforeinstallprompt (Android / Chrome / Edge). */
  canPrompt: boolean;
  /** App já está rodando instalado (standalone). */
  isInstalled: boolean;
  /** iOS/iPadOS: instalação manual via "Compartilhar > Adicionar à Tela de Início". */
  isIOS: boolean;
  /** Deve exibir algum botão de instalação. */
  showInstall: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePWAInstall(): PWAInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setInstalled] = useState(detectStandalone);
  const [isIOS] = useState(detectIOS);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const mq = window.matchMedia('(display-mode: standalone)');
    const onModeChange = () => setInstalled(detectStandalone());

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    mq.addEventListener('change', onModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', onModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setInstalled(true);
    return outcome;
  }, [deferred]);

  const canPrompt = deferred !== null;
  return {
    canPrompt,
    isInstalled,
    isIOS,
    showInstall: !isInstalled && (canPrompt || isIOS),
    promptInstall,
  };
}
