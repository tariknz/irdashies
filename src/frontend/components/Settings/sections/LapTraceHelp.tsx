import type { ReactNode } from 'react';
import {
  ArrowSquareOutIcon,
  FolderOpenIcon,
  QuestionIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import { SettingsSection } from '../components/SettingSection';
import garage61ExportMenu from '../../../assets/img/garage61-export-csv.png';

/** A file path or column name, set apart from the prose around it. */
const Mono = ({ children }: { children: ReactNode }) => (
  <span className="rounded bg-slate-900/60 px-1 py-0.5 font-mono text-[0.9em] text-slate-300">
    {children}
  </span>
);

/** One numbered step, with the number in its own column so text lines up. */
const Step = ({ n, children }: { n: number; children: ReactNode }) => (
  <li className="flex gap-2">
    <span className="flex-none font-semibold text-slate-400">{n}.</span>
    <span>{children}</span>
  </li>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-slate-400">{children}</p>
);

/** Groups a few notes under their own line, for the multi-topic sections. */
const Topic = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <h4 className="text-sm font-semibold text-slate-300">{title}</h4>
    {children}
  </div>
);

/**
 * The two import paths explained in the panel that offers them.
 *
 * Both are things the driver has to do outside irDashies before the buttons on
 * the Trace tab do anything, and neither is discoverable from the buttons
 * themselves — which is exactly the gap this tab fills. Static content only:
 * anything here that depends on settings belongs on the tab that owns it.
 */
