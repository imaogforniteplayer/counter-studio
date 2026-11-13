import { useState } from 'react';
import { ArrowRight, Download, HardDrive, Keyboard, LayoutTemplate, MousePointerClick, ShieldCheck } from 'lucide-react';
import { useAppState, useStore } from '../app/context';
import { navigate } from '../lib/router';
import { useInstallPrompt } from '../lib/pwa';
import { Logo } from './Logo';
import { Button, Modal } from './ui';

const STEPS = 3;

/** First-run welcome. Shown once; it can be skipped and never returns after that. */
export function Onboarding() {
  const store = useStore();
  const { ready, settings } = useAppState();
  const { canInstall, install } = useInstallPrompt();
  const [step, setStep] = useState(0);

  const open = ready && !settings.onboardingDone;
  const finish = (then?: () => void) => {
    store.updateSettings({ onboardingDone: true });
    then?.();
  };

  const body = [
    <div key="0" className="space-y-4 text-center">
      <Logo size={64} className="mx-auto" />
      <p className="text-[15px] text-muted">
        A fast, good-looking counter for anything: reps, laps, goals, scores, countdowns and more. Seven types, templates, stats and history, all in one place.
      </p>
      <ul className="mx-auto max-w-sm space-y-2.5 text-left text-sm">
        <li className="flex gap-3">
          <HardDrive size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>Everything is stored on this device. There is no account and nothing is uploaded.</span>
        </li>
        <li className="flex gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>It works offline once loaded, and you can export a backup file any time.</span>
        </li>
      </ul>
    </div>,
    <div key="1" className="space-y-4">
      <ul className="space-y-3.5 text-sm">
        <li className="flex gap-3">
          <MousePointerClick size={19} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <strong className="block text-ink">Tap to count</strong>
            <span className="text-muted">Tap the big buttons. Hold one to keep counting. Mistake? Undo is always one tap away.</span>
          </span>
        </li>
        <li className="flex gap-3">
          <LayoutTemplate size={19} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <strong className="block text-ink">Pick a type</strong>
            <span className="text-muted">Normal, Countdown, Goal, Score, Tally, Interval and Multi. Or start from a template.</span>
          </span>
        </li>
        <li className="flex gap-3">
          <Keyboard size={19} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <strong className="block text-ink">Use the keyboard</strong>
            <span className="text-muted">Space or the arrow keys count, Z undoes, F goes full screen, and ? shows every shortcut.</span>
          </span>
        </li>
      </ul>
    </div>,
    <div key="2" className="space-y-4 text-sm text-muted">
      <p>You are ready. Start with a plain counter, or look through the templates for something closer to what you need.</p>
      {canInstall && (
        <Button icon={<Download size={16} />} onClick={() => void install()}>
          Install as an app
        </Button>
      )}
    </div>,
  ];

  const titles = ['Welcome to Tickwell', 'How it works', 'Let’s count something'];

  return (
    <Modal
      open={open}
      onClose={() => finish()}
      title={titles[step]}
      size="md"
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-muted" aria-live="polite">
            Step {step + 1} of {STEPS}
          </span>
          {step === 0 && (
            <Button variant="ghost" onClick={() => finish()}>
              Skip
            </Button>
          )}
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < STEPS - 1 ? (
            <Button variant="primary" iconRight={<ArrowRight size={16} />} onClick={() => setStep(step + 1)} data-autofocus>
              Next
            </Button>
          ) : (
            <>
              <Button
                onClick={() =>
                  finish(() => {
                    navigate('/templates');
                  })
                }
              >
                Browse templates
              </Button>
              <Button
                variant="primary"
                data-autofocus
                onClick={() =>
                  finish(() => {
                    const c = store.addCounter({ name: 'My counter' });
                    store.selectCounter(c.id);
                    navigate('/');
                  })
                }
              >
                Start counting
              </Button>
            </>
          )}
        </>
      }
    >
      {body[step]}
    </Modal>
  );
}
