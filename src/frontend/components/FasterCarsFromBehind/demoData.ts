// Demo data for Faster Cars From Behind component
export interface DemoDriver {
  carIdx: number;
  name: string;
  license: string;
  rating: number;
  distance: number;
  percent: number;
  classColor: number;
}

// Generate demo data for faster cars behind
export const getDemoCarsBehind = (numberDriversBehind: number): DemoDriver[] => {
  const demoDrivers: DemoDriver[] = [
    {
      carIdx: 1001,
      name: 'Tarik Alani',
      license: 'A 2.49',
      rating: 1281,
      distance: -1.2,
      percent: 85,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1002,
      name: 'Bjørn Andersen',
      license: 'B 2.70',
      rating: 1256,
      distance: -2.5,
      percent: 65,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1003,
      name: 'Ethan D Wilson',
      license: 'C 3.37',
      rating: 1300,
      distance: -3.8,
      percent: 45,
      classColor: 11430911, // MX-5 Cup color
    },
    {
      carIdx: 1004,
      name: 'Ben Schmid',
      license: 'D 3.39',
      rating: 1510,
      distance: -4.1,
      percent: 35,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1005,
      name: 'Zoltán Szakács',
      license: 'C 3.71',
      rating: 1490,
      distance: -4.8,
      percent: 28,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1006,
      name: 'Jack Tomlinson2',
      license: 'D 3.59',
      rating: 1271,
      distance: -5.2,
      percent: 22,
      classColor: 16767577, // BMW M4 GT4 color
    },
    {
      carIdx: 1007,
      name: 'Romain Vergeon',
      license: 'D 2.95',
      rating: 1512,
      distance: -5.9,
      percent: 18,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1008,
      name: 'Anguiano Perez',
      license: 'B 2.37',
      rating: 1505,
      distance: -6.5,
      percent: 15,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1009,
      name: 'Liu Hang3',
      license: 'D 3.92',
      rating: 1444,
      distance: -7.1,
      percent: 12,
      classColor: 16734344, // Toyota GR86 color
    },
    {
      carIdx: 1010,
      name: 'Thomas Searle',
      license: 'A 2.18',
      rating: 2401,
      distance: -7.8,
      percent: 8,
      classColor: 11430911, // MX-5 Cup color
    },
  ];

  // Return only the number of drivers the user has configured
  return demoDrivers.slice(0, numberDriversBehind);
};
