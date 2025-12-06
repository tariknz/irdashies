import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';

// Test YAML strings and their expected JSON output
// These can be used to verify the C++ parser

export const testCases = [
  {
    name: 'Simple nested objects',
    yaml: `WeekendInfo:
  TrackName: test track
  TrackID: 123`,
    expected: {
      WeekendInfo: {
        TrackName: 'test track',
        TrackID: 123,
      },
    },
  },
  {
    name: 'Deeply nested objects',
    yaml: `WeekendInfo:
  TrackName: test track
  WeekendOptions:
    NumStarters: 40
    StartingGrid: 2x2 inline`,
    expected: {
      WeekendInfo: {
        TrackName: 'test track',
        WeekendOptions: {
          NumStarters: 40,
          StartingGrid: '2x2 inline',
        },
      },
    },
  },
  {
    name: 'Array of objects',
    yaml: `DriverInfo:
  Drivers:
    - CarIdx: 0
      UserName: Driver 1
    - CarIdx: 1
      UserName: Driver 2`,
    expected: {
      DriverInfo: {
        Drivers: [
          { CarIdx: 0, UserName: 'Driver 1' },
          { CarIdx: 1, UserName: 'Driver 2' },
        ],
      },
    },
  },
  {
    name: 'Nested arrays (CameraInfo)',
    yaml: `CameraInfo:
  Groups:
    - GroupNum: 1
      GroupName: Nose
      Cameras:
        - CameraNum: 1
          CameraName: CamNose
    - GroupNum: 2
      GroupName: Gearbox
      Cameras:
        - CameraNum: 1
          CameraName: CamGearbox`,
    expected: {
      CameraInfo: {
        Groups: [
          {
            GroupNum: 1,
            GroupName: 'Nose',
            Cameras: [{ CameraNum: 1, CameraName: 'CamNose' }],
          },
          {
            GroupNum: 2,
            GroupName: 'Gearbox',
            Cameras: [{ CameraNum: 1, CameraName: 'CamGearbox' }],
          },
        ],
      },
    },
  },
  {
    name: 'With document separator',
    yaml: `---
WeekendInfo:
  TrackName: test track`,
    expected: {
      WeekendInfo: {
        TrackName: 'test track',
      },
    },
  },
];

describe('YAML to JSON parsing (js-yaml reference)', () => {
  testCases.forEach(({ name, yaml: yamlStr, expected }) => {
    it(`should parse: ${name}`, () => {
      const parsed = yaml.load(yamlStr);
      console.log(`\n=== ${name} ===`);
      console.log('YAML:\n' + yamlStr);
      console.log('Parsed:', JSON.stringify(parsed, null, 2));
      expect(parsed).toEqual(expected);
    });
  });
});

// Print test YAML strings for manual testing in C++
describe('Print YAML test strings for C++ testing', () => {
  it('prints all test YAML strings', () => {
    console.log('\n\n========== YAML TEST STRINGS FOR C++ ==========\n');
    testCases.forEach(({ name, yaml: yamlStr, expected }) => {
      console.log(`// Test: ${name}`);
      console.log(`const char* yaml = R"(${yamlStr})";`);
      console.log(`// Expected: ${JSON.stringify(expected)}`);
      console.log('');
    });
  });
});
