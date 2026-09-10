# `src/components/Boxer/`

## Responsibility

Renders the on-screen sparring partner and plays the punch it is told to play:
stance, the arm that is throwing, the hip turn behind it. It is driven entirely
by props and is the component that makes an `Attack` legible to a human.

## Does NOT contain

Attack generation or selection (`src/boxing/attackEngine.ts`), any judgement
about whether the user defended, and no decision about _when_ to punch. The one
piece of timing it owns is dropping back to guard once a punch has finished
drawing — a property of the animation, not of the drill.

## Props

```ts
interface BoxerProps {
  stance: Stance // 'orthodox' | 'southpaw'
  currentAction: BoxerAction // 'idle' | PunchType
  onActionComplete?: () => void
  className?: string
}
```

| Prop               | Contract                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| `stance`           | Which side the partner leads with. Southpaw renders the same figure mirrored. |
| `currentAction`    | The punch to play, or `'idle'` for the resting guard. Changing it starts it.  |
| `onActionComplete` | Fires once the punch has drawn and the figure is back at guard. Not for idle. |
| `className`        | Layout only — sizing and positioning. The figure's own styling is internal.   |

### The one sharp edge

**Setting `currentAction` to the same punch twice in a row does nothing.** It is
not a prop change, so nothing re-triggers. Return it to `'idle'` first — which
is exactly what `onActionComplete` is for:

```tsx
const [action, setAction] = useState<BoxerAction>('idle')

<Boxer stance="orthodox" currentAction={action} onActionComplete={() => setAction('idle')} />
```

The component does drop back to guard on its own without this, so it always
_looks_ right; it is the parent's copy of the state that goes stale. Wiring
`onActionComplete` keeps the two in step.

Completion is reported by Framer's `onAnimationComplete` rather than a
`setTimeout`, so the return to guard cannot drift out of step with the animation
it is waiting on, and changing a duration in `boxerAnimations.ts` needs no
matching change here.

## How stance works

A southpaw is the mirror image of an orthodox boxer, so the figure is drawn once
— in its orthodox arrangement, lead side at higher x — and flipped horizontally
with `-scale-x-100` for southpaw. Which arm is "lead" follows from the flip.

The alternative, a second set of variants per stance, would double the tuning
surface and let the two copies drift. This mirrors what `src/boxing/attacks.ts`
already does with `resolveForStance`: describe one stance, mirror for the other.

Note the figure faces the viewer, so a boxer's left hand appears on the viewer's
right. Orthodox leads with the left, which is why the lead side is drawn at
higher x.

## How the animation is structured

Framer needs one `Variants` object per animated element. Rather than write ten
parts × seven actions by hand, `src/animations/boxerAnimations.ts` describes each
punch once as a `BoxerPose` — torso, head, both arms, legs — and derives
`boxerVariants` from it. The parent `<motion.svg animate={playing}>` propagates
the variant name to every group beneath it.

The limb groups are **nested** — glove inside forearm inside upper arm — so
rotations compose the way a real joint chain does. Each variant only describes
its own joint; the elbow following the shoulder is free.

Because the boxer faces the viewer, a punch travelling at the camera has almost
no screen displacement. It reads as the glove growing (`gloveScale`). Hooks and
uppercuts travel across the frame and are carried by `gloveX` / `gloveY`. That
distinction is what makes the six punches tell each other apart.

## Adding a new punch

1. Add the name to `PunchType` in `src/types/boxing.ts`, and give it an entry in
   `ATTACK_CATALOGUE` in `src/boxing/attacks.ts` (duration and expected
   defenses). `BoxerAction` is `'idle' | PunchType`, so it appears here
   automatically.
2. Add one entry to `boxerPoses` in `src/animations/boxerAnimations.ts`. The
   compiler will already be demanding it — the record is keyed by `BoxerAction`,
   so a missing pose is a type error, not a silent fallback to idle.
3. Nothing else. `boxerVariants` derives from the pose, and every part picks up
   the new action. No component in this folder changes.

Tuning the punch to look right:

- **Straight?** Lead with `gloveScale` (1.5–1.7) and keep travel small.
- **Hook?** Lead with `gloveX` (±30 or so), keep `gloveScale` near 1.2 — it is
  crossing the frame, not approaching the camera.
- **Uppercut?** Lead with negative `gloveY` (−30 or so) and a negative
  `torso.y` so the whole figure drives upward.
- **Rear-handed?** Give it noticeably more `torso.rotate` than its lead-hand
  equivalent. The hip turn is the power, and it is the clearest tell that a
  cross is not a jab when both are coming at the camera.
- Keep `durationMs` honest relative to the others: the jab is the fastest punch
  in boxing and has to read that way.

## Verifying it by eye

`src/pages/BoxerPreview.tsx` is a temporary manual-test page with a button per
punch and a stance toggle. Run `npm run dev`. It exists because no unit test can
tell you whether a hook _looks_ like a hook, and it should be deleted once the
training loop drives the figure for real.
