import type { ChatMessage } from './types';

// Twitch global emote IDs: Kappa=25, PogChamp=305954156, LUL=425618
export const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    user: 'SpeedDemon99',
    text: 'Great overtake on turn 3!',
    emotes: [],
  },
  { id: '2', user: 'RaceFanatic', text: 'That was so close omg', emotes: [] },
  {
    id: '3',
    user: 'SimRacerPro',
    text: 'Clean racing from everyone today',
    emotes: [],
  },
  { id: '4', user: 'PitCrewChief', text: 'Box box box next lap', emotes: [] },
  {
    id: '5',
    user: 'TrackDayBro',
    text: 'Anyone else seeing the rain coming in?',
    emotes: [],
  },
  {
    id: '6',
    user: 'ApexHunter',
    text: 'P3! PogChamp Lets gooo',
    emotes: [{ id: '305954156', indices: [[4, 11]] }],
  },
  {
    id: '7',
    user: 'GripLevel100',
    text: 'That dive bomb was sketchy but it worked',
    emotes: [],
  },
  {
    id: '8',
    user: 'FuelStrategist',
    text: 'Saving fuel for the last stint',
    emotes: [],
  },
  {
    id: '9',
    user: 'martinekCZ',
    text: 'hello',
    emotes: [],
  },
  {
    id: '10',
    user: 'ondra_sim',
    text: 'What track are we running today?',
    emotes: [],
  },
  {
    id: '11',
    user: 'SpeedFreak99',
    text: 'Great qualifying PogChamp',
    emotes: [{ id: '305954156', indices: [[18, 25]] }],
  },
  {
    id: '12',
    user: 'PetrDrifts',
    text: 'Amazing overlay, what software are you using?',
    emotes: [],
  },
  {
    id: '13',
    user: 'SimFanCZ',
    text: 'P1 LUL lets go!',
    emotes: [{ id: '425618', indices: [[3, 5]] }],
  },
  {
    id: '14',
    user: 'lukasracer',
    text: 'Just pass him already Kappa',
    emotes: [{ id: '25', indices: [[22, 26]] }],
  },
  {
    id: '15',
    user: 'david_apex',
    text: 'That last sector was absolutely insane, the car looked so planted through the esses!',
    emotes: [],
  },
  {
    id: '16',
    user: 'tomas_apex',
    text: 'PogChamp PogChamp what an overtake!',
    emotes: [
      {
        id: '305954156',
        indices: [
          [0, 7],
          [9, 16],
        ],
      },
    ],
  },
  {
    id: '17',
    user: 'jan_sim',
    text: 'What tires are you on for this track?',
    emotes: [],
  },
  {
    id: '18',
    user: 'petrspeed',
    text: 'GG Kappa great race',
    emotes: [{ id: '25', indices: [[3, 7]] }],
  },
];

export const DEMO_MESSAGE_INTERVAL_MS = 2000;
