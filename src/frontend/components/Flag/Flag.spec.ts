import { describe, it, expect } from 'vitest';
import { GlobalFlags } from '@irdashies/types';
import { getFlagInfo } from './Flag';

describe('getFlagInfo', () => {
  describe('Absolute Priority (Updated Hierarchy)', () => {
    it('should prioritize BLACK FLAG over CHECKERED', () => {
      const flags = GlobalFlags.Black | GlobalFlags.Checkered;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('BLACK FLAG');
      expect(result.color).toBe('bg-black text-white');
    }); //this for example to avoid the cheqered flag after receiving a slowdown on the last corner (I can think of Spa)

    it('should prioritize BLACK FLAG over RED', () => {
      const flags = GlobalFlags.Black | GlobalFlags.Red;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('BLACK FLAG');
    });
  }); // I don't even know if red flags are in officials, but it is definitely present in the sdk

  describe('Critical Session Status', () => {
    it('should return CHECKERED flag when Checkered bit is set', () => {
      const flags = GlobalFlags.Checkered;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('CHECKERED');
      expect(result.color).toBe('bg-white text-black');
    });

    it('should return RED flag when Red bit is set', () => {
      const flags = GlobalFlags.Red;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('RED');
      expect(result.color).toBe('bg-red-600');
    });

    it('should return DISQUALIFIED flag when Disqualify bit is set', () => {
      const flags = GlobalFlags.Disqualify;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('DISQUALIFIED');
      expect(result.color).toBe('bg-black text-red-600');
    });

    it('should prioritize Checkered over Yellow and Green', () => {
      const flags = GlobalFlags.Checkered | GlobalFlags.Yellow | GlobalFlags.Green;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('CHECKERED');
    }); // I don't think you can have green and chequered at the same time, but I definitely want to know if the race has finished over a yellow
    
    it('should prioritize Red over non-critical flags', () => {
      const flags = GlobalFlags.Red | GlobalFlags.Yellow | GlobalFlags.Green;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('RED');
    });
  });

  describe('Personal Penalties & Meatballs', () => {
    it('should return BLACK FLAG when Furled bit is set', () => {
      const flags = GlobalFlags.Furled;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('BLACK FLAG');
    });

    it('should return MEATBALL when both Servicible and Repair bits are set', () => {
      const flags = GlobalFlags.Servicible | GlobalFlags.Repair;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('MEATBALL');
      expect(result.color).toBe('bg-orange-600');
    });

    it('should not return MEATBALL when only Servicible bit is set', () => {
      const flags = GlobalFlags.Servicible;
      const result = getFlagInfo(flags);
      expect(result.label).not.toBe('MEATBALL');
    });

    it('should not return MEATBALL when only Repair bit is set', () => {
      const flags = GlobalFlags.Repair;
      const result = getFlagInfo(flags);
      expect(result.label).not.toBe('MEATBALL');
    });

    it('should prioritize BLACK FLAG over YELLOW', () => {
      const flags = GlobalFlags.Black | GlobalFlags.Yellow;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('BLACK FLAG');
    });
  });

  describe('Track Cautions', () => {
    it('should return YELLOW flag for various caution bits', () => {
      expect(getFlagInfo(GlobalFlags.Yellow).label).toBe('YELLOW');
      expect(getFlagInfo(GlobalFlags.YellowWaving).label).toBe('YELLOW');
      expect(getFlagInfo(GlobalFlags.Caution).label).toBe('YELLOW');
      expect(getFlagInfo(GlobalFlags.CautionWaving).label).toBe('YELLOW');
    });

    it('should prioritize YELLOW over GREEN or BLUE', () => {
      const flags = GlobalFlags.Yellow | GlobalFlags.Green | GlobalFlags.Blue;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('YELLOW');
    });
  }); // I would rahter know about a slow car ahead than having a faster car behind me. Could be not ideal in the case of green falg, but I think this is better overall.

  describe('Racing State', () => {
    it('should return GREEN for Green, StartGo, or GreenHeld', () => {
      expect(getFlagInfo(GlobalFlags.Green).label).toBe('GREEN');
      expect(getFlagInfo(GlobalFlags.StartGo).label).toBe('GREEN');
      expect(getFlagInfo(GlobalFlags.GreenHeld).label).toBe('GREEN');
    });

    it('should prioritize GREEN over BLUE, DEBRIS, and WHITE', () => {
      const flags = GlobalFlags.Green | GlobalFlags.Blue | GlobalFlags.Debris | GlobalFlags.White;
      const result = getFlagInfo(flags);
      expect(result.label).toBe('GREEN');
    });
  }); // Defintely want to know when I can go, over anything else, I will manage blue/white flag later 

  describe('Info Flags', () => {
    it('should follow internal priority: BLUE > DEBRIS > WHITE', () => {
      expect(getFlagInfo(GlobalFlags.Blue | GlobalFlags.Debris).label).toBe('BLUE FLAG');
      expect(getFlagInfo(GlobalFlags.Debris | GlobalFlags.White).label).toBe('DEBRIS');
    });
  }); 

  describe('Priority Ordering & Edge Cases', () => {
    it('should return BLACK FLAG when all bits are set (Absolute Priority)', () => {
      const allFlags = 0xFFFFFFFF;
      const result = getFlagInfo(allFlags);
      expect(result.label).toBe('BLACK FLAG');
    });

    it('should return NO FLAG when no relevant bits are set', () => {
      expect(getFlagInfo(0).label).toBe('NO FLAG');
      expect(getFlagInfo(GlobalFlags.OneLapToGreen).label).toBe('NO FLAG');
    });
  });
});