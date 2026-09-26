import React, { useState, useEffect } from 'react';
import { MatchSettings, GameMode, MatchFormat, InOutMode, Player, CallerVoiceStyle } from '../types';
import { WEDNESDAY_MEDLEY_CONFIGS } from '../utils/medleyHelper';
import { StarterDeterminationModal } from './StarterDeterminationModal';
import { Target, Bot, Users, Trophy, Play, Radio, Volume2, ShieldCheck, Zap, Sparkles, Flame, Dices, VolumeX } from 'lucide-react';
import { announcer, CALLER_PROFILES } from '../utils/audio';
import { MASTER_ROSTER_PLAYERS } from '../data/defaultPlayers';
import { subscribeToPlayerRoster } from '../services/cloudSync';

interface MatchSetupProps {
  onStartMatch: (settings: MatchSettings, player1Name: string, player2Name: string) => void;
}

export const MatchSetup: React.FC<MatchSetupProps> = ({ onStartMatch }) => {
  const [gameMode, setGameMode] = useState<GameMode>('X01');
  const [startScore, setStartScore] = useState<number>(501);
  const [inMode, setInMode] = useState<InOutMode>('Straight');
  const [outMode, setOutMode] = useState<InOutMode>('Double');
  const [format, setFormat] = useState<MatchFormat>('legs');
  const [legsToWin, setLegsToWin] = useState<number>(3);
  const [setsToWin, setSetsToWin] = useState<number>(1);
  const [legsPerSet, setLegsPerSet] = useState<number>(3);
  
  const [isDartBot, setIsDartBot] = useState<boolean>(false);
  const [botLevel, setBotLevel] = useState<number>(5);

  const [player1Name, setPlayer1Name] = useState<string>('Player 1');
  const [player2Name, setPlayer2Name] = useState<string>('Player 2');
  const [starterIndex, setStarterIndex] = useState<number>(0);
  const [showStarterModal, setShowStarterModal] = useState<boolean>(false);
  const [callerVoice, setCallerVoice] = useState<CallerVoiceStyle>(() => announcer.getVoiceStyle());
  const [availableVoices, setAvailableVoices] = useState<CallerVoiceStyle[]>(() => announcer.getAvailableVoiceStyles());

  useEffect(() => {
    const unsubscribe = announcer.subscribeVoiceChanges(() => {
      const updated = announcer.getAvailableVoiceStyles();
      setAvailableVoices(updated);
      if (!updated.includes(callerVoice) && updated.length > 0) {
        setCallerVoice(updated[0]);
      }
    });
    return unsubscribe;
  }, [callerVoice]);

  // Load saved player profiles for quick selection
  const [savedProfiles, setSavedProfiles] = useState<{ id: string; name: string; avatar: string }[]>(() => {
    try {
      const saved = localStorage.getItem('kaboom_dart_players');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((p: any) => 
            !p.name.toLowerCase().includes("littler") && 
            !p.name.toLowerCase().includes("gerwen") && 
            !p.name.toLowerCase().includes("anderson") &&
            !p.name.toLowerCase().includes("nuke")
          );
        }
      }
    } catch (e) {}
    return MASTER_ROSTER_PLAYERS.map(p => ({ id: p.id, name: p.name, avatar: p.avatar }));
  });

  // Listen for realtime roster updates from cloud/server
  useEffect(() => {
    const unsubscribe = subscribeToPlayerRoster((roster) => {
      if (Array.isArray(roster) && roster.length > 0) {
        setSavedProfiles(roster.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '🎯',
        })));
      }
    });

    const handleSyncEvent = () => {
      try {
        const saved = localStorage.getItem('kaboom_dart_players');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedProfiles(parsed.map((p: any) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar || '🎯',
            })));
          }
        }
      } catch (e) {}
    };

    window.addEventListener('kaboom_cloud_sync_update', handleSyncEvent);
    return () => {
      unsubscribe();
      window.removeEventListener('kaboom_cloud_sync_update', handleSyncEvent);
    };
  }, []);

  const [announceAudio, setAnnounceAudio] = useState<boolean>(true);
  const [isPublic, setIsPublic] = useState<boolean>(true);

  const generateMatchCode = () => 'Kaboom';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isMedley = gameMode === 'MEDLEY';
    const settings: MatchSettings = {
      gameMode,
      startScore: isMedley ? 1001 : (gameMode === 'FIVES' ? startScore : startScore),
      fivesTarget: gameMode === 'FIVES' ? startScore : 101,
      inMode: isMedley ? 'Straight' : inMode,
      outMode: isMedley ? 'Double' : outMode,
      format,
      legsToWin: isMedley ? 6 : legsToWin,
      setsToWin,
      legsPerSet,
      isDartBot,
      botLevel,
      announceAudio,
      callerVoice,
      isPublic,
      matchCode: generateMatchCode(),
      starterPlayerId: starterIndex === 0 ? 'p1' : 'p2',
      isMedley,
      medleyConfigs: isMedley ? WEDNESDAY_MEDLEY_CONFIGS : undefined,
    };

    const p2 = isDartBot ? `DartBot Lvl ${botLevel}` : player2Name || 'Player 2';
    
    // If starter index is 1 (player 2), we can flip the names or pass starter index
    if (starterIndex === 1) {
      onStartMatch(settings, p2, player1Name || 'Player 1');
    } else {
      onStartMatch(settings, player1Name || 'Player 1', p2);
    }
  };

  const applyTemplate = (templateName: string) => {
    if (templateName === 'fives') {
      setGameMode('FIVES');
      setStartScore(101);
      setFormat('legs');
      setLegsToWin(1);
      setIsDartBot(false);
    } else if (templateName === 'baseball') {
      setGameMode('BASEBALL');
      setFormat('legs');
      setLegsToWin(1);
      setIsDartBot(false);
    } else if (templateName === 'medley') {
      setGameMode('MEDLEY');
      setStartScore(1001);
      setInMode('Straight');
      setOutMode('Double');
      setFormat('legs');
      setLegsToWin(6);
      setIsDartBot(false);
    } else if (templateName === 'pdc') {
      setGameMode('X01');
      setStartScore(501);
      setFormat('legs');
      setLegsToWin(6);
      setIsDartBot(true);
      setBotLevel(8);
      setPlayer1Name('Player 1');
    } else if (templateName === 'cricket') {
      setGameMode('CRICKET');
      setFormat('legs');
      setLegsToWin(3);
      setIsDartBot(false);
    } else if (templateName === 'quick301') {
      setGameMode('X01');
      setStartScore(301);
      setInMode('Double');
      setOutMode('Double');
      setFormat('legs');
      setLegsToWin(2);
    } else if (templateName === 'x701dido') {
      setGameMode('X01');
      setStartScore(701);
      setInMode('Double');
      setOutMode('Double');
      setFormat('legs');
      setLegsToWin(2);
    } else if (templateName === 'x701') {
      setGameMode('X01');
      setStartScore(701);
      setInMode('Straight');
      setOutMode('Double');
      setFormat('legs');
      setLegsToWin(2);
    } else if (templateName === 'x1001') {
      setGameMode('X01');
      setStartScore(1001);
      setInMode('Straight');
      setOutMode('Double');
      setFormat('legs');
      setLegsToWin(1);
    }
  };

  const getBotAverageDesc = (level: number) => {
    const avg = 25 + level * 7.5;
    if (level <= 2) return `~${Math.round(avg)} Avg (Beginner)`;
    if (level <= 4) return `~${Math.round(avg)} Avg (Pub Regular)`;
    if (level <= 6) return `~${Math.round(avg)} Avg (Super League)`;
    if (level <= 8) return `~${Math.round(avg)} Avg (County / Semi-Pro)`;
    return `~${Math.round(avg)} Avg (PDC World Class)`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3">
          <Trophy className="w-4 h-4" /> Professional Match Creator
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Setup New Dart Match
        </h1>
        <p className="text-slate-500 text-sm mt-1.5 max-w-lg mx-auto">
          Configure game mode, leg formats, opponent, announcer sounds, and live broadcast options.
        </p>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => applyTemplate('fives')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span>🖐️</span> Game of Fives (101 Goal)
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('baseball')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" /> Baseball Darts (9 Targets)
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('medley')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" /> Multi-Game Medley
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('pdc')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> PDC 501 (Best of 11)
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('cricket')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Target className="w-3.5 h-3.5 text-indigo-600" /> Standard Cricket
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('quick301')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-600" /> 301 DI/DO
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('x701dido')}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> 701 DI/DO Match
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('x701')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Trophy className="w-3.5 h-3.5 text-indigo-600" /> 701 SI/DO
          </button>

          <button
            type="button"
            onClick={() => applyTemplate('x1001')}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Flame className="w-3.5 h-3.5 text-rose-600" /> 1001 Marathon
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Game Mode Selection */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Select Game Variant
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => setGameMode('X01')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                gameMode === 'X01'
                  ? 'bg-indigo-50/50 border-2 border-indigo-600 text-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${gameMode === 'X01' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">X01 Target</h3>
                <p className="text-xs text-slate-500 mt-0.5">301, 501, 701, 1001 countdown</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setGameMode('CRICKET')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                gameMode === 'CRICKET'
                  ? 'bg-indigo-50/50 border-2 border-indigo-600 text-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${gameMode === 'CRICKET' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Cricket Tactical</h3>
                <p className="text-xs text-slate-500 mt-0.5">Numbers 15–20 & Bull closures</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setGameMode('BASEBALL')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                gameMode === 'BASEBALL'
                  ? 'bg-indigo-50/50 border-2 border-indigo-600 text-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${gameMode === 'BASEBALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Sparkles className="w-5 h-5 text-amber-400 fill-current" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Baseball Darts</h3>
                <p className="text-xs text-slate-500 mt-0.5">AI Targets & 0–9 Dropdowns</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setGameMode('FIVES')}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                gameMode === 'FIVES'
                  ? 'bg-indigo-50/50 border-2 border-indigo-600 text-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${gameMode === 'FIVES' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <span className="text-xl leading-none">🖐️</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Game of Fives</h3>
                <p className="text-xs text-slate-500 mt-0.5">Divisible by 5 (101 ➔ 0)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setGameMode('MEDLEY');
                setStartScore(1001);
                setInMode('Straight');
                setOutMode('Double');
                setLegsToWin(6);
              }}
              className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                gameMode === 'MEDLEY'
                  ? 'bg-indigo-50/50 border-2 border-indigo-600 text-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${gameMode === 'MEDLEY' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Zap className="w-5 h-5 text-amber-400 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">Wednesday Medley</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">6 Games</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">1001 SI/DO ➔ Baseball ➔ 701 DI/DO ➔ Fives ➔ Cricket ➔ Optional 1001</p>
              </div>
            </button>
          </div>

          {/* Fives Options */}
          {gameMode === 'FIVES' && (
            <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Fives Scoring Target:</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total turn score must be divisible by 5. Score of 25 subtracts 5 points from the target goal.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[51, 101, 201].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStartScore(val)}
                      className={`px-3.5 py-1.5 rounded-lg font-black text-xs transition-all ${
                        startScore === val
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val} Goal
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* X01 Options */}
          {gameMode === 'X01' && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Starting Score</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { score: 301, label: '301', desc: 'Fast Leg' },
                    { score: 501, label: '501', desc: 'PDC Standard' },
                    { score: 701, label: '701', desc: 'Team Match' },
                    { score: 1001, label: '1001', desc: 'Marathon' },
                  ].map(({ score, label, desc }) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setStartScore(score)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        startScore === score
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="font-black text-base">{label}</div>
                      <div className={`text-[11px] font-medium ${startScore === score ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">In Mode (Entry)</label>
                  <select
                    value={inMode}
                    onChange={(e) => setInMode(e.target.value as InOutMode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm focus:border-indigo-600 outline-none"
                  >
                    <option value="Straight">Straight In</option>
                    <option value="Double">Double In</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Out Mode (Finish)</label>
                  <select
                    value={outMode}
                    onChange={(e) => setOutMode(e.target.value as InOutMode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm focus:border-indigo-600 outline-none"
                  >
                    <option value="Double">Double Out (Standard)</option>
                    <option value="Single">Single Out</option>
                    <option value="Master">Master Out</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player Setup & Opponent Type */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Players & Opponent
          </label>

          {/* Mode Switcher: Human vs Human OR Human vs Bot */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setIsDartBot(false)}
              className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                !isDartBot
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" /> 2 Player Match
            </button>

            <button
              type="button"
              onClick={() => setIsDartBot(true)}
              className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                isDartBot
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Bot className="w-4 h-4" /> Vs DartBot AI
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-500">Player 1 Name</label>
                {savedProfiles.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) setPlayer1Name(e.target.value); }}
                    className="text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none font-medium"
                    defaultValue=""
                  >
                    <option value="" disabled>Select from Players Roster...</option>
                    {savedProfiles.map(p => (
                      <option key={`p1-${p.id}`} value={p.name}>{p.avatar || '🎯'} {p.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                placeholder="Enter Player 1 Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 font-semibold text-sm focus:border-indigo-600 outline-none"
              />
            </div>

            {!isDartBot ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500">Player 2 Name</label>
                  {savedProfiles.length > 0 && (
                    <select
                      onChange={(e) => { if (e.target.value) setPlayer2Name(e.target.value); }}
                      className="text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none font-medium"
                      defaultValue=""
                    >
                      <option value="" disabled>Select from Players Roster...</option>
                      {savedProfiles.map(p => (
                        <option key={`p2-${p.id}`} value={p.name}>{p.avatar || '🎯'} {p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="text"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  placeholder="Enter Player 2 Name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 font-semibold text-sm focus:border-indigo-600 outline-none"
                />
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-indigo-600">DartBot Level: {botLevel}</span>
                  <span className="text-xs text-slate-500 font-medium">{getBotAverageDesc(botLevel)}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={botLevel}
                  onChange={(e) => setBotLevel(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Who Throws First (Game 1) with Bull-off & Coin Flip */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">
                Who Throws First (Game 1)?
              </label>
              <div className="flex items-center gap-4 mt-1.5">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="setupStarter"
                    checked={starterIndex === 0}
                    onChange={() => setStarterIndex(0)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{player1Name || 'Player 1'}</span>
                </label>

                <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="setupStarter"
                    checked={starterIndex === 1}
                    onChange={() => setStarterIndex(1)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isDartBot ? `DartBot Lvl ${botLevel}` : (player2Name || 'Player 2')}</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStarterModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 self-start sm:self-auto"
            >
              <span>🪙 Flip Coin / Bull-Off 🎯</span>
            </button>
          </div>
        </div>

        {/* Starter Determination Modal */}
        {showStarterModal && (
          <StarterDeterminationModal
            isOpen={showStarterModal}
            onClose={() => setShowStarterModal(false)}
            players={[
              { id: 'p1', name: player1Name || 'Player 1', avatar: '🎯', legsWon: 0, setsWon: 0, currentScore: 501, stats: { dartsThrown: 0, totalScore: 0, highestTurn: 0, turnsCount: 0, history: [], scores100Plus: 0, scores140Plus: 0, scores180: 0, dartsPerLeg: [], turnHistory: [] } },
              { id: 'p2', name: isDartBot ? `DartBot Lvl ${botLevel}` : (player2Name || 'Player 2'), avatar: '🎯', legsWon: 0, setsWon: 0, currentScore: 501, stats: { dartsThrown: 0, totalScore: 0, highestTurn: 0, turnsCount: 0, history: [], scores100Plus: 0, scores140Plus: 0, scores180: 0, dartsPerLeg: [], turnHistory: [] } }
            ]}
            currentStarterIndex={starterIndex}
            onSelectStarter={(idx) => setStarterIndex(idx)}
          />
        )}

        {/* Format Setup (Legs vs Sets) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Match Length & Format
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Format Type</label>
              <div className="flex bg-slate-100 p-1 rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormat('legs')}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                    format === 'legs' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  }`}
                >
                  First to Legs
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('sets')}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                    format === 'sets' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Sets & Legs
                </button>
              </div>
            </div>

            {format === 'legs' ? (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Legs Needed to Win Match</label>
                <select
                  value={legsToWin}
                  onChange={(e) => setLegsToWin(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm focus:border-indigo-600 outline-none"
                >
                  <option value={1}>1 Leg (Single Leg Blitz)</option>
                  <option value={2}>First to 2 (Best of 3)</option>
                  <option value={3}>First to 3 (Best of 5)</option>
                  <option value={4}>First to 4 (Best of 7)</option>
                  <option value={6}>First to 6 (Best of 11 - PDC)</option>
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Sets to Win</label>
                  <select
                    value={setsToWin}
                    onChange={(e) => setSetsToWin(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm outline-none"
                  >
                    <option value={1}>1 Set</option>
                    <option value={2}>First to 2</option>
                    <option value={3}>First to 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Legs / Set</label>
                  <select
                    value={legsPerSet}
                    onChange={(e) => setLegsPerSet(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold text-sm outline-none"
                  >
                    <option value={3}>First to 3</option>
                    <option value={2}>First to 2</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audio & Caller Voice Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Referee Caller Voice & Audio
            </label>
            <button
              type="button"
              onClick={() => {
                const next = !announceAudio;
                setAnnounceAudio(next);
                announcer.setEnabled(next);
              }}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                announceAudio
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {announceAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{announceAudio ? 'Announcer Enabled' : 'Muted'}</span>
            </button>
          </div>

          {announceAudio && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableVoices.map((styleKey) => {
                  const prof = CALLER_PROFILES[styleKey];
                  if (!prof) return null;
                  const isSelected = callerVoice === styleKey;
                  return (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => {
                        setCallerVoice(styleKey);
                        announcer.setVoiceStyle(styleKey);
                        announcer.previewVoice();
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">{prof.icon}</span>
                          <span className="font-extrabold text-xs truncate">
                            {prof.id === 'pdc_russ'
                              ? 'Russ Bray'
                              : prof.id === 'pdc_kirk'
                              ? 'Kirk Bevins'
                              : prof.id === 'pdc_george'
                              ? 'George Noble'
                              : prof.id === 'pdc_huw'
                              ? 'Huw Ware'
                              : prof.id === 'mc_john'
                              ? 'John McDonald'
                              : prof.id === 'irish_caller'
                              ? 'Irish Referee'
                              : prof.id === 'us_pro'
                              ? 'US Pro Caller'
                              : prof.id === 'aussie_pro'
                              ? 'Aussie Masters'
                              : prof.id === 'dutch_pro'
                              ? 'Euro Tour'
                              : prof.name.split(' ')[0]}
                          </span>
                        </div>
                        {prof.tag && (
                          <span className="px-1 py-0.5 bg-amber-500/20 text-amber-800 text-[8px] font-black uppercase rounded shrink-0">
                            {prof.tag.replace('Official ', '')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 line-clamp-1">{prof.subtitle}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <span>Selected:</span>
                  <span className="font-bold text-slate-900">
                    {CALLER_PROFILES[callerVoice]?.icon} {CALLER_PROFILES[callerVoice]?.name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => announcer.previewVoice()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Play className="w-3 h-3" /> Test 180 Call
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> Broadcast Match to Live Spectator Center
                </span>
                <p className="text-[11px] text-slate-500">Live sync scores to Court TV and spectator viewers</p>
              </div>
            </label>
          </div>
        </div>

        {/* Start Button */}
        <button
          type="submit"
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg sm:text-xl uppercase tracking-widest rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <Play className="w-6 h-6 fill-current" /> START MATCH NOW
        </button>
      </form>
    </div>
  );
};
