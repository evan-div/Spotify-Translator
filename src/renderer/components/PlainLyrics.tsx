import type { LyricsView } from '@shared/types/domain';
import { partsForLine, type DisplayModeSetting } from '../hooks/overlayContent';

interface Props {
  view: LyricsView;
  mode: DisplayModeSetting;
  translating: boolean;
}

/** Unsynchronised lyrics: a calm, scrollable list of original/translation pairs. No pretending to follow playback. */
export function PlainLyrics({ view, mode, translating }: Props) {
  return (
    <div className="plain" data-nodrag>
      <div className="plain__scroll">
        {view.lines.map((line, i) => {
          if (line.text.trim() === '') return <div className="plain__break" key={i} />;
          const { primary, secondary } = partsForLine(line.text, line.translation, mode);
          return (
            <div className="plain__pair" key={i}>
              <div className="plain__primary">{primary}</div>
              {secondary && <div className="plain__secondary">{secondary}</div>}
              {!secondary && translating && mode === 'both' && <div className="plain__secondary plain__secondary--pending">…</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
