/**
 * Mirror of the GraphQL types served by DashboardKpiResolver. Keeping this
 * 1:1 with the backend ObjectTypes makes the FE-BE contract trivially
 * auditable — change one, change the other.
 */

export type TrendGranularity = 'DAY' | 'WEEK' | 'MONTH';

export interface AtelierKpi {
  tauxClotures: number;
  tauxEnCours: number;
  nbEnCours: number;
}
export interface DelaisKpi {
  tatMoyenJours: number;
  tauxStagnant: number;
  delaiMoyenStatutJours: number;
}
export interface SatisfactionKpi {
  score: number | null;
  nbReclamations: number | null;
}
export interface VolumeKpi {
  nbRecus: number;
  nbClotures: number;
  nbEnCours: number;
  nbRetours: number;
}
export interface FinanceKpi {
  tauxFacturation: number | null;
  caFacture: number | null;
  margeBrute: number | null;
  coutHoraire: number | null;
  tauxRecouvrement: number | null;
  creances: number | null;
  facturesGt90: number | null;
  delaiPaiementJours: number | null;
}

export interface DashboardOverview {
  atelier: AtelierKpi;
  delais: DelaisKpi;
  satisfaction: SatisfactionKpi;
  volume: VolumeKpi;
  finance: FinanceKpi;
}

export interface TrendPoint {
  label: string;
  bucketStart: string;
  recus: number;
  clotures: number;
  retours: number;
}

export interface FinanceTrendPoint {
  label: string;
  bucketStart: string;
  caFacture: number;
  tauxFacturation: number | null;
}

export interface CategorySlice {
  categoryId: string | null;
  categoryName: string;
  count: number;
}

export interface TechLeaderRow {
  techId: string;
  techName: string;
  role: string | null;
  nbDiTraites: number;
  nbDiClotures: number;
  firstTimeRight: number;
  tauxRetours: number;
  tatMoyenJours: number;
  tauxIrreparables: number;
}
