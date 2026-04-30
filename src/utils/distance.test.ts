import { describe, expect, it } from 'vitest';
import { formatDistance, haversineDistanceKm } from './distance';

describe('haversineDistanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceKm(42.7, 23.3, 42.7, 23.3)).toBe(0);
  });

  it('returns a known short distance within Sofia', () => {
    // Sofia centre to roughly 1 km east — should be ~1 km.
    const km = haversineDistanceKm(42.6977, 23.3219, 42.6977, 23.3341);
    expect(km).toBeGreaterThan(0.85);
    expect(km).toBeLessThan(1.15);
  });

  it('returns a known long distance between Sofia and Berlin', () => {
    // Great-circle distance between Sofia (42.6977, 23.3219) and Berlin (52.52, 13.405) is ~1318 km.
    const km = haversineDistanceKm(42.6977, 23.3219, 52.52, 13.405);
    expect(km).toBeGreaterThan(1250);
    expect(km).toBeLessThan(1400);
  });

  it('is symmetric', () => {
    const a = haversineDistanceKm(42.7, 23.3, 52.5, 13.4);
    const b = haversineDistanceKm(52.5, 13.4, 42.7, 23.3);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometre distances in metres', () => {
    expect(formatDistance(0.5, { locationEnabled: true, hasCoordinates: true })).toBe('На 500 м');
  });

  it('formats kilometre distances with one decimal', () => {
    expect(formatDistance(2.345, { locationEnabled: true, hasCoordinates: true })).toBe('На 2.3 км');
  });

  it('explains why a distance is missing when location is disabled', () => {
    expect(formatDistance(undefined, { locationEnabled: false, hasCoordinates: true })).toMatch(/местоположение/);
  });

  it('explains why a distance is missing when coordinates are absent', () => {
    expect(formatDistance(undefined, { locationEnabled: true, hasCoordinates: false })).toMatch(/координати/);
  });
});
