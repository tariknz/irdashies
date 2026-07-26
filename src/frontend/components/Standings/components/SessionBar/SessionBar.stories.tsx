import { Meta, StoryObj } from '@storybook/react-vite';
import { SessionBar } from './SessionBar';
import { getIncidentDisplay } from './getIncidentDisplay';
import { TelemetryDecorator } from '../../../../../../.storybook/telemetryDecorator';
import { getWidgetDefaultConfig } from '@irdashies/types';

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar',
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

const standingsDefaults = getWidgetDefaultConfig('standings');

export const Primary: Story = {
  args: {
    settings: standingsDefaults.headerBar,
    position: 'header',
  },
};

export const FuelLevelMetric: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      fuelLevel: { enabled: true },
      displayOrder: ['fuelLevel'],
    },
    position: 'header',
  },
};

export const FuelLevelWithOtherItems: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      sessionName: { enabled: true },
      sessionLaps: { enabled: true },
      incidentCount: { enabled: true },
      fuelLevel: { enabled: true },
      displayOrder: ['sessionName', 'sessionLaps', 'incidentCount', 'fuelLevel'],
    },
    position: 'header',
  },
};

export const LastLap: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      lastLap: { enabled: true },
      displayOrder: ['lastLap'],
    },
    position: 'header',
  },
};

export const BestLap: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      bestLap: { enabled: true },
      displayOrder: ['bestLap'],
    },
    position: 'header',
  },
};

export const TopSpeed: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      topSpeed: { enabled: true },
      displayOrder: ['topSpeed'],
    },
    position: 'header',
  },
};

export const LapTimesWithOtherItems: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      lastLap: { enabled: true },
      bestLap: { enabled: true },
      incidentCount: { enabled: true },
      displayOrder: ['incidentCount', 'lastLap', 'bestLap'],
    },
    position: 'header',
  },
};

export const Footer: Story = {
  args: {
    settings: standingsDefaults.footerBar,
    position: 'footer',
  },
};

export const Standalone: Story = {
  args: {
    settings: standingsDefaults.headerBar,
    standalone: true,
  },
};

interface IncidentDisplayProps {
  incidents: number;
  incidentLimit: number | null;
  incidentWarningInitialLimit: number | null;
  incidentWarningSubsequentLimit: number | null;
}

const IncidentDisplay = ({
  incidents,
  incidentLimit,
  incidentWarningInitialLimit,
  incidentWarningSubsequentLimit,
}: IncidentDisplayProps) => {
  return (
    <div className="flex justify-end tabular-nums text-lg font-mono">
      {getIncidentDisplay(
        incidents,
        incidentWarningInitialLimit,
        incidentWarningSubsequentLimit,
        incidentLimit
      )}
    </div>
  );
};

interface IncidentsArgs {
  incidents: string;
  incidentLimit: string;
  incidentWarningInitialLimit: string;
  incidentWarningSubsequentLimit: string;
}

const incidentsMeta: Meta<IncidentsArgs> = {
  title: 'widgets/Standings/components/SessionBar/Incidents',
  argTypes: {
    incidents: {
      control: { type: 'text' },
      description: 'Current incident count (empty = null)',
    },
    incidentLimit: {
      control: { type: 'text' },
      description: 'Total DQ limit (empty = null)',
    },
    incidentWarningInitialLimit: {
      control: { type: 'text' },
      description: 'Initial penalty threshold (empty = null)',
    },
    incidentWarningSubsequentLimit: {
      control: { type: 'text' },
      description: 'Subsequent penalty interval (empty = null)',
    },
  },
};

export const Incidents: StoryObj<IncidentsArgs> = {
  ...incidentsMeta,
  args: {
    incidents: '4',
    incidentLimit: '17',
    incidentWarningInitialLimit: '',
    incidentWarningSubsequentLimit: '',
  },
  render: (args: IncidentsArgs) => {
    const parseValue = (val: string | number | null): number | null => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    return (
      <div className="bg-slate-900/70 px-3 py-2 flex items-center text-sm justify-start">
        <IncidentDisplay
          incidents={parseValue(args.incidents) ?? 0}
          incidentLimit={parseValue(args.incidentLimit)}
          incidentWarningInitialLimit={parseValue(
            args.incidentWarningInitialLimit
          )}
          incidentWarningSubsequentLimit={parseValue(
            args.incidentWarningSubsequentLimit
          )}
        />
      </div>
    );
  },
};
