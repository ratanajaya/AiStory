'use client';

import { useEffect, useState } from 'react';

export default function TrialActionNotice({ kind }: { kind: 'text' | 'audio' }) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { if (typeof fetch !== 'function') return; fetch('/api/viewer').then((response) => response.json()).then((viewer) => {
      if (active) setBlocked(!viewer?.isAdmin && viewer?.[kind === 'text' ? 'textFunding' : 'audioFunding'] === 'trial' && viewer?.remaining?.[kind] === 0);
    }).catch(() => {}); };
    refresh(); window.addEventListener('focus', refresh); window.addEventListener('aistory:usage', refresh); window.addEventListener('aistory:settings', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('aistory:usage', refresh); window.removeEventListener('aistory:settings', refresh); };
  }, [kind]);
  if (!blocked) return null;
  return <p className="my-1 text-xs text-amber-500">Free {kind === 'text' ? 'text generation' : 'audio'} is exhausted. <button className="underline" onClick={() => window.dispatchEvent(new Event('aistory:keys'))}>Use your own API key</button> to continue. Google sign-in saves your work but does not reset the trial.</p>;
}
