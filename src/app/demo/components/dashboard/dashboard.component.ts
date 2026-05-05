// ═══════════════════════════════════════════════════
//  SAV ATELIER — KPI DASHBOARD
//  dashboard.component.ts
// ═══════════════════════════════════════════════════
import { Component, OnInit } from '@angular/core';

interface Technicien {
    nom: string;
    role: string;
    nbDiTraites: number;
    nbDiClotures: number;
    firstTimeRight: number;
    tauxRetours: number;
    tatMoyen: number;
    tauxIrreparables: number;
}

interface FinanceKpi {
    label: string;
    value: string;
    icon: string;
    target?: string;
    statusClass: string;
}

interface RhKpi {
    label: string;
    value: string;
    progress: number;
    class: string;
}

@Component({
    selector: 'app-sav-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
    today = new Date();
    selectedMonth: Date = new Date();

    // ─── A — KPI ATELIER ──────────────────────────────
    kpiAtelier = {
        tauxClotures: 87, // % — cible ≥ 80
    };

    // ─── B — DÉLAIS ───────────────────────────────────
    kpiDelais = {
        tatMoyen: 4.2, // jours — cible ≤ 5
        tauxEnCours: 21, // % — cible ≤ 24
        tauxAttentePercent: 18, // % — cible ≤ 20
        delaiApproPdr: 6, // jours — cible ≤ 7
    };

    get tatProgress(): number {
        return Math.min((this.kpiDelais.tatMoyen / 10) * 100, 100);
    }

    // ─── C — VOLUME & CHARGE ──────────────────────────
    kpiVolume = {
        nbRecus: 124,
        nbClotures: 108,
        nbEnCours: 22,
        nbRetours: 1,
    };

    volumeStats = [
        { label: 'DI Reçus', value: 124, class: 'kpi-neutral', target: '' },
        { label: 'DI Clôturés', value: 108, class: 'kpi-green', target: '' },
        { label: 'DI en cours', value: 22, class: 'kpi-green', target: '≤ 30' },
        { label: 'Retours/sem', value: 1, class: 'kpi-green', target: '≤ 2' },
    ];

    // ─── D — SATISFACTION ─────────────────────────────
    satisfactionScore = 4.2;
    nbReclamations = 1;

    // ─── STATUS GLOBAL ────────────────────────────────
    get globalStatus(): { label: string; severity: string } {
        const score = this.kpiAtelier.tauxClotures;
        if (score >= 80)
            return { label: '✓ Objectifs Atteints', severity: 'success' };
        if (score >= 65) return { label: '⚠ Attention', severity: 'warning' };
        return { label: '✗ Sous Objectif', severity: 'danger' };
    }

    // ─── TECHNICIANS ──────────────────────────────────
    techniciens: Technicien[] = [
        {
            nom: 'Slimani.R',
            role: 'Coordinateur',
            nbDiTraites: 38,
            nbDiClotures: 35,
            firstTimeRight: 92,
            tauxRetours: 5,
            tatMoyen: 3.8,
            tauxIrreparables: 3,
        },
        {
            nom: 'Hamdi.A',
            role: 'Technicien',
            nbDiTraites: 31,
            nbDiClotures: 26,
            firstTimeRight: 84,
            tauxRetours: 13,
            tatMoyen: 5.2,
            tauxIrreparables: 6,
        },
        {
            nom: 'Arfaoui.M',
            role: 'Technicien',
            nbDiTraites: 29,
            nbDiClotures: 27,
            firstTimeRight: 93,
            tauxRetours: 7,
            tatMoyen: 4.1,
            tauxIrreparables: 4,
        },
        {
            nom: 'Boualleg.O',
            role: 'Technicien',
            nbDiTraites: 26,
            nbDiClotures: 20,
            firstTimeRight: 77,
            tauxRetours: 15,
            tatMoyen: 6.0,
            tauxIrreparables: 8,
        },
    ];

    // ─── FINANCE ──────────────────────────────────────
    finance = {
        tauxFacturation: 91,
        caFacture: 48500,
        coutHoraire: 85,
        margeBrute: 38,
        tauxRecouvrement: 78,
        creances: 12400,
        facturesGt90: 3200,
        delaiPaiement: 42,
    };

    financeKpis: FinanceKpi[] = [
        {
            label: 'Taux Facturation',
            value: '91%',
            icon: 'pi-file-edit',
            target: 'Cible ≥ 90%',
            statusClass: 'fin-green',
        },
        {
            label: 'CA Facturé',
            value: '48 500 €',
            icon: 'pi-euro',
            target: '',
            statusClass: 'fin-blue',
        },
        {
            label: 'Marge Brute',
            value: '38%',
            icon: 'pi-chart-line',
            target: 'Cible ≥ 35%',
            statusClass: 'fin-green',
        },
        {
            label: 'Coût Horaire',
            value: '85 €/h',
            icon: 'pi-stopwatch',
            target: '',
            statusClass: 'fin-blue',
        },
        {
            label: 'Taux Recouvr.',
            value: '78%',
            icon: 'pi-wallet',
            target: 'Cible ≥ 85%',
            statusClass: 'fin-orange',
        },
        {
            label: 'Créances',
            value: '12 400 €',
            icon: 'pi-credit-card',
            target: '',
            statusClass: 'fin-blue',
        },
        {
            label: 'Fact. > 90j',
            value: '3 200 €',
            icon: 'pi-exclamation-triangle',
            target: 'À relancer',
            statusClass: 'fin-red',
        },
        {
            label: 'Délai Paiement',
            value: '42 jours',
            icon: 'pi-calendar-times',
            target: '',
            statusClass: 'fin-orange',
        },
    ];

    rhKpis: RhKpi[] = [
        {
            label: 'Absentéisme',
            value: '3.2%',
            progress: 32,
            class: 'kpi-green',
        },
        {
            label: 'Heures travaillées',
            value: '682 h',
            progress: 85,
            class: 'kpi-neutral',
        },
        {
            label: 'Formations réal.',
            value: '2/3',
            progress: 66,
            class: 'kpi-orange',
        },
    ];

    // ═══════════════════════════════════════════════════
    //  CHART CONFIGURATIONS
    // ═══════════════════════════════════════════════════

    // Volume Bar Chart
    volumeChartData: any;
    volumeChartOptions: any;

    // Trend Line Chart (weekly)
    trendChartData: any;
    trendChartOptions: any;

    // Category Donut
    categoryChartData: any;
    categoryChartOptions: any;

    // Satisfaction Trend
    satisfactionTrendData: any;
    satisfactionTrendOptions: any;

    // Tech FTR Bar
    techFtrChartData: any;
    techFtrChartOptions: any;

    // Finance Bar
    financeBarData: any;
    financeBarOptions: any;

    ngOnInit(): void {
        this._buildVolumeChart();
        this._buildTrendChart();
        this._buildCategoryChart();
        this._buildSatisfactionTrendChart();
        this._buildTechFtrChart();
        this._buildFinanceChart();
    }

    // ── HELPERS ──────────────────────────────────────

    /** Returns CSS class for a KPI value vs target */
    kpiClass(value: number, target: number, mode: 'gte' | 'lte'): string {
        const ok = mode === 'gte' ? value >= target : value <= target;
        const mid =
            mode === 'gte' ? value >= target * 0.85 : value <= target * 1.25;
        if (ok) return 'kpi-green';
        if (mid) return 'kpi-orange';
        return 'kpi-red';
    }

    /** Returns hex color for p-knob valueColor */
    kpiKnobColor(value: number, target: number, mode: 'gte' | 'lte'): string {
        const cls = this.kpiClass(value, target, mode);
        const map: Record<string, string> = {
            'kpi-green': '#22c55e',
            'kpi-orange': '#f97316',
            'kpi-red': '#ef4444',
        };
        return map[cls] ?? '#94a3b8';
    }

    // ── CHART BUILDERS ───────────────────────────────

    private _buildVolumeChart(): void {
        this.volumeChartData = {
            labels: ['Reçus', 'Clôturés', 'En cours', 'Retours'],
            datasets: [
                {
                    label: 'Volume DI',
                    data: [
                        this.kpiVolume.nbRecus,
                        this.kpiVolume.nbClotures,
                        this.kpiVolume.nbEnCours,
                        this.kpiVolume.nbRetours,
                    ],
                    backgroundColor: [
                        '#3b82f6',
                        '#22c55e',
                        '#f97316',
                        '#ef4444',
                    ],
                    borderRadius: 6,
                    barThickness: 32,
                },
            ],
        };
        this.volumeChartOptions = {
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } },
            },
            responsive: true,
            maintainAspectRatio: false,
        };
    }

    private _buildTrendChart(): void {
        const weeks = [
            'S1',
            'S2',
            'S3',
            'S4',
            'S5',
            'S6',
            'S7',
            'S8',
            'S9',
            'S10',
            'S11',
            'S12',
        ];
        this.trendChartData = {
            labels: weeks,
            datasets: [
                {
                    label: 'DI Reçus',
                    data: [28, 32, 25, 30, 35, 29, 33, 27, 31, 38, 30, 34],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'DI Clôturés',
                    data: [24, 29, 22, 27, 32, 26, 30, 24, 29, 35, 27, 31],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'DI en cours',
                    data: [12, 15, 18, 21, 24, 27, 30, 27, 29, 32, 25, 22],
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249,115,22,0.05)',
                    fill: false,
                    tension: 0.4,
                    borderDash: [5, 5],
                    pointRadius: 3,
                },
            ],
        };
        this.trendChartOptions = {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 20 },
                },
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } },
            },
            responsive: true,
            maintainAspectRatio: false,
        };
    }

    private _buildCategoryChart(): void {
        this.categoryChartData = {
            labels: [
                'Électronique',
                'Mécanique',
                'Hydraulique',
                'Électrique',
                'Autre',
            ],
            datasets: [
                {
                    data: [34, 28, 18, 14, 6],
                    backgroundColor: [
                        '#3b82f6',
                        '#22c55e',
                        '#f97316',
                        '#a855f7',
                        '#94a3b8',
                    ],
                    hoverOffset: 10,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                },
            ],
        };
        this.categoryChartOptions = {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 12,
                        font: { size: 11 },
                    },
                },
            },
            cutout: '65%',
            responsive: true,
            maintainAspectRatio: false,
        };
    }

    private _buildSatisfactionTrendChart(): void {
        this.satisfactionTrendData = {
            labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'],
            datasets: [
                {
                    label: 'Score /5',
                    data: [3.8, 4.0, 3.9, 4.1, 4.3, 4.2],
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249,115,22,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                },
            ],
        };
        this.satisfactionTrendOptions = {
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: 3,
                    max: 5,
                    grid: { color: '#e2e8f0' },
                    ticks: {
                        callback: (v: number) => v + '/5',
                    },
                },
                x: { grid: { display: false } },
            },
            responsive: true,
            maintainAspectRatio: false,
        };
    }

    private _buildTechFtrChart(): void {
        const names = this.techniciens.map((t) => t.nom);
        const ftrValues = this.techniciens.map((t) => t.firstTimeRight);
        const bgColors = ftrValues.map((v) =>
            v >= 85 ? '#22c55e' : v >= 72 ? '#f97316' : '#ef4444',
        );

        this.techFtrChartData = {
            labels: names,
            datasets: [
                {
                    label: 'FTR %',
                    data: ftrValues,
                    backgroundColor: bgColors,
                    borderRadius: 6,
                    barThickness: 40,
                },
                {
                    label: 'Objectif (85%)',
                    data: names.map(() => 85),
                    type: 'line',
                    borderColor: '#3b82f6',
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                },
            ],
        };
        this.techFtrChartOptions = {
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true } },
            },
            scales: {
                y: {
                    min: 60,
                    max: 100,
                    grid: { color: '#e2e8f0' },
                    ticks: { callback: (v: number) => v + '%' },
                },
                x: { grid: { display: false } },
            },
            responsive: true,
            maintainAspectRatio: false,
        };
    }

    private _buildFinanceChart(): void {
        this.financeBarData = {
            labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'],
            datasets: [
                {
                    label: 'CA Facturé (k€)',
                    data: [41, 44, 46, 43, 48, 48.5],
                    backgroundColor: '#3b82f6',
                    borderRadius: 6,
                    barThickness: 22,
                    yAxisID: 'y',
                },
                {
                    label: 'Taux Facturation (%)',
                    data: [85, 88, 89, 87, 91, 91],
                    type: 'line',
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    yAxisID: 'y1',
                },
            ],
        };
        this.financeBarOptions = {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 16 },
                },
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 30,
                    title: { display: true, text: 'k€' },
                    grid: { color: '#e2e8f0' },
                },
                y1: {
                    position: 'right',
                    min: 75,
                    max: 100,
                    grid: { drawOnChartArea: false },
                    ticks: { callback: (v: number) => v + '%' },
                },
                x: { grid: { display: false } },
            },
            responsive: true,
            maintainAspectRatio: false,
        };
    }
}
