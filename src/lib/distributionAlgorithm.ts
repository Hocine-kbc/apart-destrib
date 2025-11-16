import type { Agent, Appartement } from './supabase';

export type AppartementWithAgent = Appartement & {
  agent?: Agent;
};

export type DistributionScore = {
  agent_id: string;
  total_chambres: number;
  total_surface: number;
  total_distance: number;
  total_difficulte: number;
  nombre_appartements: number;
  score_equilibre: number;
};

export type AgentRouteStep = {
  appartement: Appartement;
  ordre: number;
  distanceDepuisPrecedent: number;
};

export type AgentRoute = {
  agentId: string;
  totalDistance: number;
  etapes: AgentRouteStep[];
};

export function calculateDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export function buildAgentRoute(
  agentId: string,
  appartements: Appartement[],
  base?: {
    latitude: number;
    longitude: number;
  }
): AgentRoute {
  const visitables = appartements.filter(
    (a) => a.latitude !== null && a.longitude !== null
  );

  if (visitables.length === 0) {
    return { agentId, totalDistance: 0, etapes: [] };
  }

  const remaining = [...visitables];
  const etapes: AgentRouteStep[] = [];
  let totalDistance = 0;

  let currentPoint:
    | { latitude: number; longitude: number }
    | null = base ?? null;

  let ordre = 1;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    remaining.forEach((appt, index) => {
      const point = { latitude: appt.latitude!, longitude: appt.longitude! };
      let d = 0;

      if (currentPoint) {
        d = calculateDistanceKm(currentPoint, point);
      }

      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });

    const next = remaining.splice(bestIndex, 1)[0];
    totalDistance += currentPoint
      ? calculateDistanceKm(
          currentPoint,
          { latitude: next.latitude!, longitude: next.longitude! }
        )
      : 0;

    etapes.push({
      appartement: next,
      ordre,
      distanceDepuisPrecedent: currentPoint
        ? calculateDistanceKm(
            currentPoint,
            { latitude: next.latitude!, longitude: next.longitude! }
          )
        : 0,
    });

    currentPoint = { latitude: next.latitude!, longitude: next.longitude! };
    ordre += 1;
  }

  return { agentId, totalDistance, etapes };
}

export function calculateWorkloadScore(appartement: Appartement): number {
  const chambreWeight = 10;
  const surfaceWeight = 0.5;
  const distanceWeight = 2;
  const difficulteWeight = 15;

  return (
    appartement.nombre_chambres * chambreWeight +
    appartement.surface * surfaceWeight +
    appartement.distance_base * distanceWeight +
    appartement.difficulte * difficulteWeight
  );
}

export function calculateAgentScores(
  agents: Agent[],
  appartements: AppartementWithAgent[]
): Map<string, DistributionScore> {
  const scores = new Map<string, DistributionScore>();

  agents.forEach((agent) => {
    scores.set(agent.id, {
      agent_id: agent.id,
      total_chambres: 0,
      total_surface: 0,
      total_distance: 0,
      total_difficulte: 0,
      nombre_appartements: 0,
      score_equilibre: 0,
    });
  });

  appartements.forEach((appt) => {
    if (appt.agent_id && scores.has(appt.agent_id)) {
      const score = scores.get(appt.agent_id)!;
      score.total_chambres += appt.nombre_chambres;
      score.total_surface += appt.surface;
      score.total_distance += appt.distance_base;
      score.total_difficulte += appt.difficulte;
      score.nombre_appartements += 1;
      score.score_equilibre = calculateWorkloadScore(appt);
    }
  });

  scores.forEach((score) => {
    const chambreWeight = 10;
    const surfaceWeight = 0.5;
    const distanceWeight = 2;
    const difficulteWeight = 15;

    score.score_equilibre =
      score.total_chambres * chambreWeight +
      score.total_surface * surfaceWeight +
      score.total_distance * distanceWeight +
      score.total_difficulte * difficulteWeight;
  });

  return scores;
}

export function suggestOptimalAgent(
  appartement: Appartement,
  agents: Agent[],
  currentScores: Map<string, DistributionScore>
): string | null {
  if (agents.length === 0) return null;

  const apptScore = calculateWorkloadScore(appartement);

  let bestAgent: string | null = null;
  let lowestScoreDiff = Infinity;

  agents.forEach((agent) => {
    const agentScore = currentScores.get(agent.id)?.score_equilibre || 0;

    const secteurBonus = agent.secteur_preference === appartement.secteur ? -20 : 0;

    const newScore = agentScore + apptScore + secteurBonus;

    const avgScore =
      Array.from(currentScores.values()).reduce(
        (sum, s) => sum + s.score_equilibre,
        0
      ) / agents.length;

    const scoreDiff = Math.abs(newScore - avgScore);

    if (scoreDiff < lowestScoreDiff) {
      lowestScoreDiff = scoreDiff;
      bestAgent = agent.id;
    }
  });

  return bestAgent;
}

export function calculateEquilibreGlobal(
  scores: Map<string, DistributionScore>
): number {
  const scoreValues = Array.from(scores.values()).map((s) => s.score_equilibre);

  if (scoreValues.length === 0) return 0;

  const avg = scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length;
  const variance =
    scoreValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    scoreValues.length;

  const stdDev = Math.sqrt(variance);

  const coefficientOfVariation = avg > 0 ? (stdDev / avg) * 100 : 0;

  return Math.max(0, 100 - coefficientOfVariation);
}
