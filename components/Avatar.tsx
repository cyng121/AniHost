/**
 * MyAnimeList's current most-favourited characters (snapshot: 24 Aug 2026).
 * Character art is served by AniList's image CDN; the ranking itself is MAL's.
 */
export interface Character {
  id: number;
  rank: number;
  name: string;
  series: string;
  native: string;
  favourites: number;
  image: string;
}

export const CHARACTERS: Character[] = [
  { id: 417, rank: 1, name: "Lelouch Lamperouge", native: "ルルーシュ・ランペルージ", series: "Code Geass", favourites: 180749, image: "https://s4.anilist.co/file/anilistcdn/character/large/b417-gVLmIJu9phcK.png" },
  { id: 40, rank: 2, name: "Monkey D. Luffy", native: "モンキー・D・ルフィ", series: "One Piece", favourites: 149645, image: "https://s4.anilist.co/file/anilistcdn/character/large/b40-MNypXsxSRb1R.png" },
  { id: 45627, rank: 3, name: "Levi Ackerman", native: "リヴァイ", series: "Attack on Titan", favourites: 146790, image: "https://s4.anilist.co/file/anilistcdn/character/large/b45627-CR68RyZmddGG.png" },
  { id: 71, rank: 4, name: "L Lawliet", native: "エル・ローライト", series: "Death Note", favourites: 131836, image: "https://s4.anilist.co/file/anilistcdn/character/large/b71-1W4panC53vfs.png" },
  { id: 62, rank: 5, name: "Roronoa Zoro", native: "ロロノア・ゾロ", series: "One Piece", favourites: 116395, image: "https://s4.anilist.co/file/anilistcdn/character/large/b62-S7oAeA9WInjV.png" },
  { id: 27, rank: 6, name: "Killua Zoldyck", native: "キルア=ゾルディック", series: "Hunter × Hunter", favourites: 101668, image: "https://s4.anilist.co/file/anilistcdn/character/large/b27-Z5O02kQUydpT.jpg" },
  { id: 35252, rank: 7, name: "Rintarou Okabe", native: "岡部倫太郎", series: "Steins;Gate", favourites: 100635, image: "https://s4.anilist.co/file/anilistcdn/character/large/b35252-DY9TW6pusqeh.png" },
  { id: 80, rank: 8, name: "Light Yagami", native: "夜神月", series: "Death Note", favourites: 100005, image: "https://s4.anilist.co/file/anilistcdn/character/large/b80-26EhwSsSqQ50.png" },
  { id: 11, rank: 9, name: "Edward Elric", native: "エドワード・エルリック", series: "Fullmetal Alchemist: Brotherhood", favourites: 91724, image: "https://s4.anilist.co/file/anilistcdn/character/large/b11-TA5Nuk7EDUZG.jpg" },
  { id: 17, rank: 10, name: "Naruto Uzumaki", native: "うずまきナルト", series: "Naruto", favourites: 87999, image: "https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png" },
  { id: 422, rank: 11, name: "Guts", native: "ガッツ", series: "Berserk", favourites: 86365, image: "https://s4.anilist.co/file/anilistcdn/character/large/b422-XTaiTuvRohsV.png" },
  { id: 672, rank: 12, name: "Gintoki Sakata", native: "坂田銀時", series: "Gintama", favourites: 76838, image: "https://s4.anilist.co/file/anilistcdn/character/large/b672-cP5VPriN67xJ.png" },
  { id: 40882, rank: 13, name: "Eren Yeager", native: "エレン・イェーガー", series: "Attack on Titan", favourites: 75061, image: "https://s4.anilist.co/file/anilistcdn/character/large/b40882-dsj7IP943WFF.jpg" },
  { id: 34470, rank: 14, name: "Kurisu Makise", native: "牧瀬紅莉栖", series: "Steins;Gate", favourites: 69430, image: "https://s4.anilist.co/file/anilistcdn/character/large/b34470-Jw2LXZBL5R8i.png" },
  { id: 14, rank: 15, name: "Itachi Uchiha", native: "うちはイタチ", series: "Naruto", favourites: 67838, image: "https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png" },
  { id: 164471, rank: 16, name: "Satoru Gojo", native: "五条悟", series: "Jujutsu Kaisen", favourites: 64233, image: "https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png" },
  { id: 40881, rank: 17, name: "Mikasa Ackerman", native: "ミカサ・アッカーマン", series: "Attack on Titan", favourites: 57197, image: "https://s4.anilist.co/file/anilistcdn/character/large/b40881-F3gr1PkreDvj.png" },
  { id: 87275, rank: 18, name: "Ken Kaneki", native: "金木研", series: "Tokyo Ghoul", favourites: 55589, image: "https://s4.anilist.co/file/anilistcdn/character/large/b87275-mb13EWZBdbh3.png" },
  { id: 67065, rank: 19, name: "Hachiman Hikigaya", native: "比企谷八幡", series: "My Teen Romantic Comedy SNAFU", favourites: 53687, image: "https://s4.anilist.co/file/anilistcdn/character/large/b67065-Dhec6tE2yWA9.png" },
  { id: 1, rank: 20, name: "Spike Spiegel", native: "スパイク・スピーゲル", series: "Cowboy Bebop", favourites: 49283, image: "https://s4.anilist.co/file/anilistcdn/character/large/b1-ChxaldmieFlQ.png" },
];

export function CharacterMark({ index, size = 36 }: { index: number; size?: number }) {
  const i = ((index % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
  const character = CHARACTERS[i];

  return (
    <span className="character-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={character.image}
        alt=""
        draggable={false}
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

/** The avatar chrome — ring, sizing, and the chosen character inside it. */
export function Avatar({
  index,
  size = "md",
  className,
}: {
  index: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const px = { sm: 28, md: 36, lg: 44, xl: 72 }[size];
  return (
    <span className={["avatar", `avatar--${size}`, className].filter(Boolean).join(" ")}>
      <CharacterMark index={index} size={px} />
    </span>
  );
}
