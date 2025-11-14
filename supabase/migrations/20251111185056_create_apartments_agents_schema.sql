/*
  # Schéma de distribution d'appartements

  1. Nouvelles Tables
    - `agents`
      - `id` (uuid, clé primaire)
      - `nom` (text) - Nom de l'agent de ménage
      - `email` (text, unique) - Email de l'agent
      - `secteur_preference` (text) - Secteur de préférence
      - `charge_actuelle` (integer) - Score de charge actuelle
      - `created_at` (timestamptz)
    
    - `appartements`
      - `id` (uuid, clé primaire)
      - `nom` (text) - Nom/numéro de l'appartement
      - `adresse` (text) - Adresse complète
      - `secteur` (text) - Secteur géographique
      - `nombre_chambres` (integer) - Nombre de chambres
      - `surface` (decimal) - Surface en m²
      - `distance_base` (decimal) - Distance depuis la base en km
      - `difficulte` (integer) - Score de difficulté (1-5)
      - `agent_id` (uuid, nullable) - Agent assigné
      - `statut` (text) - Statut: 'disponible', 'assigne', 'inactif'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `historique_affectations`
      - `id` (uuid, clé primaire)
      - `appartement_id` (uuid)
      - `agent_id` (uuid)
      - `date_debut` (timestamptz)
      - `date_fin` (timestamptz, nullable)
      - `score_equilibre` (decimal) - Score d'équilibre au moment de l'affectation
      - `created_at` (timestamptz)

  2. Sécurité
    - Activer RLS sur toutes les tables
    - Politiques pour les utilisateurs authentifiés
*/

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  email text UNIQUE NOT NULL,
  secteur_preference text,
  charge_actuelle integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appartements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  adresse text NOT NULL,
  secteur text NOT NULL,
  nombre_chambres integer NOT NULL,
  surface decimal(10,2) NOT NULL,
  distance_base decimal(10,2) NOT NULL,
  difficulte integer DEFAULT 3 CHECK (difficulte BETWEEN 1 AND 5),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  statut text DEFAULT 'disponible' CHECK (statut IN ('disponible', 'assigne', 'inactif')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historique_affectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appartement_id uuid REFERENCES appartements(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  date_debut timestamptz DEFAULT now(),
  date_fin timestamptz,
  score_equilibre decimal(10,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE appartements ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_affectations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents visibles par tous les utilisateurs authentifiés"
  ON agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents visibles par les utilisateurs publics"
  ON agents FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Agents modifiables par tous les utilisateurs authentifiés"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents modifiables par les utilisateurs publics"
  ON agents FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Agents modifiables UPDATE par tous les utilisateurs authentifiés"
  ON agents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Agents modifiables UPDATE par les utilisateurs publics"
  ON agents FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Agents supprimables par tous les utilisateurs authentifiés"
  ON agents FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Agents supprimables par les utilisateurs publics"
  ON agents FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Appartements visibles par tous les utilisateurs authentifiés"
  ON appartements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Appartements visibles par les utilisateurs publics"
  ON appartements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Appartements modifiables par tous les utilisateurs authentifiés"
  ON appartements FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Appartements modifiables par les utilisateurs publics"
  ON appartements FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Appartements modifiables UPDATE par tous les utilisateurs authentifiés"
  ON appartements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Appartements modifiables UPDATE par les utilisateurs publics"
  ON appartements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Appartements supprimables par tous les utilisateurs authentifiés"
  ON appartements FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Appartements supprimables par les utilisateurs publics"
  ON appartements FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Historique visible par tous les utilisateurs authentifiés"
  ON historique_affectations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Historique visible par les utilisateurs publics"
  ON historique_affectations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Historique modifiable par tous les utilisateurs authentifiés"
  ON historique_affectations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Historique modifiable par les utilisateurs publics"
  ON historique_affectations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Historique modifiable UPDATE par tous les utilisateurs authentifiés"
  ON historique_affectations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Historique modifiable UPDATE par les utilisateurs publics"
  ON historique_affectations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_appartements_agent ON appartements(agent_id);
CREATE INDEX IF NOT EXISTS idx_appartements_statut ON appartements(statut);
CREATE INDEX IF NOT EXISTS idx_historique_agent ON historique_affectations(agent_id);
CREATE INDEX IF NOT EXISTS idx_historique_appartement ON historique_affectations(appartement_id);