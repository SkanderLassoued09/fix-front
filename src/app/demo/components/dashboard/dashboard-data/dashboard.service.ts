import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { Observable, map } from 'rxjs';
import {
  CategorySlice,
  DashboardOverview,
  FinanceTrendPoint,
  TechLeaderRow,
  TrendGranularity,
  TrendPoint,
} from './dashboard.types';

/**
 * Thin Apollo wrapper for the dashboard analytics endpoints. Each query is
 * `no-cache` because the dashboard already implements its own debounced
 * refresh through TicketRefreshService and we want live numbers — Apollo's
 * cache here would just stale the views.
 */
@Injectable({ providedIn: 'root' })
export class SavDashboardService {
  constructor(private apollo: Apollo) {}

  fetchOverview(startDate: string, endDate: string): Observable<DashboardOverview> {
    return this.apollo
      .query<{ dashboardKpi: DashboardOverview }>({
        query: gql`
          query DashboardKpi($startDate: String, $endDate: String) {
            dashboardKpi(startDate: $startDate, endDate: $endDate) {
              atelier {
                tauxClotures
                tauxEnCours
                nbEnCours
              }
              delais {
                tatMoyenJours
                tauxStagnant
                delaiMoyenStatutJours
              }
              satisfaction {
                score
                nbReclamations
              }
              volume {
                nbRecus
                nbClotures
                nbEnCours
                nbRetours
              }
              finance {
                tauxFacturation
                caFacture
                margeBrute
                coutHoraire
                tauxRecouvrement
                creances
                facturesGt90
                delaiPaiementJours
              }
            }
          }
        `,
        variables: { startDate, endDate },
        fetchPolicy: 'no-cache',
      })
      .pipe(map((res) => res.data?.dashboardKpi));
  }

  fetchTrend(
    startDate: string,
    endDate: string,
    granularity: TrendGranularity,
  ): Observable<TrendPoint[]> {
    return this.apollo
      .query<{ dashboardTrend: TrendPoint[] }>({
        query: gql`
          query DashboardTrend(
            $startDate: String
            $endDate: String
            $granularity: TrendGranularity
          ) {
            dashboardTrend(
              startDate: $startDate
              endDate: $endDate
              granularity: $granularity
            ) {
              label
              bucketStart
              recus
              clotures
              retours
            }
          }
        `,
        variables: { startDate, endDate, granularity },
        fetchPolicy: 'no-cache',
      })
      .pipe(map((res) => res.data?.dashboardTrend ?? []));
  }

  fetchCategories(
    startDate: string,
    endDate: string,
  ): Observable<CategorySlice[]> {
    return this.apollo
      .query<{ dashboardCategories: CategorySlice[] }>({
        query: gql`
          query DashboardCategories($startDate: String, $endDate: String) {
            dashboardCategories(startDate: $startDate, endDate: $endDate) {
              categoryId
              categoryName
              count
            }
          }
        `,
        variables: { startDate, endDate },
        fetchPolicy: 'no-cache',
      })
      .pipe(map((res) => res.data?.dashboardCategories ?? []));
  }

  fetchFinanceTrend(
    startDate: string,
    endDate: string,
    granularity: TrendGranularity,
  ): Observable<FinanceTrendPoint[]> {
    return this.apollo
      .query<{ dashboardFinanceTrend: FinanceTrendPoint[] }>({
        query: gql`
          query DashboardFinanceTrend(
            $startDate: String
            $endDate: String
            $granularity: TrendGranularity
          ) {
            dashboardFinanceTrend(
              startDate: $startDate
              endDate: $endDate
              granularity: $granularity
            ) {
              label
              bucketStart
              caFacture
              tauxFacturation
            }
          }
        `,
        variables: { startDate, endDate, granularity },
        fetchPolicy: 'no-cache',
      })
      .pipe(map((res) => res.data?.dashboardFinanceTrend ?? []));
  }

  fetchLeaderboard(
    startDate: string,
    endDate: string,
    limit = 20,
  ): Observable<TechLeaderRow[]> {
    return this.apollo
      .query<{ dashboardTechLeaderboard: TechLeaderRow[] }>({
        query: gql`
          query DashboardTechLeaderboard(
            $startDate: String
            $endDate: String
            $limit: Int
          ) {
            dashboardTechLeaderboard(
              startDate: $startDate
              endDate: $endDate
              limit: $limit
            ) {
              techId
              techName
              role
              nbDiTraites
              nbDiClotures
              firstTimeRight
              tauxRetours
              tatMoyenJours
              tauxIrreparables
            }
          }
        `,
        variables: { startDate, endDate, limit },
        fetchPolicy: 'no-cache',
      })
      .pipe(map((res) => res.data?.dashboardTechLeaderboard ?? []));
  }
}
