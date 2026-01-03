import React from 'react';
import 'flag-icons/css/flag-icons.min.css';
import { IRacingFlag } from './IRacingFlag';

interface CountryFlagProps {
  flairId: number;
}

// Hardcoded FlairID to country code mapping
export const FLAIR_ID_TO_COUNTRY_CODE: Record<number, string> = {
  3: 'AF', // Afghanistan
  4: 'AX', // Åland Islands
  5: 'AL', // Albania
  6: 'DZ', // Algeria
  7: 'AS', // American Samoa
  8: 'AD', // Andorra
  9: 'AO', // Angola
  10: 'AI', // Anguilla
  11: 'AQ', // Antarctica
  12: 'AG', // Antigua and Barbuda
  13: 'AR', // Argentina
  14: 'AM', // Armenia
  15: 'AW', // Aruba
  16: 'AU', // Australia
  17: 'AT', // Austria
  18: 'AZ', // Azerbaijan
  19: 'BS', // Bahamas
  20: 'BH', // Bahrain
  21: 'BD', // Bangladesh
  22: 'BB', // Barbados
  23: 'BE', // Belgium
  24: 'BZ', // Belize
  25: 'BJ', // Benin
  26: 'BM', // Bermuda
  27: 'BT', // Bhutan
  28: 'BO', // Bolivia
  29: 'BA', // Bosnia and Herzegovina
  30: 'BW', // Botswana
  31: 'BR', // Brazil
  32: 'VG', // British Virgin Islands
  33: 'BN', // Brunei Darussalam
  34: 'BG', // Bulgaria
  35: 'BF', // Burkina Faso
  36: 'BI', // Burundi
  37: 'KH', // Cambodia
  38: 'CM', // Cameroon
  39: 'CA', // Canada
  40: 'CV', // Cape Verde
  41: 'KY', // Cayman Islands
  42: 'CF', // Central African Republic
  43: 'TD', // Chad
  44: 'CL', // Chile
  45: 'CN', // China
  46: 'CX', // Christmas Island
  47: 'CC', // Cocos (Keeling) Islands
  48: 'CO', // Colombia
  49: 'KM', // Comoros
  50: 'CK', // Cook Islands
  51: 'CR', // Costa Rica
  52: 'HR', // Croatia
  53: 'CY', // Cyprus
  54: 'CZ', // Czechia
  55: 'CD', // Democratic Republic of the Congo
  56: 'DK', // Denmark
  57: 'DJ', // Djibouti
  58: 'DM', // Dominica
  59: 'DO', // Dominican Republic
  60: 'EC', // Ecuador
  61: 'EG', // Egypt
  62: 'SV', // El Salvador
  63: 'GQ', // Equatorial Guinea
  64: 'ER', // Eritrea
  65: 'EE', // Estonia
  66: 'ET', // Ethiopia
  67: 'FK', // Falkland Islands
  68: 'FO', // Faroe Islands
  69: 'FJ', // Fiji
  70: 'FI', // Finland
  71: 'FR', // France
  72: 'GF', // French Guiana
  73: 'PF', // French Polynesia
  74: 'GA', // Gabon
  75: 'GM', // Gambia
  76: 'GE', // Georgia
  77: 'DE', // Germany
  78: 'GH', // Ghana
  79: 'GI', // Gibraltar
  80: 'GR', // Greece
  81: 'GL', // Greenland
  82: 'GD', // Grenada
  83: 'GP', // Guadeloupe
  84: 'GU', // Guam
  85: 'GT', // Guatemala
  86: 'GG', // Guernsey
  87: 'GN', // Guinea
  88: 'GW', // Guinea-Bissau
  89: 'GY', // Guyana
  90: 'HT', // Haiti
  91: 'HN', // Honduras
  92: 'HK', // Hong Kong
  93: 'HU', // Hungary
  94: 'IS', // Iceland
  95: 'IN', // India
  96: 'ID', // Indonesia
  97: 'IQ', // Iraq
  98: 'IE', // Ireland
  99: 'IM', // Isle of Man
  100: 'IL', // Israel
  101: 'IT', // Italy
  102: 'CI', // Ivory Coast
  103: 'JM', // Jamaica
  104: 'JP', // Japan
  105: 'JE', // Jersey
  106: 'JO', // Jordan
  107: 'KZ', // Kazakhstan
  108: 'KE', // Kenya
  109: 'KI', // Kiribati
  110: 'KW', // Kuwait
  111: 'KG', // Kyrgyzstan
  112: 'LA', // Laos
  113: 'LV', // Latvia
  114: 'LB', // Lebanon
  115: 'LS', // Lesotho
  116: 'LR', // Liberia
  117: 'LY', // Libya
  118: 'LI', // Liechtenstein
  119: 'LT', // Lithuania
  120: 'LU', // Luxembourg
  121: 'MO', // Macau
  122: 'MK', // Macedonia
  123: 'MG', // Madagascar
  124: 'MW', // Malawi
  125: 'MY', // Malaysia
  126: 'MV', // Maldives
  127: 'ML', // Mali
  128: 'MT', // Malta
  129: 'MH', // Marshall Islands
  130: 'MQ', // Martinique
  131: 'MR', // Mauritania
  132: 'MU', // Mauritius
  133: 'YT', // Mayotte
  134: 'MX', // Mexico
  135: 'FM', // Micronesia
  136: 'MD', // Moldova
  137: 'MC', // Monaco
  138: 'MN', // Mongolia
  139: 'ME', // Montenegro
  140: 'MS', // Montserrat
  141: 'MA', // Morocco
  142: 'MZ', // Mozambique
  143: 'NA', // Namibia
  144: 'NR', // Nauru
  145: 'NP', // Nepal
  146: 'NL', // Netherlands
  148: 'NC', // New Caledonia
  149: 'NZ', // New Zealand
  150: 'NI', // Nicaragua
  151: 'NE', // Niger
  152: 'NG', // Nigeria
  153: 'NU', // Niue
  154: 'NF', // Norfolk Island
  155: 'MP', // Northern Mariana Islands
  156: 'NO', // Norway
  157: 'OM', // Oman
  158: 'PK', // Pakistan
  159: 'PW', // Palau
  160: 'PS', // Palestine
  161: 'PA', // Panama
  162: 'PG', // Papua New Guinea
  163: 'PY', // Paraguay
  164: 'PE', // Peru
  165: 'PH', // Philippines
  166: 'PN', // Pitcairn Islands
  167: 'PL', // Poland
  168: 'PT', // Portugal
  169: 'PR', // Puerto Rico
  170: 'QA', // Qatar
  171: 'CG', // Republic of the Congo
  172: 'RE', // Reunion
  173: 'RO', // Romania
  174: 'RW', // Rwanda
  175: 'SH', // Saint Helena
  176: 'KN', // Saint Kitts and Nevis
  177: 'LC', // Saint Lucia
  178: 'PM', // Saint Pierre & Miquelon
  179: 'VC', // Saint Vincent and the Grenadines
  180: 'BL', // Saint-Barthélemy
  181: 'MF', // Saint-Martin
  182: 'WS', // Samoa
  183: 'SM', // San Marino
  184: 'ST', // Sao Tome and Principe
  185: 'SA', // Saudi Arabia
  186: 'SN', // Senegal
  187: 'RS', // Serbia
  188: 'SC', // Seychelles
  189: 'SL', // Sierra Leone
  190: 'SG', // Singapore
  191: 'SK', // Slovakia
  192: 'SI', // Slovenia
  193: 'SB', // Solomon Islands
  194: 'SO', // Somalia
  195: 'ZA', // South Africa
  196: 'GS', // South Georgia & South Sandwich Islands
  197: 'KR', // South Korea
  198: 'ES', // Spain
  199: 'LK', // Sri Lanka
  200: 'SR', // Suriname
  201: 'SJ', // Svalbard
  202: 'SZ', // Eswatini
  203: 'SE', // Sweden
  204: 'CH', // Switzerland
  205: 'TW', // Taiwan
  206: 'TJ', // Tajikistan
  207: 'TZ', // Tanzania
  208: 'TH', // Thailand
  209: 'TL', // Timor-Leste
  210: 'TG', // Togo
  211: 'TK', // Tokelau
  212: 'TO', // Tonga
  213: 'TT', // Trinidad and Tobago
  214: 'TN', // Tunisia
  215: 'TR', // Türkiye
  216: 'TM', // Turkmenistan
  217: 'TC', // Turks and Caicos Islands
  218: 'TV', // Tuvalu
  219: 'UG', // Uganda
  220: 'UA', // Ukraine
  221: 'AE', // United Arab Emirates
  222: 'GB', // United Kingdom
  223: 'US', // United States
  224: 'UY', // Uruguay
  225: 'UZ', // Uzbekistan
  226: 'VU', // Vanuatu
  227: 'VA', // Vatican City
  228: 'VE', // Venezuela
  229: 'VN', // Vietnam
  230: 'VI', // Virgin Islands
  231: 'WF', // Wallis and Futuna
  232: 'EH', // Western Sahara
  233: 'YE', // Yemen
  234: 'ZM', // Zambia
  235: 'ZW', // Zimbabwe
  236: 'GB-ENG', // England
  237: 'GB-SCT', // Scotland
  238: 'GB-WLS', // Wales
  239: 'GB-NIR', // Northern Ireland
  240: 'BQ', // Bonaire, Sint Eustatius and Saba
  241: 'CW', // Curaçao
  242: 'SX', // Sint Maarten (Dutch part)
};

// Map FlairID to country code
const getCountryCodeFromFlairId = (flairId: number): string => {
  return FLAIR_ID_TO_COUNTRY_CODE[flairId];
};

export const CountryFlag: React.FC<CountryFlagProps> = ({
  flairId
}) => {
  const countryCode = getCountryCodeFromFlairId(flairId);

  if (!countryCode) {
    return <IRacingFlag />;
  }

  return (
    <span
      className={`fi fi-${countryCode.toLowerCase()}`}
    />
  );
};
