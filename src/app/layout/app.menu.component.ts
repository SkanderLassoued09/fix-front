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
        if (this.role === 'ADMIN_MANAGER' || this.role === 'ADMIN_TECH') {
            this.model = [
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
            ];
        }

        if (this.role === 'TECH') {
            this.model = [
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
                    label: `Demande d'intervention`,
                    items: [
                        {
                            label: 'Tech list',
                            icon: 'pi pi-fw pi-exclamation-circle',
                            routerLink: ['/tickets/ticket/tech-di-list'],
                        },
                    ],
                },
            ];
        }

        if (this.role === 'MANAGER') {
            this.model = [
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
                    ],
                },
            ];
        }

        if (this.role === 'COORDIANTOR') {
            this.model = [
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
                    ],
                },
            ];
        }

        if (this.role === 'MAGASIN') {
            this.model = [
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
                            label: 'Magasin list',
                            icon: 'pi pi-fw pi-bookmark',
                            routerLink: ['/tickets/ticket/magasin-di-list'],
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
