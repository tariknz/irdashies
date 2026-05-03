import { describe, it, expect, beforeEach } from 'vitest';
import { useDriverStatsStore } from './DriverStatsStore';

describe('DriverStatsStore', () => {
  describe('setStats', () => {
    beforeEach(() => {
      useDriverStatsStore.setState({ iratingChanges: {}, positionChanges: {} });
    });

    it('preserves state identity when both records are value-equal', () => {
      const { setStats } = useDriverStatsStore.getState();
      setStats({ 1: 10, 2: -5 }, { 1: 1, 2: -1 });

      const after = useDriverStatsStore.getState();
      const irBefore = after.iratingChanges;
      const posBefore = after.positionChanges;

      // Same values, fresh object identities
      setStats({ 1: 10, 2: -5 }, { 1: 1, 2: -1 });

      const next = useDriverStatsStore.getState();
      expect(next.iratingChanges).toBe(irBefore);
      expect(next.positionChanges).toBe(posBefore);
    });

    it('updates when iratingChanges value differs', () => {
      const { setStats } = useDriverStatsStore.getState();
      setStats({ 1: 10 }, { 1: 1 });
      const irBefore = useDriverStatsStore.getState().iratingChanges;

      setStats({ 1: 11 }, { 1: 1 });
      const irAfter = useDriverStatsStore.getState().iratingChanges;

      expect(irAfter).not.toBe(irBefore);
      expect(irAfter[1]).toBe(11);
    });

    it('updates when positionChanges value differs', () => {
      const { setStats } = useDriverStatsStore.getState();
      setStats({ 1: 10 }, { 1: 1 });
      const posBefore = useDriverStatsStore.getState().positionChanges;

      setStats({ 1: 10 }, { 1: 2 });
      const posAfter = useDriverStatsStore.getState().positionChanges;

      expect(posAfter).not.toBe(posBefore);
      expect(posAfter[1]).toBe(2);
    });

    it('updates when a key is added', () => {
      const { setStats } = useDriverStatsStore.getState();
      setStats({ 1: 10 }, { 1: 1 });
      const irBefore = useDriverStatsStore.getState().iratingChanges;

      setStats({ 1: 10, 2: -5 }, { 1: 1 });
      const irAfter = useDriverStatsStore.getState().iratingChanges;

      expect(irAfter).not.toBe(irBefore);
      expect(irAfter[2]).toBe(-5);
    });

    it('updates when a key is removed', () => {
      const { setStats } = useDriverStatsStore.getState();
      setStats({ 1: 10, 2: -5 }, { 1: 1 });
      const irBefore = useDriverStatsStore.getState().iratingChanges;

      setStats({ 1: 10 }, { 1: 1 });
      const irAfter = useDriverStatsStore.getState().iratingChanges;

      expect(irAfter).not.toBe(irBefore);
      expect(irAfter[2]).toBeUndefined();
    });
  });
});
