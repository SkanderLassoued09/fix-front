import { OnInit } from '@angular/core';
import { Component } from '@angular/core';
import { LayoutService } from './service/app.layout.service';

@Component({
    selector: 'app-menu',
    templateUrl: './app.menu.component.html',
})
export class AppMenuComponent implements OnInit {
    model: any[] = [];
    role: string;

    constructor(public layoutService: LayoutService) {
        this.role = localStorage.getItem('role');
    }

    ngOnInit() {
        // Menu copy reference (used across every role's model below):
        //   Group labels: « Tableau de bord », « Personnel », « Clients »,
        //                 « Demandes d'intervention »
        //   Items       : « Tableau de bord », « Personnel », « Clients »,
        //                 « Sociétés », « Toutes les DI », « Coordination »,
        //                 « Magasin », « Atelier technique »
        // Routes are unchanged — only the user-visible labels move.
        //
        // « Archives DI » (/archives) et « Réunions » (/tickets/reunions) ont été
        // RETIRÉS du menu pour TOUS les rôles. Les routes, elles, restent
        // ouvertes et les listes blanches de `role-routes.ts` sont inchangées :
        // un rappel Discord poste un lien `/tickets/reunions?open=<pvId>` qui
        // doit continuer de fonctionner. Masquer n'est donc PAS interdire.
        if (this.role === 'ADMIN_MANAGER' || this.role === 'ADMIN_TECH') {
            this.model = [
                {
                    label: 'Tableau de bord',
                    items: [
                        {
                            label: 'Tableau de bord',
                            icon: 'pi pi-fw pi-chart-bar',
                            routerLink: ['/'],
                        },
                    ],
                },
                {
                    label: 'Personnel',
                    items: [
                        {
                            label: 'Personnel',
                            icon: 'pi pi-fw pi-users',
                            routerLink: ['/profiles/profile/profile-list'],
                        },
                    ],
                },
                {
                    label: 'Clients',
                    items: [
                        {
                            label: 'Clients',
                            icon: 'pi pi-fw pi-user',
                            routerLink: ['/clients/client/client-list'],
                        },
                        {
                            label: 'Sociétés',
                            icon: 'pi pi-fw pi-building',
                            routerLink: ['/companies/company/company-list'],
                        },
                    ],
                },

                {
                    label: `Demandes d'intervention`,
                    items: [
                        {
                            label: 'Toutes les DI',
                            icon: 'pi pi-fw pi-file',
                            routerLink: ['/tickets/ticket/ticket-list'],
                        },
                        {
                            label: 'Coordination',
                            icon: 'pi pi-fw pi-check-square',
                            routerLink: ['/tickets/ticket/coordinator-di-list'],
                        },
                        {
                            label: 'Magasin',
                            icon: 'pi pi-fw pi-bookmark',
                            routerLink: ['/tickets/ticket/magasin-di-list'],
                        },
                        {
                            label: 'Atelier technique',
                            icon: 'pi pi-fw pi-exclamation-circle',
                            routerLink: ['/tickets/ticket/tech-di-list'],
                        },
                    ],
                },
                {
                    label: 'Composants',
                    items: [
                        {
                            label: 'Catalogue composants',
                            icon: 'pi pi-fw pi-box',
                            routerLink: ['/tickets/composants'],
                        },
                    ],
                },
            ];
        }

        if (this.role === 'TECH') {
            // « Tableau de bord » réservé à ADMIN_MANAGER / ADMIN_TECH → non listé ici.
            this.model = [
                {
                    label: `Demandes d'intervention`,
                    items: [
                        {
                            label: 'Atelier technique',
                            icon: 'pi pi-fw pi-exclamation-circle',
                            routerLink: ['/tickets/ticket/tech-di-list'],
                        },
                    ],
                },
            ];
        }

        if (this.role === 'MANAGER') {
            // « Tableau de bord » réservé à ADMIN_MANAGER / ADMIN_TECH → non listé ici.
            this.model = [
                {
                    label: 'Personnel',
                    items: [
                        {
                            label: 'Personnel',
                            icon: 'pi pi-fw pi-users',
                            routerLink: ['/profiles/profile/profile-list'],
                        },
                    ],
                },
                {
                    label: 'Clients',
                    items: [
                        {
                            label: 'Clients',
                            icon: 'pi pi-fw pi-building',
                            routerLink: ['/clients/client/client-list'],
                        },
                        {
                            label: 'Sociétés',
                            icon: 'pi pi-fw pi-user',
                            routerLink: ['/companies/company/company-list'],
                        },
                    ],
                },

                {
                    label: `Demandes d'intervention`,
                    items: [
                        {
                            label: 'Toutes les DI',
                            icon: 'pi pi-fw pi-file',
                            routerLink: ['/tickets/ticket/ticket-list'],
                        },
                    ],
                },
            ];
        }

        if (this.role === 'COORDIANTOR') {
            this.model = [
                {
                    label: `Demandes d'intervention`,
                    items: [
                        {
                            label: 'Coordination',
                            icon: 'pi pi-fw pi-check-square',
                            routerLink: ['/tickets/ticket/coordinator-di-list'],
                        },
                    ],
                },
            ];
        }

        if (this.role === 'MAGASIN') {
            this.model = [
                {
                    label: `Demandes d'intervention`,
                    items: [
                        {
                            label: 'Magasin',
                            icon: 'pi pi-fw pi-bookmark',
                            routerLink: ['/tickets/ticket/magasin-di-list'],
                        },
                    ],
                },
                {
                    label: 'Composants',
                    items: [
                        {
                            label: 'Catalogue composants',
                            icon: 'pi pi-fw pi-box',
                            routerLink: ['/tickets/composants'],
                        },
                    ],
                },
            ];
        }
    }
}

/**
 * this.model = [
            {
                label: 'Dashboard',
                items: [
                    {
                        label: 'Statistique',
                        icon: 'pi pi-fw pi-chart-bar',
                        // routerLink: ['/'],
                    },
                ],
            },
            {
                label: 'Gestion STAFF',
                items: [
                    {
                        label: 'STAFF',
                        icon: 'pi pi-fw pi-users',
                        routerLink: ['/profiles/profile/profile-list'],
                    },
                ],
            },
            {
                label: 'Gestion client',
                items: [
                    {
                        label: 'Client',
                        icon: 'pi pi-fw pi-user',
                        routerLink: ['/clients/client/client-list'],
                    },
                    {
                        label: 'Company',
                        icon: 'pi pi-fw pi-user',
                        routerLink: ['/companies/company/company-list'],
                    },
                ],
            },

            {
                label: `Demande d'intervention`,
                items: [
                    {
                        label: 'Tous les DI',
                        icon: 'pi pi-fw pi-file',
                        routerLink: ['/tickets/ticket/ticket-list'],
                    },
                    {
                        label: 'Coordinator-list',
                        icon: 'pi pi-fw pi-check-square',
                        routerLink: ['/tickets/ticket/coordinator-di-list'],
                    },
                    {
                        label: 'Magasin list',
                        icon: 'pi pi-fw pi-bookmark',
                        routerLink: ['/tickets/ticket/magasin-di-list'],
                    },
                    {
                        label: 'Tech list',
                        icon: 'pi pi-fw pi-exclamation-circle',
                        routerLink: ['/tickets/ticket/tech-di-list'],
                    },
                ],
            },
        ]
 */
