import { describe, it, expect } from 'vitest';
import { formatTime } from './time';

describe('time', () => {
  describe('formatTime', () => {
    it('should return an empty string if no seconds are provided', () => {
      expect(formatTime()).toBe('');
    });

    it('should format time correctly for whole seconds', () => {
      expect(formatTime(75)).toBe('1:15.000');
    });

    it('should format time correctly for seconds with milliseconds', () => {
      expect(formatTime(75.123)).toBe('1:15.123');
    });

    it('should format time correctly for less than a minute', () => {
      expect(formatTime(45)).toBe('0:45.000');
    });

    it('should format time correctly for exactly one minute', () => {
      expect(formatTime(60)).toBe('1:00.000');
    });

    it('should return empty string for zero seconds', () => {
      expect(formatTime(0)).toBe('');
    });

    it('should format time correctly for less than a second', () => {
      expect(formatTime(0.456)).toBe('0:00.456');
    });

    it('should format time correctly for more than an hour', () => {
      expect(formatTime(3661.789)).toBe('1:01:01.789');
    });

    it('should round time correctly for higher precision sub second', () => {
      expect(formatTime(0.4562335)).toBe('0:00.456');
    });

    it('should return empty string for -1 time', () => {
      expect(formatTime(-1)).toBe('');
    });
  });

  describe('formatTime with different formats', () => {
    describe('format: "full"', () => {
      it('should format full time with milliseconds', () => {
        expect(formatTime(75.123, 'full')).toBe('1:15.123');
      });

      it('should format full time with zero milliseconds', () => {
        expect(formatTime(75, 'full')).toBe('1:15.000');
      });

      it('should show hours when hours > 0', () => {
        expect(formatTime(3661.789, 'full')).toBe('1:01:01.789');
      });
    });

    describe('format: "mixed"', () => {
      it('should format mixed time with one decimal millisecond', () => {
        expect(formatTime(75.123, 'mixed')).toBe('1:15.1');
      });

      it('should format mixed time with zero milliseconds', () => {
        expect(formatTime(75, 'mixed')).toBe('1:15.0');
      });

      it('should round correctly for mixed format', () => {
        expect(formatTime(75.156, 'mixed')).toBe('1:15.1');
      });

      it('should show hours when hours > 0', () => {
        expect(formatTime(3661.789, 'mixed')).toBe('1:01:01.7');
      });
    });

    describe('format: "minutes"', () => {
      it('should format minutes and seconds without milliseconds', () => {
        expect(formatTime(75.123, 'minutes')).toBe('1:15');
      });

      it('should format minutes and seconds with zero seconds', () => {
        expect(formatTime(60, 'minutes')).toBe('1:00');
      });

      it('should show minutes modulo 60 even when hours > 0', () => {
        expect(formatTime(3661.789, 'minutes')).toBe('1:01');
      });
    });

    describe('format: "seconds-full"', () => {
      it('should format seconds with full milliseconds', () => {
        expect(formatTime(75.123, 'seconds-full')).toBe('15.123');
      });

      it('should format seconds with zero milliseconds', () => {
        expect(formatTime(15, 'seconds-full')).toBe('15.000');
      });

      it('should handle single digit seconds', () => {
        expect(formatTime(3.456, 'seconds-full')).toBe('3.456');
      });

      it('should handle more than 60 seconds', () => {
        expect(formatTime(75.123, 'seconds-full')).toBe('15.123');
      });
    });

    describe('format: "seconds-mixed"', () => {
      it('should format seconds with one decimal millisecond', () => {
        expect(formatTime(15.123, 'seconds-mixed')).toBe('15.1');
      });

      it('should format seconds with zero milliseconds', () => {
        expect(formatTime(15, 'seconds-mixed')).toBe('15.0');
      });

      it('should handle single digit seconds', () => {
        expect(formatTime(3.123, 'seconds-mixed')).toBe('3.1');
      });

      it('should handle more than 60 seconds', () => {
        expect(formatTime(75.123, 'seconds-mixed')).toBe('15.1');
      });
    });

    describe('format: "seconds"', () => {
      it('should format seconds only', () => {
        expect(formatTime(15.123, 'seconds')).toBe('15');
      });

      it('should format zero seconds', () => {
        expect(formatTime(60, 'seconds')).toBe('0');
      });

      it('should handle single digit seconds', () => {
        expect(formatTime(3.789, 'seconds')).toBe('3');
      });

      it('should handle more than 60 seconds', () => {
        expect(formatTime(75.123, 'seconds')).toBe('15');
      });
    });

    describe('format: "duration"', () => {
      it('should format duration m:ss for times under 1 hour with single digit minutes', () => {
        expect(formatTime(75.123, 'duration')).toBe('1:15');
      });

      it('should format duration m:ss for times under 1 hour on minute boundary', () => {
        expect(formatTime(60, 'duration')).toBe('1:00');
        expect(formatTime(180, 'duration')).toBe('3:00');
      });

      it('should format duration mm:ss when under 1 hour with double digit minutes', () => {
        expect(formatTime(725.789, 'duration')).toBe('12:05');
      });

      it('should format h:mm:ss when hours > 0', () => {
        expect(formatTime(3661.789, 'duration')).toBe('1:01:01');
        expect(formatTime(86400, 'duration')).toBe('24:00:00');
      });

      it('should format mm:ss when under 1 hour not on minute boundary', () => {
        expect(formatTime(361.789, 'duration')).toBe('6:01');
      });
    });

    describe('format: "duration-wlabels"', () => {
      it('should format with labels for seconds only', () => {
        expect(formatTime(45.123, 'duration-wlabels')).toBe('45 Secs');
      });

      it('should format with labels for minutes and seconds', () => {
        expect(formatTime(75.123, 'duration-wlabels')).toBe('1 Min 15 Secs');
      });

      it('should format with labels for minutes and seconds', () => {
        expect(formatTime(122, 'duration-wlabels')).toBe('2 Mins 2 Secs');
      });

      it('should format with labels for single minute', () => {
        expect(formatTime(60, 'duration-wlabels')).toBe('1 Min');
      });

      it('should format with labels for hours only', () => {
        expect(formatTime(3600, 'duration-wlabels')).toBe('1 Hr');
        expect(formatTime(7200, 'duration-wlabels')).toBe('2 Hrs');
      });

      it('should format with labels for hours, minutes and seconds', () => {
        expect(formatTime(3661.789, 'duration-wlabels')).toBe('1 Hr 1 Min 1 Sec');
      });

      it('should return empty string for zero seconds', () => {
        expect(formatTime(0, 'duration-wlabels')).toBe('');
      });
    });

    it('should return empty string for zero or negative seconds in all formats', () => {
      expect(formatTime(0, 'full')).toBe('');
      expect(formatTime(-1, 'mixed')).toBe('');
      expect(formatTime(undefined, 'minutes')).toBe('');
      expect(formatTime(0, 'duration')).toBe('');
      expect(formatTime(0, 'duration-wlabels')).toBe('');
    });
  });
});
