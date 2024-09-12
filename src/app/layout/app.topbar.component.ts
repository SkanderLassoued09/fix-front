import { Component, ElementRef, ViewChild } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { LayoutService } from './service/app.layout.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html',
})
export class AppTopBarComponent {
    items!: MenuItem[];

    @ViewChild('menubutton') menuButton!: ElementRef;

    @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;

    @ViewChild('topbarmenu') menu!: ElementRef;
    position: string;
    visible: boolean;

    constructor(
        public layoutService: LayoutService,
        private readonly router: Router
    ) {}

    logout(position: string) {
        console.log('🥪');
        this.position = position;
        this.visible = true;
    }

    yes() {
        this.visible = false;
        localStorage.clear();
        this.router.navigate(['/auth/login']);
    }
}
