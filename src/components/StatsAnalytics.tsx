import React from 'react';
import { MatchState } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, Trophy, Download, Printer, Target, Sparkles, TrendingUp } from 'lucide-react';

interface StatsAnalyticsProps {
  matchState: MatchState;
}

export const StatsAnalytics: React.FC<StatsAnalyticsProps> = ({ matchState }) => {
  const p1 = matchState.players[0];
  const p2 = matchState.players[1];

  // Prepare leg-by-leg averages data for LineChart
  const legAveragesData = matchState.completedLegs.map((leg) => ({
    legName: `Leg ${leg.legNumber}`,
    [p1?.name || 'P1']: leg.averages[p1?.id] || 0,
    [p2?.name || 'P2']: leg.averages[p2?.id] || 0,
  }));

  // Prepare Score Distribution Data for BarChart
  const scoreDistributionData = [
    {
      category: '180s',
      [p1?.name || 'P1']: p1?.stats.count180 || 0,
      [p2?.name || 'P2']: p2?.stats.count180 || 0,
    },
    {
      category: '140+',
      [p1?.name || 'P1']: p1?.stats.count140Plus || 0,
      [p2?.name || 'P2']: p2?.stats.count140Plus || 0,
    },
    {
      category: '100+',
      [p1?.name || 'P1']: p1?.stats.count100Plus || 0,
      [p2?.name || 'P2']: p2?.stats.count100Plus || 0,
    },
    {
      category: '60+',
      [p1?.name || 'P1']: p1?.stats.count60Plus || 0,
      [p2?.name || 'P2']: p2?.stats.count60Plus || 0,
    },
  ];

  // Print Match Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Match Statistics & Analytics</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Comprehensive 3-dart averages, score distributions, leg histories, and checkout metrics.
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
        >
          <Printer className="w-4 h-4" /> Export / Print Report
        </button>
      </div>

      {/* Head-to-Head Comparison Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        {/* Player 1 Stats */}
        <div className="space-y-3">
          <span className="text-3xl">{p1?.avatar || '🎯'}</span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{p1?.name}</h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Overall 3-Dart Avg</span>
            <span className="text-4xl font-black font-mono text-indigo-600">{p1?.stats.threeDartAvg || '0.0'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block font-bold uppercase text-[10px]">First 9 Avg</span>
              <span className="text-slate-900 font-mono font-bold text-sm">{p1?.stats.first9Avg || '0.0'}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block font-bold uppercase text-[10px]">High Out</span>
              <span className="text-indigo-600 font-mono font-bold text-sm">{p1?.stats.highOut || '0'}</span>
            </div>
          </div>
        </div>

        {/* Vs Trophy Middle Indicator */}
        <div className="flex flex-col items-center justify-center space-y-2 border-y md:border-y-0 md:border-x border-slate-100 py-4 md:py-0">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 mb-1">
            <Trophy className="w-8 h-8" />
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score Leg Count</span>
          <span className="text-3xl font-black text-slate-900 font-mono">
            {p1?.legsWon || 0} - {p2?.legsWon || 0}
          </span>
          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Match Code: {matchState.matchCode}
          </span>
        </div>

        {/* Player 2 Stats */}
        <div className="space-y-3">
          <span className="text-3xl">{p2?.avatar || '🎯'}</span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{p2?.name}</h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Overall 3-Dart Avg</span>
            <span className="text-4xl font-black font-mono text-indigo-600">{p2?.stats.threeDartAvg || '0.0'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block font-bold uppercase text-[10px]">First 9 Avg</span>
              <span className="text-slate-900 font-mono font-bold text-sm">{p2?.stats.first9Avg || '0.0'}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-400 block font-bold uppercase text-[10px]">High Out</span>
              <span className="text-indigo-600 font-mono font-bold text-sm">{p2?.stats.highOut || '0'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Recharts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Leg-by-Leg 3-Dart Average Line Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> Leg-by-Leg Scoring Average Trend
          </h3>

          {legAveragesData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
              Complete legs to populate live leg average progression.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={legAveragesData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="legName" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[40, 140]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ color: '#4f46e5', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#475569' }} />
                  <Line type="monotone" dataKey={p1?.name || 'P1'} stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey={p2?.name || 'P2'} stroke="#0284c7" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Scoring Distribution Frequency Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" /> Score Frequency Breakdown (180s, 140+, 100+)
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistributionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#475569' }} />
                <Bar dataKey={p1?.name || 'P1'} fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey={p2?.name || 'P2'} fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Completed Legs Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-x-auto">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Completed Legs History Table
        </h3>

        {matchState.completedLegs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 font-medium">No legs completed yet in this match.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold tracking-wider">
                <th className="py-2.5 px-3">Leg</th>
                <th className="py-2.5 px-3">Winner</th>
                <th className="py-2.5 px-3">Out</th>
                <th className="py-2.5 px-3">{p1?.name} Avg</th>
                <th className="py-2.5 px-3">{p2?.name} Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {matchState.completedLegs.map((leg) => (
                <tr key={leg.legNumber} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">Leg #{leg.legNumber}</td>
                  <td className="py-2.5 px-3 text-indigo-600 font-bold">{leg.winnerName}</td>
                  <td className="py-2.5 px-3 text-slate-700 font-bold">{leg.winningOut ? `D${leg.winningOut / 2}` : '-'}</td>
                  <td className="py-2.5 px-3 text-slate-700">{leg.averages[p1?.id] || 0}</td>
                  <td className="py-2.5 px-3 text-slate-700">{leg.averages[p2?.id] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
