import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Home } from 'lucide-react';
import { supabase, type Agent, type Appartement } from '../lib/supabase';
import {
  calculateAgentScores,
  calculateEquilibreGlobal,
  type DistributionScore,
  type AppartementWithAgent,
} from '../lib/distributionAlgorithm';

type DistributionDashboardProps = {
  agents: Agent[];
  refresh: number;
};

export default function DistributionDashboard({ agents, refresh }: DistributionDashboardProps) {
  const [appartements, setAppartements] = useState<AppartementWithAgent[]>([]);
  const [scores, setScores] = useState<Map<string, DistributionScore>>(new Map());
  const [equilibreGlobal, setEquilibreGlobal] = useState(0);

  useEffect(() => {
    loadData();
  }, [agents, refresh]);

  async function loadData() {
    const { data, error } = await supabase
      .from('appartements')
      .select('*')
      .eq('statut', 'assigne');

    if (!error && data) {
      setAppartements(data);
      const calculatedScores = calculateAgentScores(agents, data);
      setScores(calculatedScores);
      setEquilibreGlobal(calculateEquilibreGlobal(calculatedScores));
    }
  }

  function getAgentName(agentId: string): string {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.nom || 'Inconnu';
  }

  const totalAppartements = appartements.length;
  const totalAgents = agents.length;
  const moyenneParAgent = totalAgents > 0 ? totalAppartements / totalAgents : 0;

  const scoresArray = Array.from(scores.values());
  const maxScore = Math.max(...scoresArray.map((s) => s.score_equilibre), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            <div>
              <p className="text-sm text-gray-600">Agents</p>
              <p className="text-2xl font-bold text-gray-800">{totalAgents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <Home className="text-green-600" size={32} />
            <div>
              <p className="text-sm text-gray-600">Appartements</p>
              <p className="text-2xl font-bold text-gray-800">
                {totalAppartements}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-orange-600" size={32} />
            <div>
              <p className="text-sm text-gray-600">Moyenne / Agent</p>
              <p className="text-2xl font-bold text-gray-800">
                {moyenneParAgent.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <TrendingUp
              className={equilibreGlobal >= 70 ? 'text-green-600' : 'text-red-600'}
              size={32}
            />
            <div>
              <p className="text-sm text-gray-600">Équilibre global</p>
              <p className="text-2xl font-bold text-gray-800">
                {equilibreGlobal.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Distribution de charge par agent
        </h3>

        {scoresArray.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucune donnée de distribution disponible
          </p>
        ) : (
          <div className="space-y-4">
            {scoresArray.map((score) => {
              const percentage = maxScore > 0 ? (score.score_equilibre / maxScore) * 100 : 0;

              return (
                <div key={score.agent_id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">
                      {getAgentName(score.agent_id)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {score.nombre_appartements} appt. - Score: {score.score_equilibre.toFixed(0)}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end px-2"
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">{score.total_chambres}</span> chambres
                    </div>
                    <div>
                      <span className="font-medium">{score.total_surface.toFixed(0)}</span>m²
                    </div>
                    <div>
                      <span className="font-medium">{score.total_distance.toFixed(1)}</span>km
                    </div>
                    <div>
                      <span className="font-medium">{score.total_difficulte}</span> difficulté
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg shadow-md p-6 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3">
          Comment fonctionne l'équilibre ?
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Score de charge:</strong> Calculé en fonction du nombre de chambres,
            surface, distance et difficulté de chaque appartement.
          </p>
          <p>
            <strong>Équilibre global:</strong> Mesure la répartition équitable entre agents.
            Plus le score est élevé (proche de 100%), plus la distribution est équitable.
          </p>
          <p>
            <strong>Facteurs de calcul:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Chambres: ×10 points</li>
            <li>Surface: ×0.5 points par m²</li>
            <li>Distance: ×2 points par km</li>
            <li>Difficulté: ×15 points par niveau</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
