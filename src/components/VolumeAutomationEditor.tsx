import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeVolumeAutomation,
  updateVolumeAutomationPoint,
  type VolumeAutomationPoint,
} from '../lib/volumeAutomation';

type Props = {
  duration: number;
  maximumVolume: number;
  points?: VolumeAutomationPoint[];
  onChange: (points: VolumeAutomationPoint[]) => void;
  onCommit?: () => void;
};

const formatTime = (seconds: number) => {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
};

const VolumeAutomationEditor: React.FC<Props> = ({ duration, maximumVolume, points, onChange, onCommit }) => {
  const normalized = useMemo(
    () => normalizeVolumeAutomation(points, duration, maximumVolume),
    [duration, maximumVolume, points],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const graphRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, normalized.length - 1));
  }, [normalized.length]);
  const selected = normalized[selectedIndex];
  const polyline = normalized.map((point) => `${(point.atSeconds / duration) * 100},${100 - point.volume}`).join(' ');

  const beginPointDrag = (event: React.PointerEvent<HTMLButtonElement>, pointIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const graph = graphRef.current;
    if (!graph) return;
    const rect = graph.getBoundingClientRect();
    const dragPoints = normalized.map((point) => ({ ...point }));
    setSelectedIndex(pointIndex);

    const movePoint = (clientX: number, clientY: number) => {
      const volume = 100 - ((clientY - rect.top) / rect.height) * 100;
      const isEndpoint = pointIndex === 0 || pointIndex === dragPoints.length - 1;
      const atSeconds = isEndpoint
        ? dragPoints[pointIndex].atSeconds
        : ((clientX - rect.left) / rect.width) * duration;
      onChange(updateVolumeAutomationPoint(dragPoints, pointIndex, { atSeconds, volume }, duration));
    };

    movePoint(event.clientX, event.clientY);
    const handlePointerMove = (moveEvent: PointerEvent) => movePoint(moveEvent.clientX, moveEvent.clientY);
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      onCommit?.();
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <section aria-label="Volume automation" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <strong style={{ fontSize: 14 }}>Volume over time</strong>
        <span className="text-xs text-secondary">{normalized.length} points</span>
      </div>

      <div style={{ position: 'relative', height: 142, border: '1px solid var(--surface-border)', borderRadius: 6, background: 'linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '100% 25%', overflow: 'hidden' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 12, width: 'calc(100% - 24px)', height: 'calc(100% - 24px)', overflow: 'visible' }}>
          <polyline points={polyline} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div ref={graphRef} style={{ position: 'absolute', inset: 12, touchAction: 'none' }}>
          {normalized.map((point, index) => (
            <button
              key={`${point.atSeconds}-${index}`}
              type="button"
              data-testid={`volume-point-${index}`}
              aria-label={`Volume point at ${formatTime(point.atSeconds)}, ${point.volume}%`}
              aria-pressed={selectedIndex === index}
              onClick={() => setSelectedIndex(index)}
              onPointerDown={(event) => beginPointDrag(event, index)}
              style={{ position: 'absolute', left: `${(point.atSeconds / duration) * 100}%`, top: `${100 - point.volume}%`, width: 22, height: 22, padding: 0, borderRadius: '50%', transform: 'translate(-50%, -50%)', background: selectedIndex === index ? 'white' : 'var(--primary)', border: selectedIndex === index ? '5px solid var(--primary)' : '3px solid #111119', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', cursor: 'grab', touchAction: 'none' }}
            />
          ))}
        </div>
      </div>

      <div aria-live="polite" style={{ minWidth: 0, fontSize: 12 }}>
          <strong>{selected.volume}%</strong><span className="text-secondary"> at {formatTime(selected.atSeconds)} · {normalized.length} points</span>
      </div>
    </section>
  );
};

export default VolumeAutomationEditor;
