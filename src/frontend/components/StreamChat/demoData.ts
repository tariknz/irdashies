import type { ChatMessage } from './types';

/** Demo messages are shown unfiltered, so they name no channel. */
export type DemoMessage = Omit<ChatMessage, 'channel'>;

// Twitch global emote IDs: Kappa=25, PogChamp=305954156, LUL=425618
export const DEMO_MESSAGES: DemoMessage[] = [
  {
    id: '1',
    platform: 'twitch',
    timestamp: 0,
    user: 'SpeedDemon99',
    color: '#FF4500',
    text: 'Great overtake on turn 3!',
    emotes: [],
  },
  {
    id: '2',
    platform: 'twitch',
    timestamp: 0,
    user: 'RaceFanatic',
    color: '#1E90FF',
    text: 'That was so close omg',
    emotes: [],
  },
  {
    id: '3',
    platform: 'twitch',
    timestamp: 0,
    user: 'SimRacerPro',
    color: '#00FF7F',
    text: 'Clean racing from everyone today',
    emotes: [],
  },
  {
    id: '4',
    platform: 'twitch',
    timestamp: 0,
    user: 'PitCrewChief',
    color: '#FF69B4',
    text: 'Box box box next lap',
    emotes: [],
  },
  {
    id: '5',
    platform: 'twitch',
    timestamp: 0,
    user: 'TrackDayBro',
    color: '#DAA520',
    text: 'Anyone else seeing the rain coming in?',
    emotes: [],
  },
  {
    id: '6',
    platform: 'twitch',
    timestamp: 0,
    user: 'ApexHunter',
    color: '#5F9EA0',
    text: 'P3! PogChamp Lets gooo',
    emotes: [{ id: '305954156', indices: [[4, 11]] }],
  },
  {
    id: '7',
    platform: 'twitch',
    timestamp: 0,
    user: 'GripLevel100',
    color: '#FF7F50',
    text: 'That dive bomb was sketchy but it worked',
    emotes: [],
  },
  {
    id: '8',
    platform: 'twitch',
    timestamp: 0,
    user: 'FuelStrategist',
    color: '#9ACD32',
    text: 'Saving fuel for the last stint',
    emotes: [],
  },
  {
    id: '9',
    platform: 'twitch',
    timestamp: 0,
    user: 'martinekCZ',
    color: '#a970ff',
    text: 'hello',
    emotes: [],
  },
  {
    id: '10',
    platform: 'twitch',
    timestamp: 0,
    user: 'ondra_sim',
    color: '#2E8B57',
    text: 'What track are we running today?',
    emotes: [],
  },
  {
    id: '11',
    platform: 'twitch',
    timestamp: 0,
    user: 'SpeedFreak99',
    color: '#8A2BE2',
    text: 'Great qualifying PogChamp',
    emotes: [{ id: '305954156', indices: [[18, 25]] }],
  },
  {
    id: '12',
    platform: 'twitch',
    timestamp: 0,
    user: 'PetrDrifts',
    color: '#B22222',
    text: 'Amazing overlay, what software are you using?',
    emotes: [],
  },
  {
    id: '13',
    platform: 'twitch',
    timestamp: 0,
    user: 'SimFanCZ',
    color: '#FF4500',
    text: 'P1 LUL lets go!',
    emotes: [{ id: '425618', indices: [[3, 5]] }],
  },
  {
    id: '14',
    platform: 'twitch',
    timestamp: 0,
    user: 'lukasracer',
    color: '#1E90FF',
    text: 'Just pass him already Kappa',
    emotes: [{ id: '25', indices: [[22, 26]] }],
  },
  {
    id: '15',
    platform: 'twitch',
    timestamp: 0,
    user: 'david_apex',
    color: '#00FF7F',
    text: 'That last sector was absolutely insane, the car looked so planted through the esses!',
    emotes: [],
  },
  {
    id: '16',
    platform: 'twitch',
    timestamp: 0,
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
    platform: 'twitch',
    timestamp: 0,
    user: 'jan_sim',
    color: '#DAA520',
    text: 'What tires are you on for this track?',
    emotes: [],
  },
  {
    id: '18',
    platform: 'twitch',
    timestamp: 0,
    user: 'petrspeed',
    color: '#5F9EA0',
    text: 'GG Kappa great race',
    emotes: [{ id: '25', indices: [[3, 7]] }],
  },
  {
    id: '101',
    platform: 'youtube',
    timestamp: 0,
    user: 'JanaOnTrack',
    text: 'Skvely zavod!',
    emotes: [],
    segments: [{ type: 'text', text: 'Skvely zavod!' }],
    badges: [{ kind: 'member', label: 'Member' }],
  },
  {
    id: '102',
    platform: 'youtube',
    timestamp: 0,
    user: 'ModeratorMilan',
    text: 'Please keep the chat friendly',
    emotes: [],
    segments: [{ type: 'text', text: 'Please keep the chat friendly' }],
    badges: [{ kind: 'moderator', label: 'Moderator' }],
  },
  {
    id: '103',
    platform: 'youtube',
    timestamp: 0,
    user: 'RacingMartin',
    text: 'Kdo vyhraje dneska?',
    emotes: [],
    segments: [{ type: 'text', text: 'Kdo vyhraje dneska?' }],
  },
  {
    id: '104',
    platform: 'youtube',
    timestamp: 0,
    user: 'StreamOwner',
    text: 'Thanks for watching, leave a like!',
    emotes: [],
    segments: [{ type: 'text', text: 'Thanks for watching, leave a like!' }],
    badges: [{ kind: 'owner', label: 'Owner' }],
  },
  {
    id: '105',
    platform: 'youtube',
    timestamp: 0,
    user: 'LucieSimRacing',
    text: 'That last corner was perfect',
    emotes: [],
    segments: [{ type: 'text', text: 'That last corner was perfect' }],
    badges: [{ kind: 'verified', label: 'Verified' }],
  },
  {
    id: '106',
    platform: 'youtube',
    timestamp: 0,
    user: 'TomasFromPrague',
    text: 'Pozdrav z Prahy!',
    emotes: [],
    segments: [{ type: 'text', text: 'Pozdrav z Prahy!' }],
  },
];

export interface DemoPlatforms {
  twitch: boolean;
  youtube: boolean;
}

/**
 * Demo messages for the platforms that are set up, Twitch and YouTube mixed
 * the way live chat would be. Nothing is returned for a platform with no
 * channel, so the demo shows what the real widget would.
 */
export const getDemoMessages = ({
  twitch,
  youtube,
}: DemoPlatforms): DemoMessage[] => {
  const twitchMessages = twitch
    ? DEMO_MESSAGES.filter((m) => m.platform === 'twitch')
    : [];
  const youtubeMessages = youtube
    ? DEMO_MESSAGES.filter((m) => m.platform === 'youtube')
    : [];
  if (!twitchMessages.length || !youtubeMessages.length) {
    return [...twitchMessages, ...youtubeMessages];
  }

  const mixed: DemoMessage[] = [];
  const total = twitchMessages.length + youtubeMessages.length;
  let t = 0;
  let y = 0;
  for (let i = 0; i < total; i++) {
    // About one YouTube message in every three keeps the mix lifelike.
    const takeYoutube =
      y < youtubeMessages.length && (t >= twitchMessages.length || i % 3 === 2);
    mixed.push(takeYoutube ? youtubeMessages[y++] : twitchMessages[t++]);
  }
  return mixed;
};

export const DEMO_MESSAGE_INTERVAL_MS = 2000;