export const LapTraceHelp = () => (
  <div className="space-y-5">
    <SettingsSection title="Importing a reference lap">
      <Note>
        Lap Trace plots a saved lap against the one you are driving. Your own
        best lap is recorded automatically. The two import options below let you
        compare against someone else&apos;s lap, or against a lap from a
        previous session.
      </Note>
    </SettingsSection>

    <SettingsSection title="Garage 61 CSV">
      <Note>
        Garage 61 stores laps shared by other drivers. Export one as a CSV and
        import it here.
      </Note>

      <ol className="space-y-1.5 text-sm text-slate-400">
        <Step n={1}>
          Open the lap in Garage 61 and use its export option to download the
          lap as CSV.
          <span className="mt-1 block text-slate-500">
            Click on the down arrow next to Analyze to get to the &quot;Export
            to CSV&quot; option.
          </span>
          <img
            src={garage61ExportMenu}
            alt="The Garage 61 toolbar, with the menu beside the Analyze button open on Copy lap ID, Export to CSV and View event"
            width={210}
            height={134}
            className="mt-2 max-w-full rounded border border-slate-700/60"
          />
        </Step>
        <Step n={2}>
          Back here, choose{' '}
          <span className="inline-flex items-center gap-1 text-slate-300">
            <UploadSimpleIcon size={13} />
            Import Garage 61 Lap
          </span>{' '}
          on the Trace tab and pick the file.
        </Step>
      </ol>

      <Note>
        Keep the filename as Garage 61 wrote it. It carries the driver, car,
        track and lap time, which become the label on the widget. A renamed file
        still imports, and is labelled with the filename instead.
      </Note>

      <Note>
        The export must contain these columns: <Mono>Speed</Mono>,{' '}
        <Mono>LapDistPct</Mono>, <Mono>Lat</Mono>, <Mono>Lon</Mono>,{' '}
        <Mono>Brake</Mono>, <Mono>Throttle</Mono>, <Mono>Gear</Mono>,{' '}
        <Mono>ABSActive</Mono>. Latitude and longitude are how the track length
        is worked out, so an export without them cannot be used.
      </Note>

      <Note>
        There is one Garage 61 slot, not one per track. Importing a new lap
        replaces the previous one.
      </Note>

      <a
        href="https://garage61.net/app/laps/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowSquareOutIcon size={13} />
        Open Garage 61
      </a>
    </SettingsSection>

    <SettingsSection title="iRacing .ibt telemetry">
      <Note>
        An <Mono>.ibt</Mono> file is the telemetry iRacing writes for a session
        on your own computer. Importing one lets you compare against a lap you
        drove earlier.
      </Note>

      <ol className="space-y-1.5 text-sm text-slate-400">
        <Step n={1}>
          Be sure telemetry recording in iRacing is on. The sim writes a file
          per session.
        </Step>
        <Step n={2}>
          Choose{' '}
          <span className="inline-flex items-center gap-1 text-slate-300">
            <UploadSimpleIcon size={13} />
            Import .ibt Lap
          </span>{' '}
          on the Trace tab. The picker opens your telemetry folder.
        </Step>
      </ol>

      <p className="flex items-center gap-2 text-sm text-slate-400">
        <FolderOpenIcon size={15} className="flex-none text-slate-500" />
        Telemetry files are written by iRacing to{' '}
        <Mono>Documents\iRacing\telemetry</Mono>.
      </p>

      <Note>
        Only the fastest clean lap in the file is kept. There is one slot, so
        importing a new file replaces the previous one.
      </Note>

      <Note>
        These files are large, often hundreds of megabytes. Only the one lap is
        stored, so importing does not keep the file.
      </Note>
    </SettingsSection>

    <SettingsSection title="When nothing appears">
      <p className="flex gap-2 text-sm text-slate-400">
        <QuestionIcon size={15} className="mt-0.5 flex-none text-slate-500" />
        <span>
          Check the Reference Lap setting on the Trace tab is set to the source
          you imported.
        </span>
      </p>

      <Note>
        For a Garage 61 lap, confirm the export covers a complete lap. An out
        lap or a partial lap has no start and finish crossing to measure
        against.
      </Note>
    </SettingsSection>

    <SettingsSection title="Limitations">
      <Topic title="Corner names come from bundled track data">
        <Note>
          The Last Corner panel and corner names come from the Lovely Sim Racing
          dataset bundled with irDashies, not from iRacing, and it does not
          cover every layout. Where a layout is missing, the Last Corner panel
          does not appear at all. There is no warning, because there is nothing
          to show.
        </Note>
        <Note>
          Coverage is per layout, not per circuit, so a circuit can have data
          for one layout and none for another.
        </Note>
        <Note>
          Some layouts have corner positions but no names. Those corners are
          numbered instead, and the numbering will not always match
          iRacing&apos;s own.
        </Note>
        <Note>
          The brake countdown does not need any of this. It reads brake points
          from the reference lap itself, so it works wherever the corner panel
          does not.
        </Note>
      </Topic>

      <Topic title="A reference lap from elsewhere is stretched to fit">
        <Note>
          Imported laps are held in one slot each, not one per circuit, so they
          are shown whatever you are driving. When the imported lap came from a
          track of a different length, its distances are rescaled to the current
          one. The trace will draw, but nothing on it lines up with the road you
          are on.
        </Note>
      </Topic>

      <Topic title="Garage 61 exports carry no clock">
        <Note>
          The CSV has no time column, so lap time and per-sample timing are
          reconstructed by integrating speed over the GPS positions. Good enough
          to plot against, but not a measured lap time.
        </Note>
        <Note>
          Those exports also record pedal positions after iRacing&apos;s own
          input processing, while your live trace is raw pedal travel. On a car
          with driving aids the two are measured differently, and the reference
          will look smoother than the driver was.
        </Note>
      </Topic>

      <Topic title="What invalidates a personal best">
        <Note>
          Your own best lap is only recorded from a clean lap. Going off track,
          picking up an incident, entering the pits, or a gap in telemetry all
          disqualify the lap in progress. So does an Active Reset or a tow,
          which discards the lap and restarts recording where the car reappears.
        </Note>
      </Topic>

      <Topic title="The countdown is quiet in a replay">
        <Note>
          Brake cues are suppressed during replay playback, in the pits, and
          whenever you are not on track.
        </Note>
      </Topic>
    </SettingsSection>
  </div>
);
