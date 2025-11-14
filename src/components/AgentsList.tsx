import { useState, useEffect } from 'react';
import { UserCircle, Plus, Trash2 } from 'lucide-react';
import { supabase, type Agent } from '../lib/supabase';

type AgentsListProps = {
  onAgentUpdate: () => void;
};

export default function AgentsList({ onAgentUpdate }: AgentsListProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [newAgent, setNewAgent] = useState({
    nom: '',
    email: '',
    secteur_preference: '',
  });

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function loadAgents() {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('nom');

    if (error) {
      setStatus({
        type: 'error',
        message: "Impossible de récupérer la liste des agents (vérifiez Supabase).",
      });
      return;
    }

    if (data) {
      setAgents(data);
    }
  }

  async function handleAddAgent() {
    if (!newAgent.nom || !newAgent.email) {
      setStatus({ type: 'error', message: 'Merci de renseigner un nom et un email.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    const { error } = await supabase.from('agents').insert([
      {
        ...newAgent,
        secteur_preference: newAgent.secteur_preference || null,
      },
    ]);

    if (error) {
      setStatus({
        type: 'error',
        message:
          "Ajout impossible. Vérifiez que l'email est unique et que votre configuration Supabase autorise les écritures.",
      });
      setIsSubmitting(false);
      return;
    }

    setNewAgent({ nom: '', email: '', secteur_preference: '' });
    setIsAdding(false);
    setIsSubmitting(false);
    setStatus({ type: 'success', message: 'Agent ajouté avec succès.' });
    await loadAgents();
    onAgentUpdate();
  }

  async function handleDeleteAgent(id: string) {
    const { error } = await supabase.from('agents').delete().eq('id', id);

    if (!error) {
      loadAgents();
      onAgentUpdate();
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Agents de ménage</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Ajouter
        </button>
      </div>

      {isAdding && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-blue-200">
          <h3 className="font-semibold mb-4 text-gray-700">Nouvel agent</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nom"
              value={newAgent.nom}
              onChange={(e) =>
                setNewAgent({ ...newAgent, nom: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="email"
              placeholder="Email"
              value={newAgent.email}
              onChange={(e) =>
                setNewAgent({ ...newAgent, email: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Secteur de préférence"
              value={newAgent.secteur_preference}
              onChange={(e) =>
                setNewAgent({ ...newAgent, secteur_preference: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddAgent}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            status.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserCircle size={40} className="text-blue-600" />
              <div>
                <p className="font-semibold text-gray-800">{agent.nom}</p>
                <p className="text-sm text-gray-600">{agent.email}</p>
                {agent.secteur_preference && (
                  <p className="text-xs text-gray-500">
                    Secteur: {agent.secteur_preference}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDeleteAgent(agent.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Aucun agent enregistré
          </p>
        )}
      </div>
    </div>
  );
}
