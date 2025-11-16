import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Agent = {
  id: string;
  nom: string;
  email: string;
  secteur_preference: string | null;
  charge_actuelle: number;
  created_at: string;
};

export type Appartement = {
  id: string;
  nom: string;
  adresse: string;
  secteur: string;
  nombre_chambres: number;
  surface: number;
  distance_base: number;
  latitude: number | null;
  longitude: number | null;
  difficulte: number;
  agent_id: string | null;
  statut: 'disponible' | 'assigne' | 'inactif';
  created_at: string;
  updated_at: string;
};

export type HistoriqueAffectation = {
  id: string;
  appartement_id: string;
  agent_id: string;
  date_debut: string;
  date_fin: string | null;
  score_equilibre: number;
  created_at: string;
};
