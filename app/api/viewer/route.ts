import { NextResponse } from 'next/server';
import { getActor, getGuestWorkspace } from '@/lib/guest';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { remainingTrial } from '@/lib/trial';

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ kind: 'visitor', isAdmin: false });
  const [settings, remaining, guest] = await Promise.all([
    getActorGenerationSettings(), remainingTrial(request), actor.kind === 'guest' ? getGuestWorkspace() : Promise.resolve(null),
  ]);
  return NextResponse.json({ kind: actor.kind, isAdmin: actor.isAdmin, expiresAt: guest?.expiresAt ?? null,
    remaining, selectedLlm: settings.selectedLlm, selectedTts: settings.selectedTts,
    personal: settings.personal,
    textFunding: settings.personal[settings.selectedLlm.service] ? 'personal' : 'trial',
    audioFunding: settings.personal[settings.selectedTts?.service ?? 'together'] ? 'personal' : 'trial',
  });
}
