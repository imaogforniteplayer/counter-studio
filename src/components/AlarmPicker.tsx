import { Play } from 'lucide-react';
import type { AlarmSound, Settings } from '../core/types';
import { ALARM_GROUP_LABELS, ALARM_SOUNDS, alarmInfo } from '../core/alarms';
import { useToast } from '../app/context';
import { previewAlarm } from '../lib/alarm';
import { audioStatus } from '../lib/feedback';
import { Button, Select } from './ui';

/** Choose one of the alarm sounds and hear it first. Used by the Timer and by Settings. */
export function AlarmPicker({ settings, onChange, id }: { settings: Settings; onChange: (sound: AlarmSound) => void; id?: string }) {
  const info = alarmInfo(settings.alarmSound);
  const toast = useToast();
  const play = () => {
    previewAlarm(settings, settings.alarmSound);
    if (settings.alarmSound === 'silent') return;
    // Still no sound a moment later means the browser is holding it back, so say so instead of failing quietly.
    window.setTimeout(() => {
      const status = audioStatus();
      if (status === 'unsupported') toast('This browser cannot play sound.', 'error');
      else if (status === 'blocked') toast('Your browser has not allowed sound yet. Tap Play once more.', 'error');
    }, 700);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          id={id}
          className="min-w-0 flex-1"
          aria-label="Alarm sound"
          value={settings.alarmSound}
          onChange={onChange}
          options={ALARM_SOUNDS.map((a) => ({ value: a.id, label: a.name, group: ALARM_GROUP_LABELS[a.group] }))}
        />
        <Button icon={<Play size={15} />} onClick={play} aria-label={`Play the ${info.name} sound`}>
          Play
        </Button>
      </div>
      <p className="text-[12.5px] leading-snug text-muted">{info.blurb}</p>
    </div>
  );
}
