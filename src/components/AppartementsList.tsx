import { useCallback, useEffect, useMemo, useState } from 'react';
import { Home, Plus, Trash2, Edit2, X, Wand2, Loader2, Lightbulb } from 'lucide-react';
import { supabase, type Appartement, type Agent } from '../lib/supabase';
import {
  suggestOptimalAgent,
  calculateAgentScores,
  calculateWorkloadScore,
  type DistributionScore,
  type AppartementWithAgent,
} from '../lib/distributionAlgorithm';

type AppartementsListProps = {
  agents: Agent[];
  onUpdate: () => void;
};

export default function AppartementsList({ agents, onUpdate }: AppartementsListProps) {
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [newAppt, setNewAppt] = useState({
    nom: '',
    adresse: '',
    secteur: '',
    nombre_chambres: 1,
    surface: 50,
    distance_base: 5,
    difficulte: 3,
  });
  const [scoreMap, setScoreMap] = useState<Map<string, DistributionScore>>(new Map());
  const [suggestions, setSuggestions] = useState<Record<string, string | null>>({});

  const loadAppartements = useCallback(async () => {
    const { data, error } = await supabase
      .from('appartements')
      .select('*')
      .order('nom');

    if (!error && data) {
      setAppartements(data);
      const scores = calculateAgentScores(
        agents,
        data.filter((appt) => appt.agent_id) as AppartementWithAgent[]
      );
      setScoreMap(new Map(scores));
      const computedSuggestions: Record<string, string | null> = {};
      data.forEach((appt) => {
        computedSuggestions[appt.id] = suggestOptimalAgent(appt, agents, scores);
      });
      setSuggestions(computedSuggestions);
    }
  }, [agents]);

  useEffect(() => {
    loadAppartements();
  }, [loadAppartements]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function handleAddAppartement() {
    if (!newAppt.nom || !newAppt.adresse) return;

    const { error } = await supabase.from('appartements').insert([newAppt]);

    if (!error) {
      setNewAppt({
        nom: '',
        adresse: '',
        secteur: '',
        nombre_chambres: 1,
        surface: 50,
        distance_base: 5,
        difficulte: 3,
      });
      setIsAdding(false);
      loadAppartements();
      onUpdate();
    }
  }

  async function handleDeleteAppartement(id: string) {
    const { error } = await supabase.from('appartements').delete().eq('id', id);

    if (!error) {
      loadAppartements();
      onUpdate();
    }
  }

  async function updateAssignment(appartement: Appartement, agentId: string | null) {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('appartements')
      .update({
        agent_id: agentId,
        statut: agentId ? 'assigne' : 'disponible',
        updated_at: now,
      })
      .eq('id', appartement.id);

    if (error) {
      return { success: false, message: "Impossible de mettre à jour l'appartement." };
    }

    await supabase
      .from('historique_affectations')
      .update({ date_fin: now })
      .eq('appartement_id', appartement.id)
      .is('date_fin', null);

    if (agentId) {
      await supabase.from('historique_affectations').insert([
        {
          appartement_id: appartement.id,
          agent_id: agentId,
          date_debut: now,
          score_equilibre: calculateWorkloadScore(appartement),
        },
      ]);
    }

    return { success: true };
  }

  async function handleAssignAgent(appartementId: string, agentId: string | null) {
    const appartement = appartements.find((a) => a.id === appartementId);
    if (!appartement) return;

    const result = await updateAssignment(appartement, agentId);

    if (result.success) {
      await loadAppartements();
      onUpdate();
      setFeedback({
        type: 'success',
        message: agentId
          ? 'Appartement assigné avec succès.'
          : "L'appartement a été remis en disponible.",
      });
      setEditingId(null);
    } else {
      setFeedback({
        type: 'error',
        message: result.message || "Impossible d'assigner cet appartement.",
      });
    }
  }

  async function handleAutoDistribute() {
    if (agents.length === 0) {
      setFeedback({ type: 'error', message: 'Ajoutez des agents avant de distribuer.' });
      return;
    }

    const unassigned = appartements.filter((appt) => !appt.agent_id && appt.statut !== 'inactif');

    if (unassigned.length === 0) {
      setFeedback({
        type: 'error',
        message: "Aucun appartement disponible à assigner automatiquement.",
      });
      return;
    }

    setIsAutoAssigning(true);
    setFeedback(null);

    const currentScores = new Map(scoreMap);
    const assignments: { appartement: Appartement; agentId: string }[] = [];

    const sorted = [...unassigned].sort(
      (a, b) => calculateWorkloadScore(b) - calculateWorkloadScore(a)
    );

    sorted.forEach((appartement) => {
      const agentId = suggestOptimalAgent(appartement, agents, currentScores);

      if (!agentId) return;

      assignments.push({ appartement, agentId });

      const score = currentScores.get(agentId);
      if (score) {
        score.total_chambres += appartement.nombre_chambres;
        score.total_surface += appartement.surface;
        score.total_distance += appartement.distance_base;
        score.total_difficulte += appartement.difficulte;
        score.nombre_appartements += 1;
        score.score_equilibre =
          score.total_chambres * 10 +
          score.total_surface * 0.5 +
          score.total_distance * 2 +
          score.total_difficulte * 15;
      }
    });

    if (assignments.length === 0) {
      setFeedback({
        type: 'error',
        message: "Impossible de déterminer une affectation optimale.",
      });
      setIsAutoAssigning(false);
      return;
    }

    let successCount = 0;
    let encounteredError = false;

    for (const assignment of assignments) {
      const result = await updateAssignment(assignment.appartement, assignment.agentId);
      if (result.success) {
        successCount += 1;
      } else {
        setFeedback({
          type: 'error',
          message: "Une erreur est survenue pendant la distribution automatique.",
        });
        encounteredError = true;
        break;
      }
    }

    await loadAppartements();
    onUpdate();
    if (!encounteredError && successCount > 0) {
      setFeedback({
        type: 'success',
        message: `${successCount} appartement(s) ont été assignés automatiquement.`,
      });
    }
    setIsAutoAssigning(false);
  }

  const getAgentName = useCallback(
    (agentId: string | null): string => {
      if (!agentId) return 'Non assigné';
      const agent = agents.find((a) => a.id === agentId);
      return agent?.nom || 'Inconnu';
    },
    [agents]
  );

  const appartUnassigned = useMemo(
    () => appartements.filter((appt) => !appt.agent_id),
    [appartements]
  );

  const appartAssignedByAgent = useMemo(() => {
    const groups = new Map<string, Appartement[]>();
    appartements
      .filter((appt) => appt.agent_id)
      .forEach((appt) => {
        const key = appt.agent_id as string;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(appt);
      });

    return Array.from(groups.entries()).map(([agentId, list]) => ({
      agentId,
      agentName: getAgentName(agentId),
      appartements: list.sort((a, b) => a.nom.localeCompare(b.nom)),
    }));
  }, [appartements, getAgentName]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Appartements</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus size={20} />
          Ajouter
        </button>
        <button
          onClick={handleAutoDistribute}
          disabled={isAutoAssigning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isAutoAssigning ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={20} />}
          Distribution intelligente
        </button>
      </div>

      {isAdding && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-green-200">
          <h3 className="font-semibold mb-4 text-gray-700">Nouvel appartement</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nom/Numéro"
              value={newAppt.nom}
              onChange={(e) => setNewAppt({ ...newAppt, nom: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Adresse"
              value={newAppt.adresse}
              onChange={(e) =>
                setNewAppt({ ...newAppt, adresse: e.target.value })
              }
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Secteur"
              value={newAppt.secteur}
              onChange={(e) =>
                setNewAppt({ ...newAppt, secteur: e.target.value })
              }
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="Chambres"
              value={newAppt.nombre_chambres}
              onChange={(e) =>
                setNewAppt({ ...newAppt, nombre_chambres: parseInt(e.target.value) })
              }
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="Surface (m²)"
              value={newAppt.surface}
              onChange={(e) =>
                setNewAppt({ ...newAppt, surface: parseFloat(e.target.value) })
              }
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="Distance (km)"
              value={newAppt.distance_base}
              onChange={(e) =>
                setNewAppt({
                  ...newAppt,
                  distance_base: parseFloat(e.target.value),
                })
              }
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <select
              value={newAppt.difficulte}
              onChange={(e) =>
                setNewAppt({ ...newAppt, difficulte: parseInt(e.target.value) })
              }
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value={1}>Difficulté: Très facile</option>
              <option value={2}>Difficulté: Facile</option>
              <option value={3}>Difficulté: Moyenne</option>
              <option value={4}>Difficulté: Difficile</option>
              <option value={5}>Difficulté: Très difficile</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddAppartement}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Enregistrer
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-8">
        {appartAssignedByAgent.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Appartements assignés</h3>
              <p className="text-sm text-gray-500">
                Répartition actuelle par agent ({appartAssignedByAgent.length} agent
                {appartAssignedByAgent.length > 1 ? 's' : ''})
              </p>
            </div>

            <div className="space-y-6">
              {appartAssignedByAgent.map((group) => (
                <div
                  key={group.agentId}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-blue-900">{group.agentName}</h4>
                      <p className="text-sm text-blue-700">
                        {group.appartements.length}{' '}
                        {group.appartements.length > 1 ? 'appartements' : 'appartement'} assigné
                        {group.appartements.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {group.appartements.map((appt) => (
                      <div
                        key={appt.id}
                        className="flex flex-col gap-3 bg-white border border-blue-100 rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <Home size={28} className="text-blue-600 shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{appt.nom}</p>
                            <p className="text-sm text-gray-600">{appt.adresse}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                              <span>{appt.nombre_chambres} ch.</span>
                              <span>{appt.surface}m²</span>
                              <span>{appt.distance_base}km</span>
                              <span>Diff: {appt.difficulte}/5</span>
                              <span className="font-medium text-blue-600">{appt.secteur}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-green-100 text-green-800">
                            {appt.statut}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(appt.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteAppartement(appt.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {editingId === appt.id && (
                          <div className="flex items-center gap-2">
                            <select
                              onChange={(e) => handleAssignAgent(appt.id, e.target.value || null)}
                              defaultValue={appt.agent_id || ''}
                              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Non assigné</option>
                              {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.nom}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Logements assignés',
                        value: group.appartements.length,
                        suffix: '',
                        format: (val: number) => val.toString(),
                      },
                      {
                        label: 'Total lits',
                        value: group.appartements.reduce(
                          (sum, appt) => sum + appt.nombre_chambres,
                          0
                        ),
                        suffix: ' lits',
                        format: (val: number) => val.toFixed(0),
                      },
                      {
                        label: 'Surface cumulée',
                        value: group.appartements.reduce(
                          (sum, appt) => sum + appt.surface,
                          0
                        ),
                        suffix: ' m²',
                        format: (val: number) => val.toFixed(1),
                      },
                      {
                        label: 'Distance totale',
                        value: group.appartements.reduce(
                          (sum, appt) => sum + appt.distance_base,
                          0
                        ),
                        suffix: ' km',
                        format: (val: number) => val.toFixed(1),
                      },
                    ].map((metric) => (
                      <div
                        key={`${group.agentId}-${metric.label}`}
                        className="bg-white border border-blue-100 rounded-lg p-3 flex flex-col"
                      >
                        <span className="text-xs uppercase tracking-wide text-blue-500">
                          {metric.label}
                        </span>
                        <span className="text-lg font-semibold text-blue-900">
                          {metric.format(metric.value)}
                          {metric.suffix}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Appartements disponibles</h3>
            <p className="text-sm text-gray-500">
              {appartUnassigned.length}{' '}
              {appartUnassigned.length > 1 ? 'appartements' : 'appartement'} à assigner
            </p>
          </div>

          <div className="space-y-3">
            {appartUnassigned.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Home size={36} className="text-green-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{appt.nom}</p>
                    <p className="text-sm text-gray-600">{appt.adresse}</p>
                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                      <span>{appt.nombre_chambres} ch.</span>
                      <span>{appt.surface}m²</span>
                      <span>{appt.distance_base}km</span>
                      <span>Diff: {appt.difficulte}/5</span>
                      <span className="font-medium text-blue-600">{appt.secteur}</span>
                    </div>
                    {suggestions[appt.id] && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 w-fit">
                        <Lightbulb size={14} />
                        <span>Suggestion : {getAgentName(suggestions[appt.id] ?? null)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editingId === appt.id ? (
                    <>
                      <select
                        onChange={(e) => handleAssignAgent(appt.id, e.target.value || null)}
                        defaultValue={appt.agent_id || ''}
                        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Non assigné</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.nom}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {getAgentName(appt.agent_id)}
                        </p>
                        <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                          {appt.statut}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingId(appt.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteAppartement(appt.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {appartUnassigned.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                Tous les appartements sont actuellement assignés
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
