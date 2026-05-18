import type { ChatMessage } from './types';

// Twitch global emote IDs: Kappa=25, PogChamp=305954156, LUL=425618
export const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    user: 'SpeedDemon99',
    color: '#FF4500',
    text: 'Great overtake on turn 3!',
    emotes: [],
  },
  {
    id: '2',
    user: 'RaceFanatic',
    color: '#1E90FF',
    text: 'That was so close omg',
    emotes: [],
  },
  {
    id: '3',
    user: 'SimRacerPro',
    color: '#00FF7F',
    text: 'Clean racing from everyone today',
    emotes: [],
  },
  {
    id: '4',
    user: 'PitCrewChief',
    color: '#FF69B4',
    text: 'Box box box next lap',
    emotes: [],
  },
  {
    id: '5',
    user: 'TrackDayBro',
    color: '#DAA520',
    text: 'Anyone else seeing the rain coming in?',
    emotes: [],
  },
  {
    id: '6',
    user: 'ApexHunter',
    color: '#5F9EA0',
    text: 'P3! PogChamp Lets gooo',
    emotes: [{ id: '305954156', indices: [[4, 11]] }],
  },
  {
    id: '7',
    user: 'GripLevel100',
    color: '#FF7F50',
    text: 'That dive bomb was sketchy but it worked',
    emotes: [],
  },
  {
    id: '8',
    user: 'FuelStrategist',
    color: '#9ACD32',
    text: 'Saving fuel for the last stint',
    emotes: [],
  },
  {
    id: '9',
    user: 'martinekCZ',
    color: '#a970ff',
    text: 'hello',
    emotes: [],
  },
  {
    id: '10',
    user: 'ondra_sim',
    color: '#2E8B57',
    text: 'What track are we running today?',
    emotes: [],
  },
  {
    id: '11',
    user: 'SpeedFreak99',
    color: '#8A2BE2',
    text: 'Great qualifying PogChamp',
    emotes: [{ id: '305954156', indices: [[18, 25]] }],
  },
  {
    id: '12',
    user: 'PetrDrifts',
    color: '#B22222',
    text: 'Amazing overlay, what software are you using?',
    emotes: [],
  },
  {
    id: '13',
    user: 'SimFanCZ',
    color: '#FF4500',
    text: 'P1 LUL lets go!',
    emotes: [{ id: '425618', indices: [[3, 5]] }],
  },
  {
    id: '14',
    user: 'lukasracer',
    color: '#1E90FF',
    text: 'Just pass him already Kappa',
    emotes: [{ id: '25', indices: [[22, 26]] }],
  },
  {
    id: '15',
    user: 'david_apex',
    color: '#00FF7F',
    text: 'That last sector was absolutely insane, the car looked so planted through the esses!',
    emotes: [],
  },
  {
    id: '16',
    user: 'tomas_apex',
    color: '#FF69B4',
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
    color: '#DAA520',
    text: 'What tires are you on for this track?',
    emotes: [],
  },
  {
    id: '18',
    user: 'petrspeed',
    color: '#5F9EA0',
    text: 'GG Kappa great race',
    emotes: [{ id: '25', indices: [[3, 7]] }],
  },
];

export const DEMO_MESSAGE_INTERVAL_MS = 2000;
