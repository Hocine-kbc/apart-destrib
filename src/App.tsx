import { useState, useEffect } from 'react';
import { LayoutDashboard, Building2, Users, History } from 'lucide-react';
import { supabase, type Agent } from './lib/supabase';
import AgentsList from './components/AgentsList';
import AppartementsList from './components/AppartementsList';
import DistributionDashboard from './components/DistributionDashboard';
import AssignmentHistory from './components/AssignmentHistory';

type Tab = 'dashboard' | 'agents' | 'appartements' | 'historique';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadAgents();
  }, [refreshKey]);

  async function loadAgents() {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('nom');

    if (!error && data) {
      setAgents(data);
    }
  }

  function handleUpdate() {
    setRefreshKey((prev) => prev + 1);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md border-b-2 border-blue-500">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Distribution d'Appartements
          </h1>
          <p className="text-gray-600 mt-1">
            Gestion équitable des affectations pour agents de ménage
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
            }`}
          >
            <LayoutDashboard size={20} />
            Tableau de bord
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'agents'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
            }`}
          >
            <Users size={20} />
            Agents
          </button>
          <button
            onClick={() => setActiveTab('appartements')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'appartements'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
            }`}
          >
            <Building2 size={20} />
            Appartements
          </button>
          <button
            onClick={() => setActiveTab('historique')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'historique'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
            }`}
          >
            <History size={20} />
            Historique
          </button>
        </div>

        <div>
          {activeTab === 'dashboard' && (
            <DistributionDashboard agents={agents} refresh={refreshKey} />
          )}
          {activeTab === 'agents' && <AgentsList onAgentUpdate={handleUpdate} />}
          {activeTab === 'appartements' && (
            <AppartementsList agents={agents} onUpdate={handleUpdate} />
          )}
          {activeTab === 'historique' && (
            <AssignmentHistory onRefresh={handleUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
