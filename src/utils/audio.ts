import { CallerVoiceStyle } from '../types';

/**
 * Custom pronunciation dictionary to ensure browser speech synthesis engines
 * pronounce names and darts terms accurately according to league specifications.
 * e.g., "Guy" / "Gui" is pronounced "Ghee" (/ɡiː/).
 */
export function formatPhoneticsForSpeech(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bGuy\b/g, 'Ghee')
    .replace(/\bguy\b/g, 'ghee')
    .replace(/\bGUY\b/g, 'GHEE')
    .replace(/\bGuy's\b/g, "Ghee's")
    .replace(/\bGui\b/g, 'Ghee')
    .replace(/\bgui\b/g, 'ghee')
    .replace(/\bGUI\b/g, 'GHEE')
    .replace(/\bGui's\b/g, "Ghee's");
}

export interface CallerProfile {
  id: CallerVoiceStyle;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  defaultPitch: number;
  defaultRate: number;
  accentPreference: string[]; // preferred language codes, e.g. ['en-GB', 'en-UK']
  genderPreference: 'male' | 'female' | 'any';
  tag?: string;
}

export const CALLER_PROFILES: Record<CallerVoiceStyle, CallerProfile> = {
  pdc_russ: {
    id: 'pdc_russ',
    name: 'Russ Bray "The Voice" (PDC Darts)',
    subtitle: 'Iconic Gravelly Ally Pally Legend',
    description: 'The legendary raspy, roaring PDC Hall of Fame referee. World-famous for the gravelly "ONE HUNDRED AND EEE-EIGHTY!" and booming "Game on!".',
    icon: '🎯',
    defaultPitch: 0.76,
    defaultRate: 0.98,
    accentPreference: ['en-GB', 'en-UK', 'en-IE', 'en'],
    genderPreference: 'male',
    tag: 'Official PDC',
  },
  pdc_kirk: {
    id: 'pdc_kirk',
    name: 'Kirk Bevins "The Quiff" (PDC Master)',
    subtitle: 'PDC World Championship Stage Referee',
    description: 'Lightning-fast, mathematical genius of the PDC World Championship. Renowned for instant checkout math and sharp, authoritative referee cadence.',
    icon: '⚡',
    defaultPitch: 0.98,
    defaultRate: 1.10,
    accentPreference: ['en-GB', 'en-UK', 'en'],
    genderPreference: 'male',
    tag: 'Official PDC',
  },
  pdc_george: {
    id: 'pdc_george',
    name: 'George Noble "The Voice of Reason" (PDC)',
    subtitle: 'PDC Hall of Famer & Velvet Baritone',
    description: 'Smooth, dignified, resonant World Championship caller. Renowned for unflappable stage presence and classic, rhythmic announcements.',
    icon: '🎙️',
    defaultPitch: 0.84,
    defaultRate: 1.00,
    accentPreference: ['en-GB', 'en-UK', 'en'],
    genderPreference: 'male',
    tag: 'Official PDC',
  },
  pdc_huw: {
    id: 'pdc_huw',
    name: 'Huw Ware (Welsh PDC Stage Referee)',
    subtitle: 'Dynamic Modern PDC Arena Official',
    description: 'Young, energetic PDC referee with melodic Welsh cadence, punchy stage tempo, and vibrant leg call-outs.',
    icon: '🐉',
    defaultPitch: 1.02,
    defaultRate: 1.08,
    accentPreference: ['en-GB', 'en-UK', 'en'],
    genderPreference: 'male',
    tag: 'Official PDC',
  },
  mc_john: {
    id: 'mc_john',
    name: 'John McDonald (World Championship MC)',
    subtitle: 'Legendary Arena Master of Ceremonies',
    description: 'The booming, electrifying arena announcer! Iconic theatrical stage introductions: "Ladies and Gentlemen... LET\'S PLAY DARTS!"',
    icon: '📢',
    defaultPitch: 0.82,
    defaultRate: 0.96,
    accentPreference: ['en-GB', 'en-UK', 'en'],
    genderPreference: 'male',
    tag: 'Arena MC',
  },
  pdc_official: {
    id: 'pdc_official',
    name: 'PDC Master Referee (Kirk Bevins & George Noble)',
    subtitle: 'Official PDC World Championship Stage Caller',
    description: 'Crisp, lightning-fast PDC stage official. Features authentic "Game on!", checkout requirements ("You require 40"), and electrifying stage tempo.',
    icon: '🏆',
    defaultPitch: 0.95,
    defaultRate: 1.08,
    accentPreference: ['en-GB', 'en-UK', 'en-IE', 'en'],
    genderPreference: 'male',
    tag: 'Official PDC',
  },
  irish_caller: {
    id: 'irish_caller',
    name: 'Irish Stage Referee (Dublin Arena)',
    subtitle: 'Emerald Isle Darts Master',
    description: 'Warm Dublin lilt, spirited tournament enthusiasm, and energetic 180s with genuine Emerald Isle charm.',
    icon: '☘️',
    defaultPitch: 0.96,
    defaultRate: 1.04,
    accentPreference: ['en-IE', 'en-GB', 'en'],
    genderPreference: 'male',
    tag: 'Irish Tour',
  },
  us_pro: {
    id: 'us_pro',
    name: 'American Pro Circuit (Vegas Masters)',
    subtitle: 'North American Tour Official',
    description: 'Crisp, commanding American sports referee style with powerful delivery and clear championship presence.',
    icon: '🇺🇸',
    defaultPitch: 0.92,
    defaultRate: 1.04,
    accentPreference: ['en-US', 'en'],
    genderPreference: 'male',
    tag: 'US Circuit',
  },
  aussie_pro: {
    id: 'aussie_pro',
    name: 'Australian Masters Caller (Down Under)',
    subtitle: 'Brisbane & Melbourne Stage Referee',
    description: 'Passionate Aussie tournament caller bringing vibrant Down Under energy and hearty tournament calls.',
    icon: '🇦🇺',
    defaultPitch: 0.98,
    defaultRate: 1.06,
    accentPreference: ['en-AU', 'en-NZ', 'en-GB'],
    genderPreference: 'any',
    tag: 'Aussie Tour',
  },
  dutch_pro: {
    id: 'dutch_pro',
    name: 'Euro Tour Referee (Continental Master)',
    subtitle: 'European Tour Stage Official',
    description: 'Crisp, international European Tour referee style inspired by the Rotterdam and German darts stages. Sharp and professional.',
    icon: '🇳🇱',
    defaultPitch: 0.94,
    defaultRate: 1.06,
    accentPreference: ['en-GB', 'en-NL', 'en'],
    genderPreference: 'male',
    tag: 'Euro Tour',
  },
  british: {
    id: 'british',
    name: 'British Tournament Referee',
    subtitle: 'Traditional UK Stage Caller',
    description: 'Deep, resonant British darts referee announcements with authentic county and national tournament cadence.',
    icon: '🇬🇧',
    defaultPitch: 0.88,
    defaultRate: 1.02,
    accentPreference: ['en-GB', 'en-UK', 'en-IE'],
    genderPreference: 'male',
  },
  male: {
    id: 'male',
    name: 'Classic Male Referee',
    subtitle: 'Standard Official Caller',
    description: 'Crisp, authoritative, traditional referee announcements.',
    icon: '🎙️',
    defaultPitch: 1.0,
    defaultRate: 1.05,
    accentPreference: ['en-GB', 'en-US', 'en'],
    genderPreference: 'male',
  },
  female: {
    id: 'female',
    name: 'Classic Female Referee',
    subtitle: 'Professional Stage Caller',
    description: 'Clear, energetic, high-clarity female tournament caller.',
    icon: '🎤',
    defaultPitch: 1.15,
    defaultRate: 1.05,
    accentPreference: ['en-GB', 'en-US', 'en-AU', 'en'],
    genderPreference: 'female',
  },
  scottish: {
    id: 'scottish',
    name: 'Scottish (Highland Darts)',
    subtitle: 'Braw Arrows & Tartan Spirit',
    description: 'Lively Scottish caller with passionate dialect, quips, and belter 180s.',
    icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    defaultPitch: 0.95,
    defaultRate: 1.08,
    accentPreference: ['en-GB', 'en-IE', 'en-AU'],
    genderPreference: 'any',
  },
  jamaican: {
    id: 'jamaican',
    name: 'Jamaican (Island Vibes)',
    subtitle: 'Reggae & Good Energy',
    description: 'Warm Caribbean rhythm, upbeat energy, and "Large up yuhself!" hype.',
    icon: '🇯🇲',
    defaultPitch: 1.05,
    defaultRate: 1.08,
    accentPreference: ['en-US', 'en-ZA', 'en-GB'],
    genderPreference: 'any',
  },
  funny: {
    id: 'funny',
    name: 'Funny / Hype Master',
    subtitle: 'Comedic & Unhinged Commentary',
    description: 'Laugh-out-loud roasts on low scores, explosive 180 hype, and cheeky banter.',
    icon: '⚡',
    defaultPitch: 1.2,
    defaultRate: 1.12,
    accentPreference: ['en-US', 'en-GB', 'en'],
    genderPreference: 'any',
  },
  serious: {
    id: 'serious',
    name: 'Serious / BDO Official',
    subtitle: 'Deadpan & Ultra-Formal',
    description: 'Strict, no-nonsense tournament official. Just the numbers, zero fluff.',
    icon: '📋',
    defaultPitch: 0.9,
    defaultRate: 0.95,
    accentPreference: ['en-GB', 'en-US'],
    genderPreference: 'any',
  },
};

class DartAnnouncer {
  private enabled: boolean = true;
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voice: SpeechSynthesisVoice | null = null;
  private voiceStyle: CallerVoiceStyle = 'pdc_russ';
  private pitch: number = 0.76;
  private rate: number = 0.98;
  private volume: number = 1.0;
  private customVoiceURI: string | null = null;
  private deletedVoiceStyles: Set<CallerVoiceStyle> = new Set();
  private voiceListeners: Array<() => void> = [];
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isScoreSpeaking: boolean = false;
  private queuedTurnCall: (() => void) | null = null;
  private scoreSafetyTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Load deleted voices managed by admin
      try {
        const savedDeleted = localStorage.getItem('kaboom_deleted_voices');
        if (savedDeleted) {
          const parsed = JSON.parse(savedDeleted);
          if (Array.isArray(parsed)) {
            this.deletedVoiceStyles = new Set(parsed as CallerVoiceStyle[]);
          }
        }
      } catch (e) {}

      // 2. Load saved caller settings
      try {
        const savedSettings = localStorage.getItem('kaboom_caller_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.voiceStyle && CALLER_PROFILES[parsed.voiceStyle as CallerVoiceStyle]) {
            this.voiceStyle = parsed.voiceStyle as CallerVoiceStyle;
          }
          if (typeof parsed.enabled === 'boolean') this.enabled = parsed.enabled;
          if (typeof parsed.pitch === 'number') this.pitch = parsed.pitch;
          if (typeof parsed.rate === 'number') this.rate = parsed.rate;
          if (typeof parsed.volume === 'number') this.volume = parsed.volume;
          if (typeof parsed.customVoiceURI === 'string' || parsed.customVoiceURI === null) {
            this.customVoiceURI = parsed.customVoiceURI;
          }
        }
      } catch (e) {}

      // Ensure active voice is not in deleted set
      if (this.deletedVoiceStyles.has(this.voiceStyle)) {
        const available = this.getAvailableVoiceStyles();
        if (available.length > 0) {
          this.voiceStyle = available[0];
        }
      }

      if (this.synth) {
        const updateVoice = () => {
          this.pickBestVoice();
        };
        updateVoice();
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = updateVoice;
        }
      }
    }
  }

  /**
   * Smart voice picker prioritizing Natural, Neural, Online, Enhanced, and Studio
   * high-definition browser speech voices matching referee personas.
   */
  private pickBestVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices() || [];
    if (!voices.length) return;

    // Check custom user/admin assigned physical voice
    if (this.customVoiceURI) {
      const match = voices.find(v => v.voiceURI === this.customVoiceURI || v.name === this.customVoiceURI);
      if (match) {
        this.voice = match;
        return;
      }
    }

    const profile = CALLER_PROFILES[this.voiceStyle] || CALLER_PROFILES.pdc_russ;

    // Score candidates dynamically
    const scored = voices.map(v => {
      let score = 0;
      const lowerName = v.name.toLowerCase();
      const lowerLang = v.lang.toLowerCase();

      // 1. Natural / Neural / Enhanced speech engine boost
      if (/natural|neural|enhanced|premium|studio|online|siri|google/i.test(lowerName)) {
        score += 50;
      }

      // 2. Accent & Locale match
      const primaryLang = profile.accentPreference[0]?.toLowerCase() || 'en';
      if (lowerLang.startsWith(primaryLang)) {
        score += 45;
      } else if (profile.accentPreference.some(pref => lowerLang.startsWith(pref.toLowerCase()))) {
        score += 25;
      } else if (lowerLang.startsWith('en')) {
        score += 10;
      } else {
        score -= 60; // Penalty for non-English voices
      }

      // 3. Gender preference match
      const isFemale = /female|woman|samantha|victoria|zira|karen|catherine|moira|fiona|susan|hazel|stephanie|libby|sonia|jenny|ava/i.test(lowerName);
      const isMale = /male|man|daniel|george|oliver|david|alex|james|brian|arthur|russ|tom|ryan|guy|christopher|eric|andrew|conor/i.test(lowerName);

      if (profile.genderPreference === 'female') {
        if (isFemale) score += 35;
        if (isMale) score -= 40;
      } else if (profile.genderPreference === 'male') {
        if (isMale) score += 35;
        if (isFemale) score -= 40;
      }

      // 4. Persona-specific matching heuristics
      if (this.voiceStyle === 'pdc_russ' && /russ|gravel|george|daniel|brian|arthur|guy|ryan|google uk english male/i.test(lowerName)) {
        score += 25;
      } else if (this.voiceStyle === 'pdc_kirk' && /kirk|oliver|ryan|daniel|george|brian/i.test(lowerName)) {
        score += 25;
      } else if (this.voiceStyle === 'pdc_george' && /george|brian|arthur|ryan|daniel/i.test(lowerName)) {
        score += 25;
      } else if (this.voiceStyle === 'pdc_huw' && /huw|owen|geraint|welsh|oliver|daniel/i.test(lowerName)) {
        score += 25;
      } else if (this.voiceStyle === 'mc_john' && /guy|ryan|david|brian|arthur|deep|google uk english male/i.test(lowerName)) {
        score += 25;
      } else if (this.voiceStyle === 'irish_caller' && /ireland|irish|conor|sean|en-ie/i.test(lowerName + ' ' + lowerLang)) {
        score += 35;
      } else if (this.voiceStyle === 'aussie_pro' && /australia|en-au|russell|william|liam/i.test(lowerName + ' ' + lowerLang)) {
        score += 35;
      } else if (this.voiceStyle === 'us_pro' && /en-us|christopher|eric|guy|andrew|tom/i.test(lowerName + ' ' + lowerLang)) {
        score += 25;
      }

      return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    this.voice = scored[0]?.voice || voices[0] || null;
  }

  // --- Voice Roster & Admin Delete / Restore Controls ---

  public getDeletedVoiceStyles(): CallerVoiceStyle[] {
    return Array.from(this.deletedVoiceStyles);
  }

  public isVoiceDeleted(style: CallerVoiceStyle): boolean {
    return this.deletedVoiceStyles.has(style);
  }

  public getAvailableVoiceStyles(): CallerVoiceStyle[] {
    const all = Object.keys(CALLER_PROFILES) as CallerVoiceStyle[];
    const available = all.filter(style => !this.deletedVoiceStyles.has(style));
    return available.length > 0 ? available : ['pdc_russ'];
  }

  public getAllVoiceProfiles(): (CallerProfile & { isDeleted: boolean })[] {
    const all = Object.keys(CALLER_PROFILES) as CallerVoiceStyle[];
    return all.map(style => ({
      ...CALLER_PROFILES[style],
      isDeleted: this.deletedVoiceStyles.has(style),
    }));
  }

  public deleteVoiceStyle(style: CallerVoiceStyle): boolean {
    this.deletedVoiceStyles.add(style);
    this.saveDeletedVoices();

    // If currently selected voice is deleted, switch to the first remaining available voice
    if (this.voiceStyle === style) {
      const remaining = this.getAvailableVoiceStyles();
      if (remaining.length > 0) {
        this.setVoiceStyle(remaining[0]);
      }
    }
    this.notifyVoiceChange();
    return true;
  }

  public restoreVoiceStyle(style: CallerVoiceStyle): boolean {
    this.deletedVoiceStyles.delete(style);
    this.saveDeletedVoices();
    this.notifyVoiceChange();
    return true;
  }

  public restoreAllVoices(): void {
    this.deletedVoiceStyles.clear();
    this.saveDeletedVoices();
    this.notifyVoiceChange();
  }

  private saveDeletedVoices() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('kaboom_deleted_voices', JSON.stringify(Array.from(this.deletedVoiceStyles)));
    } catch (e) {}
  }

  public subscribeVoiceChanges(listener: () => void): () => void {
    this.voiceListeners.push(listener);
    return () => {
      this.voiceListeners = this.voiceListeners.filter(l => l !== listener);
    };
  }

  private notifyVoiceChange() {
    this.voiceListeners.forEach(l => {
      try { l(); } catch (e) {}
    });
  }

  // --- Voice Selection & Tuning Getters / Setters ---

  public setVoiceStyle(style: CallerVoiceStyle) {
    if (CALLER_PROFILES[style]) {
      this.voiceStyle = style;
      const prof = CALLER_PROFILES[style];
      this.pitch = prof.defaultPitch;
      this.rate = prof.defaultRate;
      this.pickBestVoice();
      this.saveSettings();
      this.notifyVoiceChange();
    }
  }

  public getVoiceStyle(): CallerVoiceStyle {
    return this.voiceStyle;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.saveSettings();
    this.notifyVoiceChange();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setPitch(pitch: number) {
    this.pitch = Math.max(0.5, Math.min(1.8, pitch));
    this.saveSettings();
    this.notifyVoiceChange();
  }

  public getPitch(): number {
    return this.pitch;
  }

  public setRate(rate: number) {
    this.rate = Math.max(0.6, Math.min(1.6, rate));
    this.saveSettings();
    this.notifyVoiceChange();
  }

  public getRate(): number {
    return this.rate;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1.0, volume));
    this.saveSettings();
    this.notifyVoiceChange();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getAvailableSystemVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices() || [];
  }

  public getCustomVoiceURI(): string | null {
    return this.customVoiceURI;
  }

  public setCustomVoiceURI(uri: string | null) {
    this.customVoiceURI = uri;
    this.pickBestVoice();
    this.saveSettings();
    this.notifyVoiceChange();
  }

  public getActiveVoiceName(): string {
    return this.voice ? `${this.voice.name} (${this.voice.lang})` : 'System Default Voice';
  }

  private saveSettings() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('kaboom_caller_settings', JSON.stringify({
        voiceStyle: this.voiceStyle,
        enabled: this.enabled,
        pitch: this.pitch,
        rate: this.rate,
        volume: this.volume,
        customVoiceURI: this.customVoiceURI,
      }));
    } catch (e) {}
  }

  // --- Dynamic Score Phrase Synthesis ---

  private getScorePhrase(score: number, isBust: boolean): string {
    const style = this.voiceStyle;

    if (isBust) {
      switch (style) {
        case 'pdc_russ':
          return 'BUST!';
        case 'pdc_kirk':
          return 'Bust. No score.';
        case 'pdc_george':
          return 'Bust.';
        case 'pdc_huw':
          return 'Bust! No score recorded.';
        case 'mc_john':
          return 'Bust! Hard luck at the oche!';
        case 'irish_caller':
          return 'Bust! Ah, unlucky on that visit!';
        case 'us_pro':
          return 'Bust! No score.';
        case 'aussie_pro':
          return 'Bust! Hard lines mate, dust it off!';
        case 'dutch_pro':
          return 'Bust. No score.';
        case 'pdc_official':
          return 'Bust. No score.';
        case 'funny':
          return 'BUST! Oh no, the chalker is weeping in the corner!';
        case 'scottish':
          return 'Bust! Away an’ boil yer heid!';
        case 'jamaican':
          return 'Bust! Wah gwaan, bredren?! Steady up!';
        case 'british':
          return 'Bust! Unlucky!';
        case 'serious':
          return 'Bust. No score.';
        case 'female':
          return 'Bust! No score recorded.';
        case 'male':
        default:
          return 'Bust!';
      }
    }

    if (score === 180) {
      switch (style) {
        case 'pdc_russ':
          return 'ONE HUNDRED AND EEE-EIGHTY!';
        case 'pdc_kirk':
          return 'One hundred and eighty!';
        case 'pdc_george':
          return 'One hundred, and eighty.';
        case 'pdc_huw':
          return 'One hundred and eighty!';
        case 'mc_john':
          return 'LADIES AND GENTLEMEN! A MAXIMUM ONE HUNDRED AND EIGHTY!';
        case 'irish_caller':
          return 'ONE HUNDRED AND EIGHTY! What a sensational dart!';
        case 'us_pro':
          return 'ONE HUNDRED AND EIGHTY! Absolute perfection in the red bit!';
        case 'aussie_pro':
          return 'ONE HUNDRED AND EIGHTY! Strewth, what a ripper of a maximum!';
        case 'dutch_pro':
          return 'One hundred and eighty! Fantastic darts!';
        case 'pdc_official':
          return 'One hundred and eighty!';
        case 'funny':
          return 'HOLY KABOOM! ONE HUNDRED AND EIGHTY! Check the board for smoke!';
        case 'scottish':
          return 'Och aye! ONE HUNDRED AND EIGHTY! Absolute belter!';
        case 'jamaican':
          return 'BOOM! ONE HUNDRED AND EIGHTY! Large up yuhself superstar!';
        case 'british':
          return 'ONE HUNDRED AND EEEIGHTY!';
        case 'serious':
          return 'One hundred and eighty.';
        case 'female':
          return 'Maximum! One hundred and eighty!';
        case 'male':
        default:
          return 'One hundred and eighty!';
      }
    }

    if (score === 140) {
      switch (style) {
        case 'pdc_russ':
          return 'ONE HUNDRED AND FORTY!';
        case 'pdc_kirk':
          return 'One hundred and forty.';
        case 'pdc_george':
          return 'One hundred and forty.';
        case 'pdc_huw':
          return 'One hundred and forty!';
        case 'mc_john':
          return 'One hundred and forty! Sensational arrows!';
        case 'irish_caller':
          return 'One hundred and forty! Grand darts!';
        case 'us_pro':
          return 'One hundred forty! Right on target!';
        case 'aussie_pro':
          return 'One hundred and forty! Beauty mate!';
        case 'dutch_pro':
          return 'One hundred and forty!';
        case 'pdc_official':
          return 'One hundred and forty.';
        case 'funny':
          return 'One hundred and forty! Someone call the fire department!';
        case 'scottish':
          return 'One hundred and forty! Gie it laldy!';
        case 'jamaican':
          return 'One hundred and forty! Pure vibes, seen?!';
        case 'british':
          return 'One hundred and forty!';
        case 'serious':
          return 'One hundred and forty.';
        case 'female':
          return 'Great darts! One hundred and forty!';
        default:
          return 'One hundred and forty!';
      }
    }

    if (score === 100) {
      switch (style) {
        case 'pdc_russ':
          return 'ONE HUNDRED!';
        case 'pdc_kirk':
          return 'Ton. One hundred.';
        case 'pdc_george':
          return 'One hundred.';
        case 'pdc_huw':
          return 'One hundred!';
        case 'mc_john':
          return 'A Ton! One hundred!';
        case 'irish_caller':
          return 'A Ton! One hundred!';
        case 'us_pro':
          return 'One ton! One hundred!';
        case 'aussie_pro':
          return 'A Ton! Cracking darts!';
        case 'dutch_pro':
          return 'One hundred.';
        case 'pdc_official':
          return 'Ton. One hundred.';
        case 'funny':
          return 'ONE TON! Boom shakalaka!';
        case 'scottish':
          return 'A TON! Braw darting!';
        case 'jamaican':
          return 'One Ton! Big respect!';
        case 'serious':
          return 'One hundred.';
        case 'british':
        case 'female':
        case 'male':
        default:
          return 'ONE TON!';
      }
    }

    if (score === 0) {
      switch (style) {
        case 'pdc_russ':
        case 'pdc_kirk':
        case 'pdc_george':
        case 'dutch_pro':
        case 'pdc_official':
        case 'serious':
          return 'No score.';
        case 'pdc_huw':
          return 'No score recorded.';
        case 'mc_john':
          return 'No score on that visit!';
        case 'irish_caller':
          return 'No score! Shake it off!';
        case 'us_pro':
          return 'No score.';
        case 'aussie_pro':
          return 'No score mate, keep your head up!';
        case 'funny':
          return 'Zero points! Did you throw with your eyes closed?!';
        case 'scottish':
          return 'No score! You couldna hit a barn door with that!';
        case 'jamaican':
          return 'No score star! Shake it off and go again!';
        case 'british':
          return 'No score on the board!';
        default:
          return 'No score!';
      }
    }

    if (score === 26) {
      switch (style) {
        case 'pdc_russ':
        case 'pdc_kirk':
        case 'pdc_george':
        case 'pdc_official':
          return 'Twenty-six.';
        case 'funny':
          return 'Twenty-six! Classic bed and breakfast! Hope you brought toast!';
        case 'scottish':
          return 'Twenty-six! A wee breakfast special!';
        default:
          return 'Twenty-six!';
      }
    }

    if (score >= 60) {
      return `${score}!`;
    }

    return `${score}`;
  }

  public announceBust() {
    this.announceScore(0, true);
  }

  public announceScore(score: number, isBust: boolean = false) {
    if (!this.enabled || !this.synth) return;

    if (this.scoreSafetyTimer) {
      clearTimeout(this.scoreSafetyTimer);
      this.scoreSafetyTimer = null;
    }
    this.queuedTurnCall = null;
    this.synth.cancel();

    const phrase = formatPhoneticsForSpeech(this.getScorePhrase(score, isBust));
    const utterance = new SpeechSynthesisUtterance(phrase);
    
    if (this.voice) utterance.voice = this.voice;

    // Adjust pitch & rate according to persona and score excitement
    let pitchMod = this.pitch;
    let rateMod = this.rate;

    if (score === 180) {
      if (this.voiceStyle === 'pdc_russ') {
        pitchMod = Math.max(0.65, this.pitch * 0.9); // Deep, gravelly Russ Bray roar
        rateMod = this.rate * 0.88; // Elongate the iconic 180 call
      } else if (this.voiceStyle === 'mc_john') {
        pitchMod = Math.max(0.70, this.pitch * 0.92);
        rateMod = this.rate * 0.90;
      } else if (this.voiceStyle === 'pdc_george') {
        pitchMod = this.pitch * 0.95;
        rateMod = this.rate * 0.96;
      } else if (this.voiceStyle === 'pdc_kirk') {
        pitchMod = this.pitch * 1.06;
        rateMod = this.rate * 1.05;
      } else if (this.voiceStyle === 'funny') {
        pitchMod = Math.min(1.8, this.pitch * 1.35);
        rateMod = this.rate * 0.95;
      } else {
        pitchMod = Math.min(1.8, this.pitch * 1.18);
        rateMod = this.rate * 0.96;
      }
    } else if (score >= 100) {
      pitchMod = this.pitch * 1.05;
    }

    utterance.pitch = pitchMod;
    utterance.rate = rateMod;
    utterance.volume = this.volume;

    this.isScoreSpeaking = true;
    this.activeUtterance = utterance;

    const onScoreFinished = () => {
      this.isScoreSpeaking = false;
      this.activeUtterance = null;
      if (this.scoreSafetyTimer) {
        clearTimeout(this.scoreSafetyTimer);
        this.scoreSafetyTimer = null;
      }
      if (this.queuedTurnCall) {
        const nextCall = this.queuedTurnCall;
        this.queuedTurnCall = null;
        setTimeout(() => {
          nextCall();
        }, 300);
      }
    };

    utterance.onend = onScoreFinished;
    utterance.onerror = onScoreFinished;

    const estimatedDurationMs = Math.max(
      1500,
      Math.min(6000, phrase.length * 90 + (score >= 100 ? 1400 : 500))
    );
    this.scoreSafetyTimer = setTimeout(onScoreFinished, estimatedDurationMs);

    this.synth.speak(utterance);
  }

  public announceTurn(
    shooterName: string,
    isDummyThrow: boolean = false,
    delayMs: number = 0,
    options?: { remainingScore?: number; gameMode?: string; teamName?: string; dummyRotatedPlayerName?: string }
  ) {
    if (!this.enabled || !this.synth) return;

    let phrase = '';
    const style = this.voiceStyle;
    let cleanName = (shooterName || '').trim();

    if (isDummyThrow && options?.dummyRotatedPlayerName) {
      cleanName = options.dummyRotatedPlayerName;
    }

    if (cleanName.includes('(')) {
      const match = cleanName.match(/\((.*?)\)/);
      if (match && match[1]) {
        const inner = match[1]
          .replace(/shooting(?:\s+for)?(?:\s+the)?(?:\s+dummy)?/gi, '')
          .replace(/for\s+dummy/gi, '')
          .replace(/shooting/gi, '')
          .trim();
        if (/^🤖?\s*dummy$/i.test(cleanName.replace(/\(.*?\)/, '').trim()) && inner) {
          cleanName = inner;
        } else {
          const outer = cleanName.replace(/\(.*?\)/, '').trim();
          if (outer) {
            cleanName = outer;
          } else if (inner) {
            cleanName = inner;
          }
        }
      }
    }

    cleanName = cleanName
      .replace(/\s*\(?\s*shooting\s+for\s+(?:the\s+)?dummy\s*\)?/gi, '')
      .replace(/\s*\(?\s*for\s+dummy\s*\)?/gi, '')
      .trim();

    if (!isDummyThrow) {
      cleanName = cleanName
        .replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '')
        .trim();
    }

    cleanName = cleanName.replace(/^[🤖🎯⚡🔥👤]\s*/u, '').trim();

    if (/\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\||\s+-\s+)\s*/i.test(cleanName)) {
      const parts = cleanName.split(/\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\||\s+-\s+)\s*/i).map(s => s.trim()).filter(Boolean);
      if (!isDummyThrow) {
        const nonDummyParts = parts.filter(p => !p.toLowerCase().includes('dummy'));
        if (nonDummyParts.length > 0) {
          cleanName = nonDummyParts[0];
        } else if (parts.length > 0) {
          cleanName = parts[0];
        }
      } else if (parts.length > 0) {
        cleanName = parts[0];
      }
    }

    if (!cleanName || /^team\s+\d+$/i.test(cleanName) || (!isDummyThrow && cleanName.toLowerCase().includes('dummy'))) {
      if (options?.teamName) {
        const teamParts = options.teamName
          .split(/\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\||\s+-\s+)\s*/i)
          .map(s => s.trim())
          .filter(p => Boolean(p) && !p.toLowerCase().includes('dummy'));
        if (teamParts.length > 0) {
          cleanName = teamParts[0];
        } else {
          cleanName = 'Player';
        }
      } else {
        cleanName = 'Player';
      }
    }

    const spokenShooter = isDummyThrow
      ? (cleanName.toLowerCase().includes('dummy') ? 'Shooting for the dummy' : `${cleanName} shooting for the dummy`)
      : cleanName;

    const remaining = options?.remainingScore;
    const gMode = options?.gameMode?.toUpperCase();

    if (gMode === 'FIVES') {
      switch (style) {
        case 'pdc_russ':
          phrase = `${spokenShooter}, to the oche.`;
          break;
        case 'pdc_kirk':
          phrase = `${spokenShooter}, to throw.`;
          break;
        case 'pdc_george':
          phrase = `${spokenShooter}, to the oche please.`;
          break;
        case 'pdc_huw':
          phrase = `${spokenShooter}, you are up to throw.`;
          break;
        case 'mc_john':
          phrase = `Please welcome to the oche, ${spokenShooter}!`;
          break;
        case 'irish_caller':
          phrase = `${spokenShooter}, step up to the oche!`;
          break;
        case 'us_pro':
          phrase = `${spokenShooter}, you're on the line.`;
          break;
        case 'aussie_pro':
          phrase = `${spokenShooter}, to the oche mate!`;
          break;
        case 'funny':
          phrase = `${spokenShooter}, step up to the oche! Count them fives!`;
          break;
        case 'scottish':
          phrase = `${spokenShooter}, to the oche! Gie it laldy!`;
          break;
        case 'jamaican':
          phrase = `${spokenShooter}, step to di line, mon!`;
          break;
        default:
          phrase = `${spokenShooter}, to the oche.`;
          break;
      }
    } else if (remaining && remaining > 1 && remaining <= 170) {
      switch (style) {
        case 'pdc_russ':
          phrase = `${spokenShooter}, you require ${remaining}. To the oche.`;
          break;
        case 'pdc_kirk':
          phrase = `${spokenShooter}, you require ${remaining}.`;
          break;
        case 'pdc_george':
          phrase = `${spokenShooter}, you require ${remaining}.`;
          break;
        case 'pdc_huw':
          phrase = `${spokenShooter}, you require ${remaining}.`;
          break;
        case 'mc_john':
          phrase = `${spokenShooter}, ${remaining} required for the leg!`;
          break;
        case 'irish_caller':
          phrase = `${spokenShooter}, ${remaining} required! Show 'em the finish!`;
          break;
        case 'us_pro':
          phrase = `${spokenShooter}, you require ${remaining}.`;
          break;
        case 'aussie_pro':
          phrase = `${spokenShooter}, ${remaining} required! Right in the finish!`;
          break;
        case 'funny':
          phrase = `${spokenShooter}, ${remaining} needed for glory! Step up!`;
          break;
        case 'scottish':
          phrase = `${spokenShooter}, you require ${remaining}. Gie it laldy!`;
          break;
        case 'jamaican':
          phrase = `${spokenShooter}, ${remaining} to take di leg! Step up!`;
          break;
        default:
          phrase = `${spokenShooter}, you require ${remaining}. To throw.`;
          break;
      }
    } else if (gMode === 'BASEBALL') {
      switch (style) {
        case 'pdc_russ':
          phrase = `${spokenShooter}, to the oche.`;
          break;
        case 'mc_john':
          phrase = `Batter up, ${spokenShooter}!`;
          break;
        case 'us_pro':
          phrase = `${spokenShooter}, you're up to bat.`;
          break;
        case 'funny':
          phrase = `${spokenShooter}, batter up! Knock it out of the park!`;
          break;
        default:
          phrase = `${spokenShooter}, up to bat.`;
          break;
      }
    } else if (gMode === 'CRICKET') {
      switch (style) {
        case 'pdc_russ':
          phrase = `${spokenShooter}, to the oche.`;
          break;
        case 'pdc_george':
          phrase = `${spokenShooter}, to throw.`;
          break;
        case 'mc_john':
          phrase = `Next to throw in Cricket, ${spokenShooter}!`;
          break;
        case 'funny':
          phrase = `${spokenShooter}, close those numbers out!`;
          break;
        default:
          phrase = `${spokenShooter}, to the oche.`;
          break;
      }
    } else {
      switch (style) {
        case 'pdc_russ':
          phrase = `${spokenShooter}, to the oche.`;
          break;
        case 'pdc_kirk':
          phrase = `${spokenShooter}, to throw.`;
          break;
        case 'pdc_george':
          phrase = `${spokenShooter}, to the oche please.`;
          break;
        case 'pdc_huw':
          phrase = `${spokenShooter}, to throw.`;
          break;
        case 'mc_john':
          phrase = `To the oche, ${spokenShooter}!`;
          break;
        case 'irish_caller':
          phrase = `${spokenShooter}, on you go!`;
          break;
        case 'us_pro':
          phrase = `${spokenShooter}, you're up.`;
          break;
        case 'aussie_pro':
          phrase = `${spokenShooter}, to the oche mate!`;
          break;
        case 'funny':
          phrase = `${spokenShooter}, show 'em how it's done!`;
          break;
        case 'scottish':
          phrase = `${spokenShooter}, on ye go!`;
          break;
        case 'jamaican':
          phrase = `${spokenShooter}, step to di line, mon!`;
          break;
        case 'british':
        case 'serious':
        case 'female':
        case 'male':
        default:
          phrase = `${spokenShooter}, to throw.`;
          break;
      }
    }

    const speak = () => {
      if (!this.synth || !this.enabled) return;
      if (this.isScoreSpeaking) {
        this.queuedTurnCall = speak;
        return;
      }
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(formatPhoneticsForSpeech(phrase));
      if (this.voice) utterance.voice = this.voice;
      utterance.pitch = this.pitch;
      utterance.rate = this.rate;
      utterance.volume = this.volume;
      this.synth.speak(utterance);
    };

    if (this.isScoreSpeaking) {
      this.queuedTurnCall = speak;
      return;
    }

    if (delayMs > 0) {
      setTimeout(speak, delayMs);
    } else {
      speak();
    }
  }

  public announceGameOn(legNumber?: number) {
    if (!this.enabled || !this.synth) return;
    this.synth.cancel();

    let phrase = 'Game on!';
    switch (this.voiceStyle) {
      case 'pdc_russ':
        phrase = legNumber ? `Leg ${legNumber}. Game on!` : 'Game on!';
        break;
      case 'pdc_kirk':
        phrase = legNumber ? `Leg ${legNumber}, game on!` : 'Game on!';
        break;
      case 'pdc_george':
        phrase = legNumber ? `Leg ${legNumber}. Game on.` : 'Game on.';
        break;
      case 'pdc_huw':
        phrase = legNumber ? `Leg ${legNumber}. Game on!` : 'Game on!';
        break;
      case 'mc_john':
        phrase = "Ladies and Gentlemen... LET'S PLAY DARTS!";
        break;
      case 'irish_caller':
        phrase = legNumber ? `Leg ${legNumber}, game on! Best of luck!` : "Game on, let's have it!";
        break;
      case 'us_pro':
        phrase = legNumber ? `Leg ${legNumber}. Game on!` : "Game on, let's roll!";
        break;
      case 'aussie_pro':
        phrase = legNumber ? `Leg ${legNumber}, game on legends!` : 'Game on, let’s get stuck in!';
        break;
      case 'scottish':
        phrase = 'Game on! Best o’ luck lads!';
        break;
      case 'jamaican':
        phrase = 'Game on star! Bring di energy!';
        break;
      default:
        phrase = legNumber ? `Leg ${legNumber}, game on!` : 'Game on!';
        break;
    }

    const utterance = new SpeechSynthesisUtterance(formatPhoneticsForSpeech(phrase));
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = this.pitch * 1.1;
    utterance.rate = this.rate;
    utterance.volume = this.volume;
    this.synth.speak(utterance);
  }

  public announceRequirement(remainingScore: number, playerName?: string) {
    if (!this.enabled || !this.synth || remainingScore <= 0 || remainingScore > 170) return;
    this.synth.cancel();

    let phrase = `You require ${remainingScore}.`;
    if (remainingScore === 50) {
      phrase = `You require 50. Bullseye.`;
    } else if (remainingScore === 40) {
      phrase = `You require 40. Double top.`;
    } else if (remainingScore === 32) {
      phrase = `You require 32. Double 16.`;
    } else if (remainingScore === 170) {
      phrase = `You require the big fish, 170!`;
    }

    if (playerName && (this.voiceStyle === 'pdc_russ' || this.voiceStyle === 'pdc_kirk' || this.voiceStyle === 'pdc_george' || this.voiceStyle === 'pdc_official')) {
      phrase = `${playerName}, ${phrase.toLowerCase()}`;
    }

    const utterance = new SpeechSynthesisUtterance(formatPhoneticsForSpeech(phrase));
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = this.pitch;
    utterance.rate = this.rate * 1.05;
    utterance.volume = this.volume;
    this.synth.speak(utterance);
  }

  public announceCheckout(playerName: string, legNumber: number) {
    if (!this.enabled || !this.synth) return;
    this.synth.cancel();

    let phrase = '';
    switch (this.voiceStyle) {
      case 'pdc_russ':
        phrase = `Game shot, and the leg!`;
        break;
      case 'pdc_kirk':
        phrase = `Game shot, and the leg to ${playerName}!`;
        break;
      case 'pdc_george':
        phrase = `Game shot, and the leg to ${playerName}.`;
        break;
      case 'pdc_huw':
        phrase = `Game shot, and that is the leg to ${playerName}!`;
        break;
      case 'mc_john':
        phrase = `Game shot, and the leg goes to... ${playerName}!`;
        break;
      case 'irish_caller':
        phrase = `Game shot and the leg to ${playerName}! Mighty darts!`;
        break;
      case 'us_pro':
        phrase = `Game shot! Leg goes to ${playerName}!`;
        break;
      case 'aussie_pro':
        phrase = `Game shot and the leg to ${playerName}! Ripper!`;
        break;
      case 'dutch_pro':
        phrase = `Game shot and the leg to ${playerName}!`;
        break;
      case 'pdc_official':
        phrase = `Game shot, and the leg to ${playerName}!`;
        break;
      case 'funny':
        phrase = `Game shot and the leg! Ring the bell, ${playerName} checked out!`;
        break;
      case 'scottish':
        phrase = `Game shot and the leg to ${playerName}! Pure class, wee champion!`;
        break;
      case 'jamaican':
        phrase = `Game shot and di leg to ${playerName}! Ya mon, pure fire!`;
        break;
      case 'serious':
        phrase = `Game shot, leg to ${playerName}.`;
        break;
      case 'british':
        phrase = `Game shot and the leg, ${playerName}!`;
        break;
      default:
        phrase = `Game Shot and the leg to ${playerName}!`;
    }

    const utterance = new SpeechSynthesisUtterance(formatPhoneticsForSpeech(phrase));
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = Math.min(1.6, this.pitch * 1.15);
    utterance.rate = this.rate;
    utterance.volume = this.volume;
    this.synth.speak(utterance);
  }

  public announceMatchWinner(playerName: string) {
    if (!this.enabled || !this.synth) return;
    this.synth.cancel();

    let phrase = '';
    switch (this.voiceStyle) {
      case 'pdc_russ':
        phrase = `Game, shot, and the MATCH! Winner, ${playerName}!`;
        break;
      case 'pdc_kirk':
        phrase = `Game, shot, and the match! Champion, ${playerName}!`;
        break;
      case 'pdc_george':
        phrase = `Game, shot, and the match. Winner, ${playerName}.`;
        break;
      case 'pdc_huw':
        phrase = `Game, shot, and the match! Congratulations, ${playerName}!`;
        break;
      case 'mc_john':
        phrase = `LADIES AND GENTLEMEN! GAME, SHOT, AND THE MATCH! YOUR CHAMPION... ${playerName}!`;
        break;
      case 'irish_caller':
        phrase = `Game, shot, and the match! Up ${playerName}, fantastic champion!`;
        break;
      case 'us_pro':
        phrase = `Game, shot, and the MATCH! Champion, ${playerName}!`;
        break;
      case 'aussie_pro':
        phrase = `Game, shot, and the match! Good on ya ${playerName}, what a champion!`;
        break;
      case 'dutch_pro':
        phrase = `Game, shot, and the match! Winner, ${playerName}!`;
        break;
      case 'pdc_official':
        phrase = `Game, shot, and the match! Champion, ${playerName}!`;
        break;
      case 'funny':
        phrase = `Game, shot, and the entire championship! Build ${playerName} a golden statue right now!`;
        break;
      case 'scottish':
        phrase = `Game, shot, and the match! Champion ${playerName}! Raise a dram for the victor!`;
        break;
      case 'jamaican':
        phrase = `Game, shot, and the match! Maximum respect to di champion ${playerName}!`;
        break;
      case 'serious':
        phrase = `Game, shot, and the match. Winner, ${playerName}.`;
        break;
      case 'british':
        phrase = `Game, shot, and the match! Magnificent darts, ${playerName}!`;
        break;
      default:
        phrase = `Game, shot, and the match! Winner, ${playerName}!`;
    }

    const utterance = new SpeechSynthesisUtterance(formatPhoneticsForSpeech(phrase));
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = Math.min(1.7, this.pitch * 1.2);
    utterance.rate = this.rate;
    utterance.volume = this.volume;
    this.synth.speak(utterance);
  }

  public previewVoice(customPhrase?: string) {
    if (!this.synth) return;
    this.synth.cancel();

    const phrase = formatPhoneticsForSpeech(customPhrase || this.getScorePhrase(180, false));
    const utterance = new SpeechSynthesisUtterance(phrase);
    if (this.voice) utterance.voice = this.voice;
    
    let pitchMod = this.pitch;
    if (phrase.includes('180') || phrase.includes('EIGHTY')) {
      if (this.voiceStyle === 'pdc_russ') {
        pitchMod = Math.max(0.65, this.pitch * 0.9);
      } else if (this.voiceStyle === 'mc_john') {
        pitchMod = Math.max(0.70, this.pitch * 0.92);
      } else {
        pitchMod = Math.min(1.8, this.pitch * 1.25);
      }
    }
    
    utterance.pitch = pitchMod;
    utterance.rate = this.voiceStyle === 'pdc_russ' && phrase.includes('180') ? this.rate * 0.88 : this.rate;
    utterance.volume = this.volume;
    this.synth.speak(utterance);
  }

  public speak(phrase: string) {
    if (!this.enabled || !this.synth) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(formatPhoneticsForSpeech(phrase));
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = this.pitch;
    utterance.rate = this.rate;
    utterance.volume = this.volume;
    this.synth.speak(utterance);
  }

  public playCoinFlipSound() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.3 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);

      for (let i = 1; i <= 6; i++) {
        setTimeout(() => {
          try {
            const clickOsc = ctx.createOscillator();
            const clickGain = ctx.createGain();
            clickOsc.type = 'sine';
            clickOsc.frequency.setValueAtTime(1800 + i * 80, ctx.currentTime);
            clickGain.gain.setValueAtTime(0.12 * this.volume, ctx.currentTime);
            clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            clickOsc.connect(clickGain);
            clickGain.connect(ctx.destination);
            clickOsc.start();
            clickOsc.stop(ctx.currentTime + 0.04);
          } catch (e) {}
        }, i * 120);
      }

      setTimeout(() => {
        try {
          const landOsc = ctx.createOscillator();
          const landGain = ctx.createGain();
          landOsc.type = 'triangle';
          landOsc.frequency.setValueAtTime(1900, ctx.currentTime);
          landOsc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
          landGain.gain.setValueAtTime(0.25 * this.volume, ctx.currentTime);
          landGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          landOsc.connect(landGain);
          landGain.connect(ctx.destination);
          landOsc.start();
          landOsc.stop(ctx.currentTime + 0.25);
        } catch (e) {}
      }, 950);
    } catch (e) {
      console.warn('Web Audio API not supported for coin sound', e);
    }
  }
}

export const announcer = new DartAnnouncer();
