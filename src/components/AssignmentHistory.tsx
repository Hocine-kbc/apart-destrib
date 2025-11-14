import { useState, useEffect, useMemo } from 'react';
import { Clock, History, RefreshCcw, RotateCcw } from 'lucide-react';
import {
  supabase,
  type Agent,
  type Appartement,
  type HistoriqueAffectation,
} from '../lib/supabase';

type HistoryEntry = HistoriqueAffectation & {
  appartements: Pick<Appartement, 'nom'> | null;
  agents: Pick<Agent, 'nom'> | null;
};

type AssignmentHistoryProps = {
  onRefresh?: () => void;
};

export default function AssignmentHistory({ onRefresh }: AssignmentHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    loadAgents();
  }, []);

  async function loadAgents() {
    const { data, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .order('nom');

    if (!agentError && data) {
      setAgents(data);
    }
  }

  async function loadHistory() {
    setLoading(true);
    setError(null);

    const { data, error: historyError } = await supabase
      .from('historique_affectations')
      .select(
        `
          id,
          appartement_id,
          agent_id,
          date_debut,
          date_fin,
          score_equilibre,
          created_at,
          appartements:appartement_id (nom),
          agents:agent_id (nom)
        `
      )
      .order('date_debut', { ascending: false })
      .limit(200);

    if (historyError) {
      setError("Impossible de récupérer l'historique pour le moment.");
    } else if (data) {
      setHistory(data as HistoryEntry[]);
    }

    setLoading(false);
    onRefresh?.();
  }

  async function markAssignmentCompleted(entry: HistoryEntry) {
    if (entry.date_fin) return;

    const confirmation = window.confirm(
      "Marquer cette affectation comme terminée ? L'appartement redeviendra disponible."
    );

    if (!confirmation) return;

    const endDate = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('historique_affectations')
      .update({ date_fin: endDate })
      .eq('id', entry.id);

    if (updateError) {
      setError("Impossible de clôturer l'affectation.");
      return;
    }

    await supabase
      .from('appartements')
      .update({
        agent_id: null,
        statut: 'disponible',
        updated_at: endDate,
      })
      .eq('id', entry.appartement_id);

    loadHistory();
    onRefresh?.();
  }

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      const matchesAgent = filterAgent === 'all' || entry.agent_id === filterAgent;
      const matchesStatus = showActiveOnly ? entry.date_fin === null : true;
      return matchesAgent && matchesStatus;
    });
  }, [history, filterAgent, showActiveOnly]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History size={24} className="text-blue-600" />
            Historique des affectations
          </h2>
          <p className="text-sm text-gray-600">
            Consultez les affectations passées et clôturez les missions terminées.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.nom}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Affectations en cours
          </label>

          <button
            onClick={loadHistory}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCcw size={18} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Clock className="mr-2 animate-spin" size={20} />
          Chargement de l'historique en cours...
        </div>
      ) : filteredHistory.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          Aucun enregistrement trouvé avec les filtres actuels.
        </p>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((entry) => {
            const appartementName = entry.appartements?.nom ?? 'Appartement inconnu';
            const agentName = entry.agents?.nom ?? 'Agent inconnu';
            const dateDebut = new Date(entry.date_debut).toLocaleDateString();
            const dateFin = entry.date_fin
              ? new Date(entry.date_fin).toLocaleDateString()
              : null;

            return (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-500">
                    {appartementName}
                  </p>
                  <p className="text-lg font-semibold text-gray-800">{agentName}</p>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Début</span>
                    <span className="font-medium text-gray-800">{dateDebut}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Fin</span>
                    <span
                      className={`font-medium ${
                        dateFin ? 'text-gray-800' : 'text-green-600'
                      }`}
                    >
                      {dateFin ?? 'En cours'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Score cumul&eacute;</span>
                    <span className="font-medium text-gray-800">
                      {entry.score_equilibre?.toFixed(0) ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Créé le</span>
                    <span className="font-medium text-gray-800">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {!entry.date_fin && (
                  <button
                    onClick={() => markAssignmentCompleted(entry)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <RotateCcw size={18} />
                    Clôturer la mission
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


