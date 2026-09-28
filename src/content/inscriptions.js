// The lettering stays in Russian in the world. These notes are the English layer.
// Context describes the object or cultural reference, not a claim about a real address.
export const graffitiNotes = {
  tsoi: {
    original: 'ЦОЙ ЖИВ', translation: 'Tsoi lives on',
    context: 'A tribute to Viktor Tsoi, the singer of the Soviet rock band Kino. This phrase continued to appear on walls long after his death in 1990.',
  },
  kino: {
    original: 'КИНО', translation: 'Kino',
    context: 'The name of Viktor Tsoi’s band. Written here like the name of a band you would find on a wall, a cassette, or a school notebook.',
  },
  lena: {
    original: 'Лена + Дима = ♥', translation: 'Lena + Dima = ♥',
    context: 'A small declaration of love in the passageway. First names and hearts were an everyday part of the courtyard’s informal walls.',
  },
  aria: {
    original: 'Ария', translation: 'Aria',
    context: 'The name of a Russian heavy metal band, left like a fan’s signature on the end wall.',
  },
  gaz: {
    original: 'ГАЗ-53 — сила!', translation: 'GAZ-53 rules!',
    context: 'The GAZ-53 was a common Soviet truck. This boast turns a piece of everyday machinery into a local hero.',
  },
  parking: {
    original: 'НЕ ПАРКОВАТЬСЯ!', translation: 'NO PARKING!',
    context: 'A homemade warning on a garage door. In these shared yards, residents often marked their own boundaries.',
  },
  spartak: {
    original: 'Спартак — чемпион', translation: 'Spartak are champions',
    context: 'A football fan’s chalk slogan. Club loyalties were visible well beyond the stadium.',
  },
};

const notices = [
  { original: 'ПРОДАМ гараж-ракушку недорого', translation: 'FOR SALE: shell garage, cheap', context: 'A “shell” was a curved metal garage placed near apartment blocks. Paper ads with tear-off phone numbers served as a neighbourhood marketplace.' },
  { original: 'СНИМУ квартиру без посредников', translation: 'WANTED: apartment to rent, no agents', context: '“No agents” meant arranging a rental directly with the owner. The phone tabs let people take the number without removing the notice.' },
  { original: 'РЕМОНТ телевизоров на дому', translation: 'TV REPAIR at your home', context: 'A household service advertised on paper, from a time when repairing a television was often more practical than replacing it.' },
  { original: 'ПОТЕРЯЛСЯ кот рыжий вознагр.', translation: 'LOST: ginger cat. Reward.', context: '“Вознагр.” abbreviates “reward.” The torn phone tabs suggest neighbours have already stopped to look.' },
];

export const noticeNote = (seed) => notices[seed % notices.length];
export const entranceNote = (entrance) => ({
  original: `${entrance.n} · кв. ${entrance.flats[0]}–${entrance.flats[1]}`,
  translation: `Entrance ${entrance.n} · flats ${entrance.flats[0]}–${entrance.flats[1]}`,
  context: 'A blue enamel plate identifies an apartment entrance and its flat numbers. “Подъезд” means the shared stairwell entrance.',
});
export const addressNote = (street, number) => ({
  original: `${street}, ${number}`,
  translation: `${street.includes('Гагарина') ? 'Gagarin Street' : 'Builders Street'}, ${number}`,
  context: 'Street names honoured professions and public figures. These enamel address plates helped you find the right block among very similar buildings.',
});
export const tramNote = {
  original: '7 · Завод', translation: 'Route 7 · Factory',
  context: '“Завод” means factory. A tram destination could describe the workplace at the end of a route and the rhythm of the surrounding neighbourhood.',
};
export const hopscotchNote = {
  original: 'НЕБО', translation: 'SKY',
  context: 'The final square in this chalk hopscotch game is “sky.” A small imagined destination drawn directly on the asphalt.',
};
