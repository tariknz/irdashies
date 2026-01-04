import { useState, useEffect } from 'react';
import { GithubLogoIcon, DiscordLogoIcon } from '@phosphor-icons/react';
import { useDashboard } from '@irdashies/context';

export const AboutSettings = () => {
  const { version, bridge } = useDashboard();
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadOptOut = async () => {
      try {
        const optOut = await bridge.getAnalyticsOptOut();
        setAnalyticsEnabled(optOut === false);
      } catch (error) {
        console.error('Failed to load analytics opt-out setting:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOptOut();
  }, [bridge]);

  const handleAnalyticsChange = async (checked: boolean) => {
    try {
      await bridge.setAnalyticsOptOut(!checked);
      setAnalyticsEnabled(checked);
    } catch (error) {
      console.error('Failed to update analytics opt-out setting:', error);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4">About</h2>
          <p className="text-slate-300">
            iRacing Dashies is an open-source iRacing Dashboards & Overlays
            application that helps you customize and enhance your racing
            experience.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Version</h3>
          <p className="text-slate-300">{version}</p>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">Connect</h3>

          <a
            href="https://github.com/tariknz/irdashies"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-fit"
          >
            <GithubLogoIcon size={24} weight="bold" />
            <span>GitHub Repository</span>
          </a>

          <a
            href="https://discord.gg/YMAqduF2Ft"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-fit"
          >
            <DiscordLogoIcon size={24} weight="bold" />
            <span>Join our Discord Community</span>
          </a>
        </div>

        <div className="flex flex-col gap-4 mb-2">
          <div>
            <h3 className="text-lg font-semibold">Privacy Policy</h3>
            <p className="text-sm text-slate-400">
              Last updated January 2025
            </p>
          </div>

          <div className="text-sm text-slate-400">
            <div className='mb-2'>
              irDashies collects limited, anonymous usage data to help us
              improve the application, identify issues, and prioritise future
              development.
            </div>

            <div>
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                Data We Collect
              </h2>
              <p className="mb-2">We collect the following anonymous data:</p>
              <ul className="space-y-2 ml-4 list-disc list-outside">
                <li>
                  <strong className="text-slate-300">Settings data</strong>
                  <br />
                  Used to understand which widgets are enabled and how they are
                  configured. This helps improve defaults, testing coverage, and
                  informs feature deprecation decisions.
                </li>
                <li>
                  <strong className="text-slate-300">System information</strong>
                  <br />
                  Including operating system, CPU, memory, and screen
                  resolution. This data helps us optimise performance and ensure
                  compatibility across common hardware configurations.
                </li>
                <li>
                  <strong className="text-slate-300">Errors and crashes</strong>
                  <br />
                  Exception and failure data is collected to diagnose issues,
                  improve stability, and prioritise fixes.
                </li>
                <li>
                  <strong className="text-slate-300">
                    General usage data and approximate location
                  </strong>
                  <br />
                  Used to understand active user counts, retention trends, and
                  country-level usage to guide localisation and roadmap
                  decisions. Location data is derived at a country level only.
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                How Data Is Collected
              </h2>
              <p className="mb-2">
                Product analytics are collected using PostHog with
                privacy-focused settings:
              </p>
              <ul className="space-y-1 ml-2 list-disc list-inside">
                <li>IP address storage is disabled</li>
                <li>Session recording is disabled</li>
                <li>Autocapture is disabled</li>
              </ul>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                Important Privacy Information
              </h2>
              <ul className="space-y-1.5 ml-2 list-disc list-inside">
                <li>
                  No personally identifiable information (PII) is collected
                </li>
                <li>All analytics data is anonymised</li>
                <li>
                  Data is not sold or shared with third parties beyond analytics
                  processing
                </li>
                <li>Analytics data is hosted within the European Union</li>
              </ul>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                Legal Basis
              </h2>
              <p>
                Analytics data is processed under our legitimate interest in
                maintaining, improving, and securing the application.
              </p>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                Data Retention
              </h2>
              <p>
                Analytics event data is retained for up to 1 year, after which
                it is automatically deleted.
              </p>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                Your Choices
              </h2>
              <p>
                You may disable analytics collection at any time by opting out below.
              </p>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-medium mb-2 text-slate-300">
                Contact
              </h2>
              <p className="mb-2">
                If you have any questions about this policy or data collection,
                you can contact us via our GitHub repository by creating an
                issue:
              </p>
              <a
                href="https://github.com/tariknz/irdashies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white transition-colors underline"
              >
                https://github.com/tariknz/irdashies
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              id="analytics-enabled"
              checked={analyticsEnabled}
              onChange={(e) => handleAnalyticsChange(e.target.checked)}
              disabled={isLoading}
              className="mt-1 w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
            />
            <label
              htmlFor="analytics-enabled"
              className="flex-1 text-sm text-slate-300 cursor-pointer"
            >
              <span className="font-medium">Enable analytics data collection</span>
              <p className="mt-1 text-slate-400">
                Help improve the application by sharing anonymous usage data. You can opt out at any time by unchecking this box.
              </p>
              <p className="mt-2 text-slate-400 font-bold">
                Note: Please restart the application for this setting to take effect.
              </p>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
