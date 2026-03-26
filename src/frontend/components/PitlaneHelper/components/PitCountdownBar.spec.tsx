import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PitCountdownBar } from './PitCountdownBar';

describe('PitCountdownBar', () => {
  describe('Vertical Orientation', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('displays distance in meters when distance > 0', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={150}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(getByText('150m')).toBeInTheDocument();
    });

    it('displays "here" when distance is 0', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={0}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      // When distance is 0, value label shows "here"
      expect(getByText('here')).toBeInTheDocument();
    });

    it('displays target label at bottom', () => {
      const { getAllByText } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const labels = getAllByText('Pit Entry');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('calculates correct progress percentage (50% remaining)', () => {
      const { container } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.bottom-0'
      ) as HTMLElement;
      expect(progressBar).toBeInTheDocument();
      expect(progressBar.style.height).toBe('50%');
    });

    it('calculates correct progress percentage (25% remaining)', () => {
      const { container } = render(
        <PitCountdownBar
          distance={150}
          maxDistance={200}
          orientation="vertical"
          color="rgb(234, 179, 8)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.bottom-0'
      ) as HTMLElement;
      expect(progressBar).toBeInTheDocument();
      expect(progressBar.style.height).toBe('25%');
    });

    it('applies correct background color', () => {
      const { container } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="vertical"
          color="rgb(59, 130, 246)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.bottom-0'
      ) as HTMLElement;
      expect(progressBar.style.backgroundColor).toBe('rgb(59, 130, 246)');
    });

    it('clamps progress to 0% when distance exceeds maxDistance', () => {
      const { container } = render(
        <PitCountdownBar
          distance={250}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.bottom-0'
      ) as HTMLElement;
      expect(progressBar.style.height).toBe('0%');
    });

    it('clamps progress to 100% when distance is 0', () => {
      const { container } = render(
        <PitCountdownBar
          distance={0}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.bottom-0'
      ) as HTMLElement;
      expect(progressBar.style.height).toBe('100%');
    });
  });

  describe('Horizontal Orientation', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(container).toBeInTheDocument();
    });

    it('displays distance in meters when distance > 0', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={150}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(getByText('150m')).toBeInTheDocument();
    });

    it('displays "here" when distance is 0', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={0}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(getByText('here')).toBeInTheDocument();
    });

    it('displays target label on left', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(getByText('Pit Entry')).toBeInTheDocument();
    });

    it('calculates correct progress percentage (50% remaining)', () => {
      const { container } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.left-0'
      ) as HTMLElement;
      expect(progressBar).toBeInTheDocument();
      expect(progressBar.style.width).toBe('50%');
    });

    it('applies correct background color', () => {
      const { container } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(234, 179, 8)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.left-0'
      ) as HTMLElement;
      expect(progressBar.style.backgroundColor).toBe('rgb(234, 179, 8)');
    });

    it('clamps progress to 0% when distance exceeds maxDistance', () => {
      const { container } = render(
        <PitCountdownBar
          distance={250}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.left-0'
      ) as HTMLElement;
      expect(progressBar.style.width).toBe('0%');
    });

    it('clamps progress to 100% when distance is 0', () => {
      const { container } = render(
        <PitCountdownBar
          distance={0}
          maxDistance={200}
          orientation="horizontal"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      const progressBar = container.querySelector(
        '.absolute.left-0'
      ) as HTMLElement;
      expect(progressBar.style.width).toBe('100%');
    });
  });

  describe('All Target Names', () => {
    it('renders "Pit Entry" target name', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={100}
          maxDistance={200}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Pit Entry"
        />
      );
      expect(getByText('Pit Entry')).toBeInTheDocument();
    });

    it('renders "Pitbox" target name', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={50}
          maxDistance={100}
          orientation="vertical"
          color="rgb(234, 179, 8)"
          targetName="Pitbox"
        />
      );
      expect(getByText('Pitbox')).toBeInTheDocument();
    });

    it('renders "Past Pitbox" target name', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={25}
          maxDistance={100}
          orientation="vertical"
          color="rgb(34, 197, 94)"
          targetName="Past Pitbox"
        />
      );
      expect(getByText('Past Pitbox')).toBeInTheDocument();
    });

    it('renders "Pit Exit" target name', () => {
      const { getByText } = render(
        <PitCountdownBar
          distance={80}
          maxDistance={150}
          orientation="vertical"
          color="rgb(234, 179, 8)"
          targetName="Pit Exit"
        />
      );
      expect(getByText('Pit Exit')).toBeInTheDocument();
    });
  });
});
